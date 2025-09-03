import { BrowserWindow, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';
import { PlayStateData } from '../../../modules/fn_api/types';

// 媒体信息
type MediaInfo = {
    itemGuid: string;
    tvTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    title: string;
}

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

/**
 * 创建播放状态数据对象
 * @param progressData - 播放进度数据
 * @returns PlayStateData 对象
 */
function createPlayStateData(progressData: ply.PlayStatusData): PlayStateData {
    return {
        item_guid: progressData.itemGuid,
        media_guid: progressData.mediaGuid,
        video_guid: progressData.videoGuid,
        audio_guid: progressData.audioGuid,
        subtitle_guid: progressData.subtitleGuid,
        play_link: progressData.playLink,
        ts: progressData.currentSeconds,
        duration: progressData.totalSeconds
    };
}

// 刷新窗口
async function refreshWindow(): Promise<void> {
    const focusedWindow = BrowserWindow.getFocusedWindow();
    if (focusedWindow) {
        focusedWindow.webContents.reload();
    }
}

/**
 * 创建播放器事件处理器
 * @param fnapi - API服务实例
 * @param itemGuid - 当前播放项的GUID
 * @returns 事件处理函数
 */
function eventHandler(fnapi: fn.ApiService) {
    return async (type: ply.EventType, data: ply.EventData) => {
        switch (type) {
            case ply.EventType.PROGRESS:
                const progressData: ply.PlayStatusData = data as ply.PlayStatusData;
                if (progressData.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    await fnapi.setWatched(progressData.itemGuid);
                    return;
                }

                const st1 = createPlayStateData(progressData);
                await fnapi.recordPlayState(st1);
                break;

            case ply.EventType.ERROR:
                const errorData: ply.PlayErrorData = data as ply.PlayErrorData;
                log.error('MPV error:', errorData.message);
                // 等待200ms
                await new Promise(resolve => setTimeout(resolve, 200));
                await refreshWindow();
                break;

            case ply.EventType.EXIT:
                const event = data as ply.PlayExitData;
                if (event.code !== 0) {
                    log.error(`播放器异常退出 (code ${event.code})`);
                    await new Promise(resolve => setTimeout(resolve, 200));
                    await refreshWindow();
                    return;
                }

                log.info('MPV exited with code:', event.code);
                log.info('最后播放位置:', event.status);

                if (event.status.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    await fnapi.setWatched(event.status.itemGuid);
                } else {
                    const st2 = createPlayStateData(event.status);
                    await fnapi.recordPlayState(st2);
                }

                // 等待200ms
                await new Promise(resolve => setTimeout(resolve, 200));
                await refreshWindow();
                break;

            default:
                log.debug('收到播放器事件:', type);
                break;
        }
    };
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

    const fnapi = new fn.ApiService(config.domain, token);

    const response = await fnapi.getPlayInfo(id);
    if (!response.success || !response.data) {
        log.error('获取播放信息失败:', response ? response.message : '未知错误');
        return;
    }

    log.info('获取播放信息成功:', response.data);

    const type = response.data.type;
    const parentGuid = response.data.parent_guid;
    const itemGuid = response.data.guid;

    // todo: 没找到接口批量获取，只能多次调用，有点挫
    let playList: ply.PlayItem[] = [];
    if (type === 'Episode' && parentGuid) {
        log.info('当前为剧集，尝试获取系列下的所有剧集进行播放');
        const episodeList = await fnapi.getEpisodeList(parentGuid);
        if (episodeList && episodeList.data) {
            for (const episode of episodeList.data) {
                log.info('处理剧集:', episode);
                const mediaItem = await processSingleMedia(fnapi, episode.guid);
                if (!mediaItem) {
                    log.warn('处理剧集失败:', episode);
                    continue;
                }
                playList.push(mediaItem);
                log.info('添加剧集到播放列表:', mediaItem);
            }
        } else {
            log.warn('未获取到剧集列表');
        }
    } else {
        const mediaItem = await processSingleMedia(fnapi, itemGuid);
        if (!mediaItem) {
            log.warn('处理单集失败:', itemGuid);
            return;
        }
        playList.push(mediaItem);
        log.info('添加单集到播放列表:', mediaItem);
    }

    if (playList.length === 0) {
        log.warn('播放列表为空');
        return;
    }

    // 寻找当前播放的媒体在数组中的位置
    const currentIndex = playList.findIndex(item => item.itemGuid === itemGuid);

    // 计算起始播放位置百分比
    const last = response.data.ts;
    const total = response.data.item.duration;

    const percentage = total <= 0 ? 0 : (last / total * 100);
    const startPosition = `${percentage}%`;

    let playerPath = undefined;
    // Windows 平台使用特定路径
    if (os.platform() === 'win32') {
        playerPath = 'third_party\\fntv-mpv\\mpv.exe';
    }

    let playConfig: ply.Config = {
        playerPath: playerPath,
        headers: {
            Authorization: token,
        },
        extraArgs: [
            '--force-window=immediate',
        ],
        debug: true,
        onEvent: eventHandler(fnapi)
    };

    // 创建播放器实例
    const player = ply.PlayerFactory.createPlayer(ply.PlayerType.MPV, playConfig);

    // 保存全局引用
    currentPlayer = player;

    // 开始播放
    player.playList(playList, currentIndex, [`--start=${startPosition}`]);
}

// 处理单个媒体信息
async function processSingleMedia(fnapi: fn.ApiService, itemGuid: string): Promise<ply.PlayItem | null> {
    const resp = await fnapi.getPlayInfo(itemGuid);
    if (!resp.success || !resp.data) {
        log.error('获取播放信息失败:', resp.message);
        return null;
    }
    const data = resp.data;
    // 构建标题
    let title = data.item.title;
    if (data.item.tv_title) {
        title = `${data.item.tv_title || ''} - S${data.item.season_number || ''}E${data.item.episode_number || ''}: ${data.item.title || ''}`;
    }

    // 补充一个item_id用于区分当前是哪个视频
    title = `${title}@${itemGuid}`;

    // 获取字幕文件
    const subFiles = await fnapi.getSubtitle(itemGuid)
        .then(fnapi.downloadSubtitle)
        .catch((error: Error) => {
            log.error('获取字幕文件失败:', error);
            return [];
        });

    let ret: ply.PlayItem = {
        itemGuid: itemGuid,
        title: title,
        mediaGuid: data.media_guid,
        videoGuid: data.video_guid,
        audioGuid: data.audio_guid,
        subtitleGuid: data.subtitle_guid,
        playLink: fnapi.getVideoUrl(data.media_guid),
        // playLink: data.media_guid,
        subtitles: subFiles
    };

    return ret;
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
