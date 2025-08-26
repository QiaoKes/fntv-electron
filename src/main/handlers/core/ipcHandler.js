const { ipcMain } = require('electron');

const handlers = new Map();

/**
 * 注册 IPC 处理器
 * @param {string} channel - IPC 通道名称
 * @param {Function} handler - 处理函数
 * @param {Object} options - 选项配置
 */
function registerHandler(channel, handler, options = {}) {
    if (handlers.has(channel)) {
        throw new Error(`Handler for channel "${channel}" already registered`);
    }
    
    handlers.set(channel, { handler, options });
    
    // 根据选项决定使用 handle 还是 on
    if (options.useHandle) {
        ipcMain.handle(channel, handler);
    } else {
        ipcMain.on(channel, handler);
    }
}

/**
 * 移除 IPC 处理器
 * @param {string} channel - IPC 通道名称
 */
function removeHandler(channel) {
    if (handlers.has(channel)) {
        ipcMain.removeAllListeners(channel);
        handlers.delete(channel);
    }
}

/**
 * 获取所有已注册的处理器
 */
function getRegisteredHandlers() {
    return Array.from(handlers.keys());
}

/**
 * 清除所有处理器
 */
function clearAllHandlers() {
    handlers.forEach((_, channel) => {
        ipcMain.removeAllListeners(channel);
    });
    handlers.clear();
}

module.exports = {
    registerHandler,
    removeHandler,
    getRegisteredHandlers,
    clearAllHandlers
};
