const { BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const { SITE_URL } = require('../public/constants');
const { restoreCookie } = require('../modules/fn_token/token');

let mainWindow;

function createMainWindow() {
    // 恢复Cookie
    const ses = session.fromPartition('persist:fntv');
    restoreCookie(ses).catch(console.error);

    // 创建窗口
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        minWidth: 800,
        minHeight: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, '../build/icon.ico'),
        frame: false,
        transparent: true,
        webPreferences: {
            webgl: true,
            partition: 'persist:fntv',
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: true,   // 开启 Node.js 支持
            contextIsolation: false,  // 如果 preload 里要直接改 DOM，通常要关掉
        }
    });

    // 调试
    // mainWindow.webContents.openDevTools();

    // 先加载本地静态页面
    mainWindow.loadFile(path.join(__dirname, '../public/login.html'));

    return mainWindow;
}

function getMainWindow() {
    return mainWindow;
}

function setupWindowShowEvents(mainWindow) {
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

module.exports = {
    createMainWindow,
    getMainWindow,
    setupWindowShowEvents
};