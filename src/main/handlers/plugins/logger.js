const { registerHandler } = require('../core/registry');
const log = require('../../../modules/logger');

/**
 * 日志管理插件
 * 处理渲染进程的日志消息
 */

// 处理渲染进程日志消息
function handleLogMessage(event, level, ...args) {
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
function initLogHandlers() {
    registerHandler('log-message', handleLogMessage, { useHandle: true });
}

module.exports = {
    initLogHandlers
};
