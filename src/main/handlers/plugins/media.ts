import { BrowserWindow, IpcMainEvent } from 'electron';
import { MpvPlayer } from '../../../modules/players/impl/mpv';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';

/**
 * 媒体播放插件
 * 处理视频播放相关功能
 */

interface PlayRequest {
    id: string;
    token: string;
}

interface PlayStatus {
    item_guid: string;
    media_guid: string;
    video_guid: string;
    audio_guid: string;
    subtitle_guid: string;
    play_link: string;
    ts?: number;
    duration?: number;
}

interface Progress {
    percentage: number;
    currentSeconds: number;
    totalSeconds: number;
}

// 全局播放器实例引用
let currentPlayer: MpvPlayer | null = null;

// 刷新窗口
async function refreshWindow(): Promise<void> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.webContents.reload();
    }
}

// 处理播放事件
async function handlePlayMovie(event: IpcMainEvent, { id, token }: PlayRequest): Promise<void> {
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
        
        if (!response || !response.success || !response.data) {
            log.error('获取播放信息失败:', response ? response.message : '未知错误');
            return;
        }

        log.info('获取播放信息成功:', response.data);

        const mediaGuid = response.data.media_guid;
        const itemGuid = response.data.guid;

        // 获取字幕文件
        const subFiles = await fnapi.getSubtitle(itemGuid)
            .then(fnapi.downloadSubtitle)
            .catch((error: Error) => {
                log.error('获取字幕文件失败:', error);
                return [];
            });
        const subArgs = subFiles.map((sub: string) => `--sub-file=${sub}`).join(' ');

        // 计算起始播放位置百分比
        const playUrl = fnapi.getVideoUrl(mediaGuid);
        const last = response.data.ts;
        const total = response.data.item.duration;
        log.info('Play URL:', playUrl, ' Last:', last, ' Total:', total);
        
        const percentage = total <= 0 ? 0 : (last / total * 100);
        const startPosition = `${percentage}%`;

        const playStatus: PlayStatus = {
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
            onData: (progress: Progress) => {
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
            onError: (err: string) => log.error('MPV error:', err),
            onExit: (code: number | null, progress: Progress) => {
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
function handleBeforeQuit(): void {
    if (currentPlayer) {
        log.info('应用退出前关闭播放器');
        currentPlayer.stop();
        currentPlayer = null;
    }
}

// 注册媒体播放处理器
function init(): void {
    registerHandler('play-movie', handlePlayMovie);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

export {
    init
};
