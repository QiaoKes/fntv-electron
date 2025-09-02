const { app, BrowserWindow } = require('electron');
const { registerAllPlugins } = require('./handlers');
const updateChecker = require('../modules/updater/updateChecker.ts');
const winctrl = require('./common/winctrl');
const { createTray, showTrayNotification, destroyTray } = require('./common/tray');
const log = require('../modules/logger');
const { getMainWindow } = require('./common/mainwin');

// 禁用输入法自动切换
app.commandLine.appendSwitch('--lang', 'en-US');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

let mainWindow = null;

// 单实例应用锁定
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 如果没有获取到锁，说明应用已经在运行，直接退出
    app.quit();
} else {
    // 当尝试启动第二个实例时，聚焦到现有窗口
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        // 初始化日志系统
        log.info('=== 飞牛影视启动 ===');
        log.info('应用版本:', app.getVersion());
        log.info('Electron版本:', process.versions.electron);
        log.info('Node.js版本:', process.versions.node);
        log.info('日志文件位置:', log.getLogFile());
        
        // 创建主窗口
        mainWindow = getMainWindow();

        // 注册所有插件
        registerAllPlugins();

        // 创建系统托盘
        createTray(mainWindow);

        // 设置窗口关闭事件
        setupWindowEvents(mainWindow);

        // 设置全屏切换
        winctrl.setupFullScreenToggle(mainWindow);

        // 禁用输入法自动切换
        winctrl.setupInputMethodDisable(mainWindow);

        // 设置窗口显示事件
        winctrl.setupWindowShowEvents(mainWindow);

        // 恢复 Cookie
        winctrl.setupCookieRestore(mainWindow);

        // 延迟3秒后进行自动更新检查，避免影响应用启动速度
        setTimeout(() => {
            updateChecker.getInstance().autoCheckForUpdates().catch(error => {
                log.error('启动时自动检查更新失败:', error);
            });
        }, 3000);
    });
}

// 设置窗口事件
function setupWindowEvents(mainWindow) {
    if (mainWindow) {
        // 监听窗口关闭事件
        mainWindow.on('close', (event) => {
            if (!app.isQuiting) {
                // 阻止窗口关闭，改为隐藏到托盘
                event.preventDefault();
                mainWindow.hide();

                // 显示托盘提示（仅在Windows上首次显示）
                showTrayNotification();
            }
        });
    }
}