const path = require('path');
const log = require('../../modules/logger');
const { readConfig } = require('../../modules/fn_config/config');
const { restoreCookies } = require('../../modules/fn_config/cookie');
const { app } = require('electron');

/**
 * 设置窗口为半屏
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setHalfScreen(mainWindow) {
    if (!mainWindow) return;

    mainWindow.setSize(1200, 800);
    mainWindow.center();
    mainWindow.unmaximize();
}

/**
 * 设置窗口为全屏
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setFullScreen(mainWindow) {
    if (mainWindow) mainWindow.maximize();
}

/**
 * 设置全屏切换
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setupFullScreenToggle(mainWindow) {
    let isFullScreen = false;
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            if (isFullScreen) {
                setHalfScreen();
            } else {
                setFullScreen();
            }
            isFullScreen = !isFullScreen;
            event.preventDefault();
        }
    });
}

/**
 * 设置输入法相关功能
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setupInputMethodDisable(mainWindow) {
    // 禁用输入法相关功能
    mainWindow.webContents.on('dom-ready', () => {
        // 注入CSS来禁用输入法自动切换
        mainWindow.webContents.insertCSS(`
            * {
                ime-mode: disabled !important;
                -webkit-ime-mode: disabled !important;
            }
            input, textarea {
                ime-mode: inactive !important;
                -webkit-ime-mode: inactive !important;
            }
        `);
    });
}

/**
 * 设置窗口显示事件
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setupWindowShowEvents(mainWindow) {
    mainWindow.once('ready-to-show', () => mainWindow.show());
}

/**
 * 设置 cookie 恢复
 * @param {Electron.BrowserWindow} mainWindow - 主窗口实例
 */
function setupCookieRestore(mainWindow) {
    // 从配置中恢复 cookie
    const savedConfig = readConfig();
    // 检查配置中是否有已保存的登录信息
    if (savedConfig && savedConfig.token && savedConfig.domain) {
        // 恢复 cookie 并跳转到对应的 URL
        log.info('恢复登录状态，跳转到主页面, domain:', savedConfig.domain, ' token:', savedConfig.token);
        // 恢复 cookie
        restoreCookies(savedConfig.domain, savedConfig.token).then(() => {
            mainWindow.loadURL(`${savedConfig.domain}/v`);
        });
    } else {
        // 没有有效的登录信息，加载登录页面
        mainWindow.loadFile(path.join(__dirname, '../../public/login.html'));
    }
}

module.exports = {
    setHalfScreen,
    setFullScreen,
    setupFullScreenToggle,
    setupInputMethodDisable,
    setupWindowShowEvents,
    setupCookieRestore,
};