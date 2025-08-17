// Modules to control application life and create native browser window
const { app, BrowserWindow, session, screen, ipcMain } = require('electron');
const path = require('node:path');
const { saveTokens, restoreCookie, SITE_URL } = require('./token');
const { fnApi } = require('./fn_api');
const playWithMpv = require('./mpv');

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

async function createWindow() {
    // 预先恢复 Cookie
    const ses = session.fromPartition('persist:fntv');
    restoreCookie(ses).catch(console.error);


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
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // 添加 IPC 监听
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        mainWindow.isMaximized() ? setHalfScreen() : setFullScreen();
    });
    ipcMain.on('window-close', () => mainWindow.close());
    ipcMain.on('play-movie', playMovie);

    // 加载 URL
    mainWindow.loadURL(`${SITE_URL}/v`);

    // 页面加载完成时，保存 token
    const saveCookies = () => {
        ses.cookies.get({ url: SITE_URL }).then(saveTokens).catch(console.error);
    };
    mainWindow.webContents.on('did-navigate', saveCookies);
    mainWindow.webContents.on('did-navigate-in-page', saveCookies);
    mainWindow.webContents.on('did-finish-load', saveCookies);

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
    // mainWindow.on('will-resize', (e) => {
    //     e.preventDefault();
    // });

    // mainWindow.webContents.openDevTools()

    // app.getGPUInfo('complete').then(info => {
    //     console.log(JSON.stringify(info, null, 2));
    // });
}

function playMovie(event, { itemGuid, token }) {
    console.log('Play movie event received:', itemGuid, token);
    // 获取播放信息
    fnApi(SITE_URL, '/v/api/v1/play/info', token, {
        item_guid: itemGuid,
    }, 3).then(response => {
        if (response.success) {
            console.log('Play event sent successfully:', response.data);
            // 配置播放参数（使用自定义路径和额外参数）
            playUrl = SITE_URL + '/v/api/v1/media/range/' + response.data.media_guid;
            last = response.data.ts;
            total = response.data.item.duration;
            console.log('Play URL:', playUrl, 'Last:', last, 'Total:', total);
            // 转为字符串+%
            p = last / total * 100 + '%';
            playWithMpv({
                url: playUrl,
                mpvPath: 'third_party\\mpv\\mpvnet.exe',
                headers: {
                    Authorization: token,
                },
                extraArgs: [
                    '--ontop',
                    '--start=' + p,
                ],
                debug: true,
                onData: (data) => console.log('MPV output:', data),
                onError: (err) => console.error('MPV error:', err),
                onExit: (code) => console.log('MPV exited with code:', code)
            });
        } else {
            console.error('Failed to send play event:', response.message);
        }
    }).catch(error => {
        console.error('Error sending play event:', error);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});