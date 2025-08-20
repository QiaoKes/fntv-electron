const { app, Tray, Menu, nativeImage, BrowserWindow } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./eventHandlers');
const { createMainWindow, setupWindowShowEvents } = require('./windowManager');
const { setupFullScreenToggle } = require('./screenControl');

// 禁用输入法自动切换
app.commandLine.appendSwitch('--lang', 'en-US');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

let tray = null;
let mainWindow = null;
let trayNotificationShown = false; // 托盘提示是否已显示过

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
        // 创建主窗口
        mainWindow = createMainWindow();

        // 创建系统托盘
        createTray();

        // 设置窗口关闭事件
        setupWindowEvents();

        // 设置全屏切换
        setupFullScreenToggle(mainWindow);

        // 注册 IPC 事件处理程序
        registerIpcHandlers();

        // 设置窗口显示事件
        setupWindowShowEvents(mainWindow);
    });
}

// 创建系统托盘
function createTray() {
    // 创建托盘图标
    const iconPath = path.join(__dirname, '../../build/icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    // 设置托盘提示文字
    tray.setToolTip('飞牛影视');
    
    // 创建托盘菜单
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    if (!mainWindow.isVisible()) mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: '退出',
            click: () => {
                // 真正退出应用
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);
    
    // 设置托盘菜单
    tray.setContextMenu(contextMenu);
    
    // 双击托盘图标恢复窗口
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
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
                
                // 在 Windows 上显示托盘提示（只显示一次）
                if (process.platform === 'win32' && !trayNotificationShown) {
                    tray.displayBalloon({
                        iconType: 'info',
                        title: '飞牛影视',
                        content: '应用已最小化到托盘，双击托盘图标或右键菜单可以恢复窗口'
                    });
                    trayNotificationShown = true; // 标记已显示过提示
                }
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
    if (tray) {
        tray.destroy();
        tray = null;
    }
});