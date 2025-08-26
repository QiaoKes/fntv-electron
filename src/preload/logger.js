// preload/logger.js - 渲染进程日志接口
const { ipcRenderer } = require('electron');

/**
 * 渲染进程日志模块
 * 通过IPC将日志发送到主进程进行处理
 * 主进程会自动进行数据脱敏，对渲染进程完全透明
 */
const preloadLogger = {
    debug: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'debug', ...args);
        } catch (error) {
            // 如果IPC不可用，回退到console（仅在开发环境）
            if (process.env.NODE_ENV === 'development') {
                console.debug(...args);
            }
        }
    },
    
    info: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.info(...args);
            }
        }
    },
    
    warn: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'warn', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(...args);
            }
        }
    },
    
    error: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'error', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error(...args);
            }
        }
    },
    
    log: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.log(...args);
            }
        }
    },
    
    // 方便的方法别名
    d: (...args) => preloadLogger.debug(...args),   // debug简写
    i: (...args) => preloadLogger.info(...args),    // info简写
    w: (...args) => preloadLogger.warn(...args),    // warn简写
    e: (...args) => preloadLogger.error(...args),   // error简写
};

module.exports = preloadLogger;
