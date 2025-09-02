import { BrowserWindow, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';

/**
 * 媒体播放插件
 * 处理视频播放相关功能
 */

interface PlayRequest {
    id: string;
    token: string;
}

// 全局播放器实例引用
let currentPlayer: ply.BasePlayer | null = null;

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

    const response = await fnapi.getPlayInfo(id);
    if (!response.success || !response.data) {
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

    const playStatus: fn.PlayStateData = {
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

    let playerPath = 'mpv'
    // Windows 平台使用特定路径
    if (os.platform() === 'win32') {
        playerPath = 'third_party\\fntv-mpv\\mpv.exe'
    }

    let playConfig: ply.Config = {
        url: playUrl,
        playerPath: playerPath,
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
        onEvent: (type: ply.EventType, data: ply.EventData) => {
            switch (type) {
                case ply.EventType.PROGRESS:
                    const progressData: ply.PlayStatusData = data as ply.PlayStatusData;
                    if (progressData.percentage > 90) {
                        log.info('视频播放接近结束，更新状态...');
                        fnapi.setWatched(itemGuid);
                        return;
                    }

                    playStatus.ts = progressData.currentSeconds;
                    playStatus.duration = progressData.totalSeconds;
                    fnapi.recordPlayState(playStatus);
                    break;

                case ply.EventType.ERROR:
                    const errorData: ply.PlayErrorData = data as ply.PlayErrorData;
                    log.error('MPV error:', errorData.message);
                    break;

                case ply.EventType.EXIT:
                    const event = data as ply.PlayExitData;
                    if (event.code !== 0) {
                        log.error(`播放器异常退出 (code ${event.code})`);
                        refreshWindow();
                        return;
                    }

                    log.info('MPV exited with code:', event.code);
                    log.info('最后播放位置:', event.status);

                    if (event.status.percentage > 90) {
                        log.info('视频播放接近结束，更新状态...');
                        fnapi.setWatched(itemGuid).then(refreshWindow);
                        return;
                    }

                    playStatus.ts = event.status.currentSeconds;
                    playStatus.duration = event.status.totalSeconds;
                    fnapi.recordPlayState(playStatus).then(refreshWindow);
                    break;

                default:
                    log.debug('收到播放器事件:', type);
                    break;
            }
        }
    }

    // 创建播放器实例
    const player = ply.PlayerFactory.createPlayer(ply.PlayerType.MPV, playConfig);

    // 保存全局引用
    currentPlayer = player;

    // 开始播放
    player.play();
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
