// preload/logger.ts - 渲染进程日志接口
import { ipcRenderer } from 'electron';
import type { Logger } from './types';

/**
 * 渲染进程日志模块
 * 通过IPC将日志发送到主进程进行处理
 * 主进程会自动进行数据脱敏，对渲染进程完全透明
 */
const preloadLogger: Logger = {
    debug: (...args: any[]): void => {
        try {
            ipcRenderer.invoke('log-message', 'debug', ...args);
        } catch (error) {
            // 如果IPC不可用，回退到console（仅在开发环境）
            if (process.env.NODE_ENV === 'development') {
                console.debug(...args);
            }
        }
    },
    
    info: (...args: any[]): void => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.info(...args);
            }
        }
    },
    
    warn: (...args: any[]): void => {
        try {
            ipcRenderer.invoke('log-message', 'warn', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn(...args);
            }
        }
    },
    
    error: (...args: any[]): void => {
        try {
            ipcRenderer.invoke('log-message', 'error', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error(...args);
            }
        }
    },
    
    log: (...args: any[]): void => {
        try {
            ipcRenderer.invoke('log-message', 'info', ...args);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.log(...args);
            }
        }
    },
    
    // 方便的方法别名
    d: (...args: any[]): void => preloadLogger.debug(...args),   // debug简写
    i: (...args: any[]): void => preloadLogger.info(...args),    // info简写
    w: (...args: any[]): void => preloadLogger.warn(...args),    // warn简写
    e: (...args: any[]): void => preloadLogger.error(...args),   // error简写
};

export default preloadLogger;
