import { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { registerHandler } from '../core/ipcHandler';
import * as log from '../../../modules/logger';

/**
 * 日志管理插件
 * 处理渲染进程的日志消息
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// 处理渲染进程日志消息
function handleLogMessage(event: IpcMainInvokeEvent, level: LogLevel, ...args: any[]): void {
    try {
        // 根据级别调用对应的日志方法
        switch (level) {
            case 'debug':
                log.debug('[Renderer]', ...args);
                break;
            case 'info':
                log.info('[Renderer]', ...args);
                break;
            case 'warn':
                log.warn('[Renderer]', ...args);
                break;
            case 'error':
                log.error('[Renderer]', ...args);
                break;
            default:
                log.info('[Renderer]', ...args);
        }
    } catch (error) {
        // 如果日志记录失败，至少在控制台输出
        log.error('日志记录失败:', error);
        log.info('[Renderer]', level, ...args);
    }
}

// 注册日志相关处理器
function init(): void {
    registerHandler('log-message', handleLogMessage, { useHandle: true });
}

export {
    init
};
