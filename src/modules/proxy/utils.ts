// 顶部 import（新增）
import * as http from 'http'
import * as https from 'https'
import { IncomingMessage } from 'http'
import type { Socket } from 'net'
import { isTrusted } from '../cert_trust'
const { v5: uuidv5 } = require('uuid')
import { Transform, pipeline, Readable, PassThrough } from 'stream'
import express, { Express, Request, Response, NextFunction } from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { RouteResolution, RouteResolver } from './types'
import * as log from '../logger'
import MultiStream from 'multistream'

// 固定命名空间：可用官方的 DNS，也可换成你自己团队固定的 UUID
const NAMESPACE = uuidv5.DNS // DNS namespace

export function stringToUUID(name: string): string {
    // 建议先做统一化，避免大小写/空格导致不同结果
    const normalized = (name ?? '').trim()
    return uuidv5(normalized, NAMESPACE)
}

// 类型守卫：判断是否为 ServerResponse（HTTP）
export function isServerResponse(
    res: http.ServerResponse<http.IncomingMessage> | Socket
): res is http.ServerResponse<http.IncomingMessage> {
    // ServerResponse 独有 writeHead / statusCode 等
    return typeof (res as http.ServerResponse).writeHead === 'function'
}

/** 复制透传与视频相关的关键头（Range、Accept、Origin 等） */
export function passthroughHeaders(req: Request): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') out[k] = v
    }
    return out
}


/** 默认路由解析器（支持 /proxy 与 query target、headers*）*/
export const defaultRouteResolver: RouteResolver = (req) => {
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

    const headers = passthroughHeaders(req)
    // 缺省从路径去掉 /proxy 前缀
    const rewritePath = (p: string) => p.replace(/^\/proxy/, '') || '/'

    return { target, headers, rewritePath }
}

/** 核心：按请求实时创建 proxy 中间件（可自定义目标与头） */
export function dynamicProxy(req: Request, res: Response, resolution: RouteResolution) {
    const target = resolution.target
    const extraHeaders = resolution.headers || {}
    const rewritePath = resolution.rewritePath

    // 组合需要透传/追加的头
    const headers = {
        ...passthroughHeaders(req),
        ...extraHeaders,
    }

    const mw = createProxyMiddleware({
        target,
        changeOrigin: true,
        secure: resolution.certTrust ? !resolution.certTrust : false, // 允许代理到自签名上游
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
                // 记录请求headers（调试用）
                log.debug(`代理请求头设置:`, {
                    target,
                    originalRequestHeaders: request.headers,
                    mergedHeaders: headers,
                    finalProxyHeaders: proxyReq.getHeaders()
                })
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
                    if (isServerResponse(res)) {
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