const { BrowserWindow } = require('electron');
const MpvPlayer = require('../../../modules/mpv/mpv');
const fn = require('../../../modules/fn_api/api');
const fnConfig = require('../../../modules/fn_config/config');
const { registerHandler } = require('../core/ipcHandler');
const { registerAppHook } = require('../core/appHook');
const log = require('../../../modules/logger');

/**
 * 媒体播放插件
 * 处理视频播放相关功能
 */

// 全局播放器实例引用
let currentPlayer = null;

// 刷新窗口
async function refreshWindow() {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.webContents.reload();
    }
}

// 处理播放事件
async function handlePlayMovie(event, { id, token }) {
    // 检查是否已有播放器在播放
    if (currentPlayer && currentPlayer.isPlaying()) {
        log.warn('已有播放器在播放，无法重复播放');
        return;
    }

    log.info('Play movie event received id:', id, 'with token:', token);

    const config = fnConfig.readConfig();
    if (!config || !config.domain) {
        throw new Error('无法找到服务器地址配置');
    }

    const fnapi = new fn.apiService(config.domain, token);

    try {
        const response = await fnapi.getPlayInfo(id);
        
        if (!response || !response.success) {
            log.error('获取播放信息失败:', response ? response.message : '未知错误');
            return;
        }

        log.info('获取播放信息成功:', response.data);

        const mediaGuid = response.data.media_guid;
        const itemGuid = response.data.guid;

        // 获取字幕文件
        const subFiles = await fnapi.getSubtitle(itemGuid)
            .then(fnapi.downloadSubtitle)
            .catch(error => {
                log.error('获取字幕文件失败:', error);
                return [];
            });
        const subArgs = subFiles.map(sub => `--sub-file=${sub}`).join(' ');

        // 计算起始播放位置百分比
        const playUrl = fnapi.getVideoUrl(mediaGuid);
        const last = response.data.ts;
        const total = response.data.item.duration;
        log.info('Play URL:', playUrl, ' Last:', last, ' Total:', total);
        
        const percentage = total <= 0 ? 0 : (last / total * 100);
        const startPosition = `${percentage}%`;

        const playStatus = {
            item_guid: itemGuid,
            media_guid: mediaGuid,
            video_guid: response.data.video_guid,
            audio_guid: response.data.audio_guid,
            subtitle_guid: response.data.subtitle_guid,
            play_link: new URL(playUrl).pathname
        };

        // 构建标题
        let title = response.data.item.title;
        if (response.data.item.tv_title) {
            title = `${response.data.item.tv_title || ''} - S${response.data.item.season_number || ''}E${response.data.item.episode_number || ''}: ${response.data.item.title || ''}`;
        }

        // 创建播放器实例
        const player = new MpvPlayer({
            url: playUrl,
            mpvPath: 'third_party\\fntv-mpv\\mpv.exe',
            title: title,
            headers: {
                Authorization: token,
            },
            extraArgs: [
                '--force-window=immediate',
                `--start=${startPosition}`,
                '--cache-secs=20',
                subArgs
            ],
            debug: true,
            onData: (progress) => {
                if (progress.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    fnapi.setWatched(itemGuid);
                    return;
                }

                log.debug('当前播放进度:', progress);
                playStatus.ts = progress.currentSeconds;
                playStatus.duration = progress.totalSeconds;
                fnapi.recordPlayState(playStatus);
            },
            onError: (err) => log.error('MPV error:', err),
            onExit: (code, progress) => {
                if (code !== 0 && code !== null) {
                    log.error(`播放器异常退出 (code ${code})`);
                    refreshWindow();
                    return;
                }
                
                log.info('MPV exited with code:', code);
                log.info('最后播放位置:', progress);
                
                if (progress.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    fnapi.setWatched(itemGuid).then(refreshWindow);
                    return;
                }

                playStatus.ts = progress.currentSeconds;
                playStatus.duration = progress.totalSeconds;
                fnapi.recordPlayState(playStatus).then(refreshWindow);
            }
        });

        // 保存全局引用
        currentPlayer = player;

        // 开始播放
        player.play();
    } catch (error) {
        log.error('播放失败:', error);
    }
}

// 应用退出前清理播放器
function handleBeforeQuit() {
    if (currentPlayer) {
        log.info('应用退出前关闭播放器');
        currentPlayer.stop();
        currentPlayer = null;
    }
}

// 注册媒体播放处理器
function initMediaHandlers() {
    registerHandler('play-movie', handlePlayMovie);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

module.exports = {
    initMediaHandlers
};
