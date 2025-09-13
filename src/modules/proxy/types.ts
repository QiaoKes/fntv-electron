// types.ts
import type { PlayInfo } from '../fn_api/types'

/** 代理服务器配置 */
export interface ProxyConfig {
    /** 监听端口 */
    port: number
    /** 是否启用代理 */
    enabled: boolean
    /** （可选）本服务启用 HTTPS 的 key/cert 路径，自签名可用 */
    httpsKeyPath?: string
    httpsCertPath?: string
}

/** 自定义路由解析结果 */
export interface RouteResolution {
    /** 目标上游，如 https://upstream.example.com */
    target: string
    /** （可选）对目标请求的额外头部（会与客户端头合并） */
    headers?: Record<string, string>
    /** （可选）对路径进行改写，例如去掉 /proxy 前缀 */
    rewritePath?: (path: string) => string
    certTrust?: boolean // 是否信任自签名证书
}

/** 自定义路由解析函数签名（按请求决定上游与额外头） */
export type RouteResolver = (req: import('express').Request) => Promise<RouteResolution | null> | RouteResolution | null

/** 通用 API 响应 */
export interface ApiResponse<T = any> {
    code: number
    message: string
    data: T | null
}

/** 播放信息数据 */
export interface PlayInfoData {
    playInfo: PlayInfo
    fromCache: boolean
    timestamp: number
}

/** 播放信息 API 响应 */
export interface PlayInfoResponse extends ApiResponse<PlayInfoData> {
    data: PlayInfoData | null
}
