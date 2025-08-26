const { getMainWindow } = require('../../windowManager');
const { setHalfScreen, setFullScreen } = require('../../screenControl');
const { registerHandler } = require('../core/ipcHandler');

/**
 * 窗口控制插件
 * 处理窗口的最小化、最大化和关闭操作
 */

// 窗口最小化处理
function handleMinimize() {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.minimize();
}

// 窗口最大化/还原处理
function handleMaximize() {
    const mainWindow = getMainWindow();
    if (mainWindow) {
        mainWindow.isMaximized() ? setHalfScreen() : setFullScreen();
    }
}

// 窗口关闭处理
function handleClose() {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.close();
}

// 注册窗口控制处理器
function init() {
    registerHandler('window-minimize', handleMinimize);
    registerHandler('window-maximize', handleMaximize);
    registerHandler('window-close', handleClose);
}

module.exports = {
    init
};
