import { ProxyServer } from './server';
import * as log from '../logger';
import type { PlayInfoResponse } from './types';

// 全局代理服务器实例
let globalProxyServer: ProxyServer | null = null;

/**
 * 启动代理服务器
 * @param host - 代理服务器的主机名或IP地址
 * @param port - 监听端口
 */
export async function startProxyServer(host: string, port: number): Promise<ProxyServer> {
    if (globalProxyServer && globalProxyServer.getIsRunning()) {
        return globalProxyServer;
    }
    
    try {
        globalProxyServer = new ProxyServer(host, port);
        await globalProxyServer.start();
        return globalProxyServer;
    } catch (error) {
        log.error('启动代理服务器失败:', error);
        throw error;
    }
}

/**
 * 停止代理服务器
 */
export async function stopProxyServer(): Promise<void> {
    if (!globalProxyServer) {
        log.warn('代理服务器未初始化');
        return;
    }

    try {
        await globalProxyServer.stop();
        globalProxyServer = null;
    } catch (error) {
        log.error('停止代理服务器失败:', error);
        throw error;
    }
}

/**
 * 获取当前代理服务器实例
 */
export function getProxyServer(): ProxyServer | null {
    return globalProxyServer;
}

/**
 * 检查代理服务器是否正在运行
 */
export function isProxyRunning(): boolean {
    return globalProxyServer ? globalProxyServer.getIsRunning() : false;
}

/**
 * 获取代理URL
 * @param itemGuid - 媒体项GUID
 */
export function getProxyUrl(itemGuid: string): string {
    const host = globalProxyServer ? globalProxyServer.getHost() : '127.0.0.1';
    const port = globalProxyServer ? globalProxyServer.getPort() : 2345;
    return `http://${host}:${port}/playproxy/${itemGuid}`;
}

// 导出ProxyServer类和常量
export { ProxyServer } from './server';

// 导出类型
export * from './types';
