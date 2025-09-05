import { app, IpcMainEvent } from 'electron';
import { getInstance as getUpdateChecker } from '../../../modules/updater/updateChecker';
import { registerHandler } from '../core/ipcHandler';
import * as log from '../../../modules/logger';

/**
 * 更新管理插件
 * 处理应用更新检查功能
 */

// 获取更新检查器单例实例
const updateChecker = getUpdateChecker();

// 处理手动检查更新
async function handleCheckUpdate(event: IpcMainEvent): Promise<void> {
    log.info('收到手动检查更新请求');
    await updateChecker.manualCheckForUpdates();
}

// 处理自动检查更新
async function handleAutoCheckUpdate(event: IpcMainEvent): Promise<void> {
    log.info('收到自动检查更新请求');
    await updateChecker.autoCheckForUpdates();
}

// 获取当前版本信息
function handleGetVersion(event: IpcMainEvent): void {
    event.reply('version-info', {
        version: app.getVersion(),
        name: app.getName()
    });
}

// 注册更新相关处理器
function init(): void {
    registerHandler('check-update', handleCheckUpdate);
    registerHandler('auto-check-update', handleAutoCheckUpdate);
    registerHandler('get-version', handleGetVersion);
}

export {
    init
};
