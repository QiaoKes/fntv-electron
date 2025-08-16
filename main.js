// Modules to control application life and create native browser window
const { app, BrowserWindow, session, screen, ipcMain } = require('electron');
const path = require('node:path');
const { saveTokens, restoreCookie, SITE_URL } = require('./token');

let mainWindow;

function setHalfScreen() {
    // 设置窗口为初始大小并居中
    mainWindow.setSize(1200, 800);
    mainWindow.center();
    mainWindow.unmaximize(); // 确保不是最大化状态
}

function setFullScreen() {
    mainWindow.maximize();
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'icon.ico'),
        frame: false, // 隐藏原生标题栏
        transparent: true, // 窗口背景透明
        webPreferences: {
            webgl: true,
            partition: 'persist:fntv',
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // 添加 IPC 监听
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        mainWindow.isMaximized() ? setHalfScreen() : setFullScreen();
    });
    ipcMain.on('window-close', () => mainWindow.close());

    //   setFullScreen(); // 默认全屏

    const ses = session.fromPartition('persist:fntv');

    mainWindow.once('ready-to-show', async () => {
        await restoreCookie(ses);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        ses.cookies.get({ url: SITE_URL }).then(saveTokens);
        mainWindow.show(); // 网页加载完毕后显示窗口
    });

    mainWindow.webContents.on('did-navigate', () => {
        ses.cookies.get({ url: SITE_URL }).then(saveTokens);
    });

    mainWindow.webContents.on('did-navigate-in-page', () => {
        ses.cookies.get({ url: SITE_URL }).then(saveTokens);
    });

    mainWindow.loadURL(`${SITE_URL}/v`);

    // F11切换全屏/半屏
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

    // 禁止自由缩放窗口
    mainWindow.on('will-resize', (e) => {
        e.preventDefault();
    });

    // mainWindow.webContents.openDevTools()

    // app.getGPUInfo('complete').then(info => {
    //     console.log(JSON.stringify(info, null, 2));
    // });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});