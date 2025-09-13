// server.ts
import express, { Express, Request, Response, NextFunction } from 'express'
import fs from 'fs'
import * as log from '../logger'
import { ApiService } from '../fn_api/api'
import * as fnConfig from '../fn_config/config'
import { RouteResolver, RouteResolution } from './types'
import { isTrusted } from '../cert_trust'
import * as utils from './utils'

/**
 * 代理服务器类
 */
export class ProxyServer {
    private app: Express
    private server: any = null
    private port: number
    private isRunning: boolean = false
    private host: string = ''
    private routeResolver: RouteResolver = utils.defaultRouteResolver

    constructor(host: string, port: number) {
        this.port = port
        this.host = host
        this.app = express()
        this.setupMiddleware()
        this.registerDefaultRoutes()
    }

    /** 替换/注入自定义路由解析逻辑 */
    public setRouteResolver(resolver: RouteResolver) {
        this.routeResolver = resolver
        log.info('已设置自定义路由解析逻辑')
    }

    /** 中间件：CORS + 日志 + 统一 /proxy 入口转发 */
    private setupMiddleware(): void {
        // CORS
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Headers', 'Authorization, Range, Content-Type')
            res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
            if (req.method === 'OPTIONS') return res.sendStatus(204)
            next()
        })

        // 日志
        this.app.use((req: Request, _res: Response, next: NextFunction) => {
            log.debug(`代理服务器收到请求: ${req.method} ${req.url}`)
            next()
        })

        // 通用 /proxy 入口：由 routeResolver 决定目标
        this.app.use('/proxy', async (req, res) => {
            try {
                const resolved = await this.routeResolver(req)
                if (!resolved) return res.status(400).send('Missing or invalid proxy target')
                return utils.dynamicProxy(req, res, resolved)
            } catch (e) {
                log.error('proxy 解析失败:', e)
                return res.status(500).send('Proxy resolve error')
            }
        })
    }

    /** 业务路由 */
    private registerDefaultRoutes(): void {
        /**
         * 透明播放代理（不 302）
         * - /playproxy/:itemGuid
         * - 自动判断：本地 NAS => 代理至 fnapi 视频 URL；云盘 => 代理至直链并附 cookie
         * - 允许通过 query/头追加自定义上游请求头（与 /proxy 同规则）
         */
        this.app.get('/playproxy/:itemGuid', async (req: Request, res: Response) => {
            const { itemGuid } = req.params
            if (!itemGuid) return res.status(400).send('Missing item GUID parameter')

            // 读取配置与 API
            const config = fnConfig.readConfig()
            if (!config || !config.domain || !config.token || !config.account) {
                return res.status(500).send('Server base URL is not configured')
            }
            const fnapi = new ApiService(config.domain, config.token)

            // 播放信息（带缓存）
            let resp = await fnapi.getPlayInfoCached(itemGuid)
            if (!resp || !resp.data) {
                log.error('获取播放信息失败:', resp ? resp.message : '未知错误')
                return res.status(500).send('Failed to get play info')
            }

            const playInfo = resp.data
            // 获取流信息
            const mediaGuid = playInfo.media_guid
            const streamResp = await fnapi.getStreamCached(mediaGuid, utils.stringToUUID(config.account))
            if (!streamResp.success || !streamResp.data) {
                log.error('获取视频流失败:', streamResp ? streamResp.message : '未知错误')
                return res.status(500).send('Failed to get stream')
            }
            const stream = streamResp.data

            // 目标 URL & 附加头
            let target = fnapi.getVideoUrl(mediaGuid)
            const extraHeaders: Record<string, string> = utils.passthroughHeaders(req)

            let useAligned = false
            // 云盘：优先直接链 + Cookie（不 302 到客户端）
            if (stream.cloud_storage_info) {
                const cookie = stream.header?.Cookie
                const qualities = stream.direct_link_qualities
                if (!cookie || !qualities?.length) {
                    log.error('云盘直链数据不完整')
                    return res.status(500).send('Cloud direct link not available')
                }
                target = qualities[0].url || target
                if (cookie) extraHeaders['cookie'] = cookie.join('; ')
                extraHeaders['user-agent'] = 'Lavf/59.27.100'
                extraHeaders['Play-Link'] = `Play-Link:${utils.stringToUUID(config.account)}`
                extraHeaders['host'] = "dl-pc-zb.pds.quark.cn"
            } else {
                extraHeaders['Authorization'] = config.token
                extraHeaders['connection'] = 'keep-alive'
            }

            // 将完整 target 拆分为 origin 与 path
            const u = new URL(target)
            const origin = `${u.protocol}//${u.host}`
            // 开始透明代理
            return utils.dynamicProxy(req, res, {
                target: origin,                                  // 只给代理 origin
                headers: extraHeaders,
                rewritePath: () => u.pathname + (u.search || ''), // 把目标的完整路径+查询写回
                certTrust: isTrusted(u.host),               // 是否信任证书
            } as RouteResolution)
        })

        // 健康检查
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ status: 'ok', host: this.host, port: this.port, uptime: process.uptime() })
        })

        // 404
        this.app.use((req: Request, res: Response) => res.status(404).send('Not Found'))
    }

    /** 启动 */
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                log.warn('代理服务器已经在运行中')
                return resolve()
            }

            const listenCb = () => {
                this.isRunning = true
                log.info(`代理服务器启动成功: host: ${this.host} 监听端口: ${this.port}`)
                resolve()
            }

            try {
                this.server = this.app.listen(this.port, this.host, listenCb)

                this.server.on('error', (error: Error) => {
                    log.error('代理服务器启动失败:', error)
                    reject(error)
                })
            } catch (e) {
                log.error('代理服务器启动异常:', e)
                reject(e)
            }
        })
    }

    /** 停止 */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isRunning || !this.server) {
                log.warn('代理服务器未运行')
                return resolve()
            }
            this.server.close(() => {
                this.isRunning = false
                this.server = null
                log.info('代理服务器已停止')
                resolve()
            })
        })
    }

    public getIsRunning(): boolean {
        return this.isRunning
    }
    public getPort(): number {
        return this.port
    }
    public getHost(): string {
        return this.host
    }
}
