const { app } = require('electron');
const { registerIpcHandlers } = require('./eventHandlers');
const { createMainWindow, setupWindowShowEvents } = require('./windowManager');
const { setupFullScreenToggle } = require('./screenControl');
const { setupCookieEvents } = require('./cookieManager');

app.whenReady().then(() => {
    // 创建主窗口
    const mainWindow = createMainWindow();

    // 设置全屏切换
    setupFullScreenToggle(mainWindow);

    // 设置Cookie事件
    setupCookieEvents(mainWindow);

    registerIpcHandlers();

    // 设置窗口显示事件
    setupWindowShowEvents(mainWindow);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});