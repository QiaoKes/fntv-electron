// preload/logger.js - 渲染进程日志接口
const { ipcRenderer } = require('electron');

/**
 * 渲染进程日志模块
 * 通过IPC将日志发送到主进程进行处理
 */
const preloadLogger = {
    debug: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'debug', ...args);
        } catch (error) {
            // 如果IPC不可用，回退到console
            console.debug(...args);
        }
    },
    
    info: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            console.info(...args);
        }
    },
    
    warn: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'warn', ...args);
        } catch (error) {
            console.warn(...args);
        }
    },
    
    error: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'error', ...args);
        } catch (error) {
            console.error(...args);
        }
    },
    
    log: (...args) => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            console.log(...args);
        }
    }
};

module.exports = preloadLogger;
