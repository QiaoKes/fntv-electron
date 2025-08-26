const { BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const { restoreCookies } = require('../modules/fn_config/cookie');
const { readConfig, saveConfig } = require('../modules/fn_config/config');
const log = require('../modules/logger');
const { registerAllPlugins } = require('./handlers');

let mainWindow;

/**
 * 设置缓存管理
 * @param {Electron.Session} ses - session 实例
 */
function setupCacheManagement(ses) {
    // 检查并清理缓存的函数
    const checkAndClearCache = async () => {
        try {
            const usage = await ses.getCacheSize();
            log.info('当前缓存使用量：', Math.round(usage / (1024 * 1024)), 'MB');

            // 如果超过100MB，清理缓存
            if (usage > 100 * 1024 * 1024) {
                await ses.clearCache();
                log.info('已清理缓存文件夹');
            }
        } catch (err) {
            log.error('检查缓存使用量失败:', err);
        }
    };

    // 程序启动时立即执行一次
    checkAndClearCache();

    // 后续每6小时执行一次
    setInterval(checkAndClearCache, 6 * 60 * 60 * 1000);
}

function createMainWindow() {
    const partition = 'persist:fntv';
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
            partition: partition,
            preload: path.join(__dirname, '../preload/index.js'),
            nodeIntegration: true,   // 开启 Node.js 支持
            contextIsolation: false,  // 如果 preload 里要直接改 DOM，通常要关掉
            spellcheck: false,  // 禁用拼写检查，避免输入法干扰
        }
    });

    // 注册 IPC 事件处理程序
    registerAllPlugins(partition);

    // 初始化 session 和缓存管理
    const ses = session.fromPartition('persist:fntv');
    setupCacheManagement(ses);

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

    // 调试
    // mainWindow.webContents.openDevTools();

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
        mainWindow.loadFile(path.join(__dirname, '../public/login.html'));
    }

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