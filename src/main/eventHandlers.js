const { ipcMain } = require('electron');
const { getMainWindow } = require('./windowManager');
const { setHalfScreen, setFullScreen } = require('./screenControl');
const MpvPlayer = require('../modules/mpv/mpv');
const { SITE_URL } = require('../public/constants');
const fn = require('../modules/fn_api/api');

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
    console.log('Play movie event received:', itemGuid, 'with token:', token);

    fnapi = new fn.apiService(SITE_URL, token);

    subFiles = await fnapi.getSubtitle(itemGuid).then(fnapi.downloadSubtitle).catch(error => {
        console.error('获取字幕文件失败:', error);
        return [];
    });
    subArgs = subFiles.map(sub => `--sub-file=${sub}`).join(' ');

    response = await fnapi.getPlayInfo(itemGuid)
        .catch(error => {
            console.error('获取播放信息失败:', error);
            return null;
        });

    if (!response || !response.success) {
        console.error('获取播放信息失败:', response ? response.message : '未知错误');
        return;
    }

    console.log('获取播放信息成功:', response.data);

    mediaGuid = response.data.media_guid;

    // 计算起始播放位置百分比
    const playUrl = fnapi.getVideoUrl(mediaGuid);
    last = response.data.ts;
    total = response.data.item.duration;
    console.log('Play URL:', playUrl, 'Last:', last, 'Total:', total);
    if (total <= 0) {
        percentage = 0;
    } else {
        percentage = last / total * 100;
    }
    
    const startPosition = `${percentage}%`;

    playStatus = {
        item_guid: itemGuid,
        media_guid: mediaGuid,
        video_guid: response.data.video_guid,
        audio_guid: response.data.audio_guid,
        subtitle_guid: response.data.subtitle_guid,
        play_link: new URL(playUrl).pathname
    }

    title = `${response.data.item.tv_title || ''} - S${response.data.item.season_number || ''}E${response.data.item.episode_number || ''}: ${response.data.item.title || ''}`
    // 创建播放器实例
    const player = new MpvPlayer({
        url: playUrl,
        mpvPath: 'third_party\\mpv\\mpv.exe',
        title: title,
        headers: {
            Authorization: token,
        },
        extraArgs: [
            // '--ontop',
            `--start=${startPosition}`, // 设置起始播放位置
            '--cache-secs=20', // 缓冲20秒，防止网络波动卡顿
            subArgs // 添加所有字幕文件参数
        ],
        debug: true,
        onData: (progress) => {
            if (progress.percentage > 90) {
                console.log('视频播放接近结束，更新状态...');
                fnapi.setWatched(itemGuid);
                return;
            }

            console.log('当前播放进度:', progress);
            playStatus.ts = progress.currentSeconds;
            playStatus.duration = progress.totalSeconds;
            fnapi.recordPlayState(playStatus);
        },
        onError: (err) => console.error('MPV error:', err),
        onExit: (code, progress) => {
            if (code !== 0 && code !== null) {
                console.error(`播放器异常退出 (code ${code})`);
                return;
            }
            console.log('MPV exited with code:', code);
            console.log('最后播放位置:', progress);
            if (progress.percentage > 90) {
                console.log('视频播放接近结束，更新状态...');
                fnapi.setWatched(itemGuid);
                return;
            }

            playStatus.ts = progress.currentSeconds;
            playStatus.duration = progress.totalSeconds;
            fnapi.recordPlayState(playStatus);
        }
    });

    // 开始播放
    player.play();

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