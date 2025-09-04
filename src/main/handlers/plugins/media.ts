import { BrowserWindow, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';
import { PlayStatusData } from '../../../modules/fn_api/types';
import { escape } from 'querystring';

/**
* 媒体播放插件
* 处理视频播放相关功能
*/
interface PlayRequest {
    id: string;
    token: string;
}

// 播放信息
type MediaInfo = {
    itemGuid: string;
    title?: string;
    tvTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
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
                const progressData = data as ply.PlayStatusData;
                if (progressData.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    await fnapi.setWatched(progressData.item_guid);
                    return;
                }

                await fnapi.recordPlayStatus(progressData);
                break;

            case ply.EventType.ERROR:
                const errorData = data as ply.PlayErrorData;
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
                    await fnapi.setWatched(event.status.item_guid);
                } else {
                    await fnapi.recordPlayStatus(event.status);
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

    let playList: ply.PlayItem[] = [];
    if (type === 'Episode' && parentGuid) {
        log.info('当前为剧集，尝试获取系列下的所有剧集进行播放');
        const episodeList = await fnapi.getEpisodeList(parentGuid);
        if (!episodeList.success || !episodeList.data) {
            log.error('获取剧集列表失败:', episodeList ? episodeList.message : '未知错误');
            return;
        }

        for (const episode of episodeList.data) {
            // 当前剧集特殊处理
            if (episode.guid === itemGuid) {
                const mediaItem = await processCurrentMedia(fnapi, response.data);
                if (!mediaItem) {
                    log.warn('处理当前剧集失败:', response.data);
                    return;
                }
                log.info('添加当前剧集到播放列表:', mediaItem);
                playList.push(mediaItem);
                continue;
            }

            const info = {
                itemGuid: episode.guid,
                title: episode.title,
                tvTitle: episode.tv_title,
                seasonNumber: episode.season_number,
                episodeNumber: episode.episode_number,
            } as MediaInfo;

            const mediaItem = await processSingleMedia(fnapi, info);
            if (!mediaItem) {
                log.warn('处理剧集失败:', episode);
                continue;
            }
            playList.push(mediaItem);
            log.info('添加剧集到播放列表:', mediaItem);
        }
    } else {
        const mediaItem = await processCurrentMedia(fnapi, response.data);
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

    let playerPath = undefined;
    // Windows 平台使用本地文件路径
    if (os.platform() === 'win32') {
        playerPath = 'third_party\\fntv-mpv\\mpv.exe';
    }

    let playConfig: ply.Config = {
        fnapi: fnapi,
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
    player.playList(playList, currentIndex);
}

// 处理当前播放的媒体信息
async function processCurrentMedia(fnapi: fn.ApiService, info: fn.PlayInfo): Promise<ply.PlayItem> {
    // 计算起始播放位置百分比
    const last = info.ts;
    const total = info.item.duration;
    const percentage = total <= 0 ? 0 : (last / total * 100);

    // 获取字幕文件
    const subFiles = await fnapi.getSubtitle(info.item.guid)
        .then(fnapi.downloadSubtitle)
        .catch((error: Error) => {
            log.error('获取字幕文件失败:', error);
            return [];
        });

    let ret: ply.PlayItem = {
        itemGuid: info.guid,
        mediaGuid: info.media_guid,
        tvTitle: info.item.tv_title,
        seasonNumber: info.item.season_number,
        episodeNumber: info.item.episode_number,
        title: info.item.title,
        videoGuid: info.video_guid,
        audioGuid: info.audio_guid,
        subtitleGuid: info.subtitle_guid,
        playLink: fnapi.getVideoUrl(info.media_guid),
        subtitles: subFiles,
        ts: last,
        duration: total,
        percentage: percentage,
    };

    return ret;
}

// 处理单个待播放媒体信息
function processSingleMedia(fnapi: fn.ApiService, info: MediaInfo): ply.PlayItem {
    return {
        itemGuid: info.itemGuid,
        tvTitle: info.tvTitle,
        seasonNumber: info.seasonNumber,
        episodeNumber: info.episodeNumber,
        title: info.title,
    };
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
