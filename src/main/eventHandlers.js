const { ipcMain } = require('electron');
const { getMainWindow } = require('./windowManager');
const { setHalfScreen, setFullScreen } = require('./screenControl');
const playWithMpv = require('../modules/mpv/mpv');
const { SITE_URL } = require('../public/constants');
const fn = require('../modules/fn_api/api');

fnapi = new fn.apiService(SITE_URL); // 创建 fn_api 实例

// 窗口最小化处理函数
function handleMinimize() {
    ipcMain.on('window-minimize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) mainWindow.minimize();
    });
}

// 窗口最大化/还原处理函数
function handleMaximize() {
    ipcMain.on('window-maximize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            mainWindow.isMaximized() ? setHalfScreen() : setFullScreen();
        }
    });
}

// 窗口关闭处理函数
function handleClose() {
    ipcMain.on('window-close', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) mainWindow.close();
    });
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

// 播放电影处理函数
function handlePlayMovie() {
    ipcMain.on('play-movie', playMovie);
}

// 注册所有IPC处理器的聚合函数
function registerIpcHandlers() {
    handleMinimize();
    handleMaximize();
    handleClose();
    handlePlayMovie();
}

module.exports = {
    registerIpcHandlers,
};