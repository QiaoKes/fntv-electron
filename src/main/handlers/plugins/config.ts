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

interface PlayButtonConfig {
    hideOriginalPlayButton: boolean;
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

// 获取播放按钮配置
function handleGetPlayButtonConfig(event: IpcMainEvent): void {
    const hideOriginalPlayButton = fnConfig.getHideOriginalPlayButton();
    event.reply('play-button-config-info', { hideOriginalPlayButton });
}

// 设置播放按钮配置
function handleSetPlayButtonConfig(event: IpcMainEvent, { hideOriginalPlayButton }: Partial<PlayButtonConfig>): void {
    try {
        fnConfig.setHideOriginalPlayButton(hideOriginalPlayButton !== false); // 默认为true
        event.reply('play-button-config-set', { success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        event.reply('play-button-config-set', { success: false, error: errorMessage });
    }
}

// 获取NAS代理配置
function handleGetNasProxyConfig(event: IpcMainEvent): void {
    const nasProxyEnabled = fnConfig.getNasProxyEnabled();
    event.reply('nas-proxy-info', { nasProxyEnabled });
}

// 设置NAS代理配置
function handleSetNasProxyConfig(event: IpcMainEvent, { nasProxyEnabled }: { nasProxyEnabled: boolean }): void {
    try {
        fnConfig.setNasProxyEnabled(nasProxyEnabled !== false);
        event.reply('nas-proxy-set', { success: true });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        event.reply('nas-proxy-set', { success: false, error: errorMessage });
    }
}

// 注册配置相关处理器
function init(): void {
    registerHandler('get-download-proxy', handleGetDownloadProxy);
    registerHandler('set-download-proxy', handleSetDownloadProxy);
    registerHandler('get-play-button-config', handleGetPlayButtonConfig);
    registerHandler('set-play-button-config', handleSetPlayButtonConfig);
    registerHandler('get-nas-proxy', handleGetNasProxyConfig);
    registerHandler('set-nas-proxy', handleSetNasProxyConfig);
}

export {
    init
};
