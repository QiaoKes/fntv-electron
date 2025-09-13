// server.ts
import express, { Express, Request, Response, NextFunction } from 'express'
import https from 'https'
import fs from 'fs'
import { createProxyMiddleware } from 'http-proxy-middleware'
import * as log from '../logger'
import { ApiService } from '../fn_api/api'
import * as fnConfig from '../fn_config/config'
import { RouteResolver, RouteResolution } from './types'
import { isTrusted } from '../cert_trust'
import * as utils from './utils'
import { pipeline } from 'stream'



type RangeAlignCfg = { enabled: boolean, partSize?: number }
/**
 * 核心：按请求实时创建 proxy 中间件（可自定义目标与头）
 * - secure: false 允许代理到自签名 SSL 上游
 * - changeOrigin: true 以目标 Host 发送
 * - follow redirects: 我们不 302 给客户端，而是直连上游（若上游再 302，可用 onProxyRes 做二次处理）
 */
function dynamicProxy(req: Request, res: Response, resolution: RouteResolution) {
    const target = resolution.target
    const extraHeaders = resolution.headers || {}
    const rewritePath = resolution.rewritePath

    // 组合需要透传/追加的头
    const headers = {
        ...utils.passthroughHeaders(req),
        ...extraHeaders,
    }

    // 记录组合后的headers（调试用）
    // log.debug(`组合headers:`, {
    //     target,
    //     pickPassthroughHeaders: pickPassthroughHeaders(req),
    //     extraHeaders,
    //     finalHeaders: headers
    // })

    const mw = createProxyMiddleware({
        target,
        changeOrigin: true,
        secure: resolution.certTrust ? !resolution.certTrust : false,           // 允许代理到自签名上游
        ws: true,
        selfHandleResponse: false,
        xfwd: false,

        // 用 pathRewrite 做路径改写（v3 推荐）
        pathRewrite: (path, _req) => (rewritePath ? rewritePath(path) : path),

        // 直接设置额外的headers，http-proxy-middleware会自动合并
        headers,

        // v3：事件放进 on: { ... }
        on: {
            proxyReq(proxyReq, request, _res) {
                // 确保Range header被正确转发（有时会被过滤）
                // const range = request.headers['range']
                // if (typeof range === 'string') {
                //     proxyReq.setHeader('range', range)
                // }

                // 记录请求headers（调试用）
                log.debug(`代理请求头设置:`, {
                    target,
                    originalRequestHeaders: request.headers,
                    mergedHeaders: headers,
                    finalProxyHeaders: proxyReq.getHeaders()
                })

                // 可以在这里添加更多自定义逻辑
                // 比如修改特定的header值
            },

            proxyRes(proxyRes, req, res) {
                // 记录响应headers（调试用）
                log.debug(`代理响应头:`, {
                    statusCode: proxyRes.statusCode,
                    statusMessage: proxyRes.statusMessage,
                    responseHeaders: proxyRes.headers,
                    url: req.url
                })

                proxyRes.headers['access-control-allow-origin'] ||= '*'
                proxyRes.headers['access-control-allow-headers'] ||= 'Authorization, Range, Content-Type'
                proxyRes.headers['access-control-allow-methods'] ||= 'GET, HEAD, OPTIONS'
            },

            error(err, req, res) {
                log.error(`代理错误: ${err.message}`, {
                    target,
                    url: req.url,
                    method: req.method,
                    headers: Object.keys(req.headers)
                })

                try {
                    if (utils.isServerResponse(res)) {
                        if (!res.headersSent) {
                            res.writeHead(502, {
                                'Content-Type': 'text/plain',
                                'Access-Control-Allow-Origin': '*',
                            })
                        }
                        res.end('Proxy error.')
                    } else {
                        try {
                            res.write(
                                'HTTP/1.1 502 Bad Gateway\r\n' +
                                'Connection: close\r\n' +
                                'Content-Length: 11\r\n' +
                                '\r\n' +
                                'Bad Gateway'
                            )
                        } catch { }
                        try { res.end() } catch { }
                        try { res.destroy() } catch { }
                    }
                } catch { }
            },
        },

        logger: {
            info: (msg: any) => log.info(String(msg)),
            warn: (msg: any) => log.warn(String(msg)),
            error: (msg: any) => log.error(String(msg)),
        },
    })

    return mw(req, res, () => undefined)
}

/** 默认路由解析器（支持 /proxy 与 query target、headers*）*/
const defaultRouteResolver: RouteResolver = (req) => {
    // 仅 /proxy 开头才由此解析；其它路径交给业务路由（如 /playproxy/:itemGuid）
    if (!req.path.startsWith('/proxy')) return null

    const rawTarget = (req.query.target as string) || ''
    if (!rawTarget) {
        return null
    }

    // 支持 base64url 或 直接 URL
    let target = rawTarget
    try {
        target = Buffer.from(rawTarget, 'base64url').toString('utf8')
    } catch { }

    const headers = utils.passthroughHeaders(req)
    // 缺省从路径去掉 /proxy 前缀
    const rewritePath = (p: string) => p.replace(/^\/proxy/, '') || '/'

    return { target, headers, rewritePath }
}

/**
 * 代理服务器类
 */
export class ProxyServer {
    private app: Express
    private server: any = null
    private port: number
    private isRunning: boolean = false
    private host: string = ''
    private routeResolver: RouteResolver = defaultRouteResolver
    private httpsKeyPath?: string
    private httpsCertPath?: string

    constructor(host: string, port: number, opts?: { httpsKeyPath?: string; httpsCertPath?: string }) {
        this.port = port
        this.host = host
        this.httpsKeyPath = opts?.httpsKeyPath
        this.httpsCertPath = opts?.httpsCertPath
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
                return dynamicProxy(req, res, resolved)
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
            return dynamicProxy(req, res, {
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

    /** 启动（支持可选自签名 HTTPS） */
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
                if (this.httpsKeyPath && this.httpsCertPath && fs.existsSync(this.httpsKeyPath) && fs.existsSync(this.httpsCertPath)) {
                    const key = fs.readFileSync(this.httpsKeyPath)
                    const cert = fs.readFileSync(this.httpsCertPath)
                    this.server = https.createServer({ key, cert }, this.app).listen(this.port, this.host, listenCb)
                    log.info('已启用 HTTPS（可使用自签名证书）')
                } else {
                    this.server = this.app.listen(this.port, this.host, listenCb)
                }

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
