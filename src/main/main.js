// Modules to control application life and create native browser window
const { app, BrowserWindow, session, screen, ipcMain } = require('electron');
const path = require('node:path');
const { saveTokens, restoreCookie, SITE_URL } = require('../modules/fn_token/token');
const fn = require('../modules/fn_api/api');
const playWithMpv = require('../modules/mpv/mpv');
const fs = require('fs');
const axios = require('axios'); // 引入 axios 库

fnapi = new fn.apiService(SITE_URL); // 创建 fn_api 实例

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
        width: 1400,
        height: 800,
        minWidth: 800,
        minHeight: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'build/icon.ico'),
        frame: false, // 隐藏原生标题栏
        transparent: true, // 窗口背景透明
        webPreferences: {
            webgl: true,
            partition: 'persist:fntv',
            preload: path.join(__dirname, '../preload/preload.js'),
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

    // mainWindow.webContents.openDevTools()
}


// 处理播放事件
async function playMovie(event, { itemGuid, token }) {
    console.log('Play movie event received:', itemGuid, token);

    subFiles = fnapi.getSubtitle(itemGuid, token).then(fnapi.downloadSubtitle).catch(error => {
        console.error('获取字幕文件失败:', error);
        return [];
    });

    // 获取播放信息
    fnapi.getPlayInfo(token, itemGuid).then(async response => {
        if (response.success) {
            // 等待字幕文件
            subs = await subFiles
            console.log('字幕文件已准备好:', subs);
            // 拼接字幕参数
            subArgs = '';
            if (subs.length > 0) {
                subArgs = subs.map(sub => `--sub-file=${sub}`).join(' ');
            }

            // console.log('Play event sent successfully:', response.data);
            // 配置播放参数（使用自定义路径和额外参数）
            playUrl = SITE_URL + '/v/api/v1/media/range/' + response.data.media_guid;
            last = response.data.ts;
            total = response.data.item.duration;
            console.log('Play URL:', playUrl, 'Last:', last, 'Total:', total);
            // 转为字符串+%
            p = last / total * 100 + '%';
            playWithMpv({
                url: playUrl,
                mpvPath: 'third_party\\mpv\\mpv.exe',
                headers: {
                    Authorization: token,
                },
                extraArgs: [
                    '--ontop',
                    '--start=' + p,
                    '--cache-secs=20', // 缓冲20秒，防止网络波动卡顿
                    subArgs,
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