const { app, BrowserWindow } = require('electron');
const { registerAppHook } = require('../core/appHook');
const { destroyTray } = require('../../common/tray');
const { createMainWindow, getMainWindow } = require('../../common/mainwin');

// 注册 window-all-closed 事件
function handleWindowAllClosed() {
    if (process.platform !== 'darwin') {
        if (!app.isQuiting) {
            return;
        }
        app.quit();
    }
}

// 注册 activate 事件
function handleActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
        const mainWindow = createMainWindow();
    }
}

// 注册 before-quit 事件
function handleBeforeQuit() {
    app.isQuiting = true;
    destroyTray();
}

// 注册更新相关处理器
function init() {
    registerAppHook('windowAllClosed', handleWindowAllClosed);
    registerAppHook('activate', handleActivate);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

module.exports = {
    init
};
