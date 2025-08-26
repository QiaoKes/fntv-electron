const { app, BrowserWindow } = require('electron');
const { registerIpcHandlers } = require('./handlers');
const updateChecker = require('../modules/updater/updateChecker');
const { createMainWindow, setupWindowShowEvents } = require('./windowManager');
const { setupFullScreenToggle } = require('./screenControl');
const { createTray, showTrayNotification, destroyTray } = require('./trayManager');
const log = require('../modules/logger');

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
        mainWindow = createMainWindow();

        // 创建系统托盘
        createTray(mainWindow);

        // 设置窗口关闭事件
        setupWindowEvents();

        // 设置全屏切换
        setupFullScreenToggle(mainWindow);

        // 注册 IPC 事件处理程序
        registerIpcHandlers();

        // 设置窗口显示事件
        setupWindowShowEvents(mainWindow);

        // 延迟3秒后进行自动更新检查，避免影响应用启动速度
        setTimeout(() => {
            updateChecker.getInstance().autoCheckForUpdates().catch(error => {
                log.error('启动时自动检查更新失败:', error);
            });
        }, 3000);
    });
}

// 设置窗口事件
function setupWindowEvents() {
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

app.on('window-all-closed', () => {
    // 在 macOS 上，应用通常会保持活跃状态，即使所有窗口都关闭了
    if (process.platform !== 'darwin') {
        // 如果不是真正退出，不要退出应用
        if (!app.isQuiting) {
            return;
        }
        app.quit();
    }
});

app.on('activate', () => {
    // 在 macOS 上，当点击 dock 图标并且没有其他窗口打开时，重新创建窗口
    if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow();
    }
});

// 应用退出前清理托盘
app.on('before-quit', () => {
    app.isQuiting = true;
    destroyTray();
});