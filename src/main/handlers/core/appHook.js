const { app } = require('electron');
const log = require('../../../modules/logger');

/**
 * 应用生命周期钩子管理器
 */
const hooks = {
    beforeQuit: [],
    ready: [],
    windowAllClosed: [],
    activate: []
};

/**
 * 注册应用生命周期钩子
 * @param {string} type - 钩子类型
 * @param {Function} fn - 回调函数
 */
function registerAppHook(type, fn) {
    if (!hooks[type]) {
        throw new Error(`Unknown app hook type: ${type}`);
    }
    hooks[type].push(fn);
}

/**
 * 执行指定类型的钩子
 * @param {string} type - 钩子类型
 * @param {...any} args - 传递给钩子函数的参数
 */
function runAppHooks(type, ...args) {
    if (!hooks[type]) return;
    
    hooks[type].forEach(fn => {
        try {
            fn(...args);
        } catch (error) {
            log.error(`Error running ${type} hook:`, error);
        }
    });
}

/**
 * 初始化应用钩子
 */
function initAppHooks() {
    app.on('before-quit', () => {
        runAppHooks('beforeQuit');
    });
    
    app.on('ready', () => {
        runAppHooks('ready');
    });
    
    app.on('window-all-closed', () => {
        runAppHooks('windowAllClosed');
    });
    
    app.on('activate', () => {
        runAppHooks('activate');
    });
}

module.exports = {
    registerAppHook,
    runAppHooks,
    initAppHooks
};
