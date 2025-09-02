import { IpcMainEvent } from 'electron';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';

/**
 * 系统配置插件
 * 处理下载代理等系统配置功能
 */

interface ProxyConfig {
    enabled: boolean;
    proxyUrl: string;
}

// 获取当前代理设置
function handleGetDownloadProxy(event: IpcMainEvent): void {
    const proxyConfig = fnConfig.getDownloadProxyConfig();
    event.reply('download-proxy-info', proxyConfig);
}

// 设置代理配置
function handleSetDownloadProxy(event: IpcMainEvent, { enabled, proxyUrl }: Partial<ProxyConfig>): void {
    try {
        fnConfig.setDownloadProxyConfig({ 
            enabled: enabled !== false, 
            proxyUrl: proxyUrl || 'https://ghfast.top' 
        });
        event.reply('download-proxy-set', { success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        event.reply('download-proxy-set', { success: false, error: errorMessage });
    }
}

// 注册配置相关处理器
function init(): void {
    registerHandler('get-download-proxy', handleGetDownloadProxy);
    registerHandler('set-download-proxy', handleSetDownloadProxy);
}

export {
    init
};
