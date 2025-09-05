import type { PlayInfo } from '../fn_api/types';

/**
 * 代理服务器配置接口
 */
export interface ProxyConfig {
    /** 监听端口 */
    port: number;
    /** 是否启用代理 */
    enabled: boolean;
}

/**
 * 代理请求参数接口
 */
export interface ProxyRequestParams {
    /** 媒体项GUID */
    itemGuid: string;
    /** 授权令牌 */
    token: string;
    /** 可选的查询参数 */
    [key: string]: string | number | undefined;
}

/**
 * API响应基础接口
 */
export interface ApiResponse<T = any> {
    /** 响应代码：0-成功，10000-错误 */
    code: number;
    /** 响应消息 */
    message: string;
    /** 响应数据 */
    data: T | null;
}

/**
 * 播放信息数据接口
 */
export interface PlayInfoData {
    /** 播放信息 - 来自fnapi的PlayInfo结构 */
    playInfo: PlayInfo;
    /** 是否来自缓存 */
    fromCache: boolean;
    /** 时间戳 */
    timestamp: number;
}

/**
 * 播放信息API响应接口
 */
export interface PlayInfoResponse extends ApiResponse<PlayInfoData> {
    /** 成功时的数据结构 */
    data: PlayInfoData | null;
}
