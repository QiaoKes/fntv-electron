import { BrowserWindow, dialog, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';
import * as fs from 'fs';
import { PlayStatusData } from '../../../modules/fn_api/types';
import { escape } from 'querystring';
import * as proxyModule from '../../../modules/proxy';

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
    title: string;
    tvTitle: string;
    seasonNumber: number;
    episodeNumber: number;
    ts: number;
    duration: number;
}

// 全局播放器实例引用
let currentPlayer: ply.BasePlayer | null = null;

// 刷新窗口
async function refreshWindow(): Promise<void> {
    try {
        const allWindows = BrowserWindow.getAllWindows();
        
        // 刷新所有窗口
        for (const window of allWindows) {
            if (!window.isDestroyed()) {
                // 直接重新加载页面，忽略缓存
                window.webContents.reloadIgnoringCache();
                log.info(`窗口 ${window.id} 重新加载成功`);
            }
        }
        
    } catch (error) {
        log.error('刷新窗口失败:', error);
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

                if (progressData.itemGuid.length === 0) {
                    log.info("process itemguid is empty")
                    return;
                }

                if (progressData.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    await fnapi.setWatched(progressData.itemGuid);
                    return;
                }
                // 优先从缓存查询播放信息
                const resp = await proxyModule.getPlayInfoCacheByGuid(progressData.itemGuid);
                if (resp.code !== 0 || !resp.data) {
                    log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                    return;
                }

                const info = resp.data.playInfo;

                const record: fn.PlayStatusData = {
                    item_guid: progressData.itemGuid,
                    media_guid: info.media_guid,
                    video_guid: info.video_guid,
                    audio_guid: info.audio_guid,
                    subtitle_guid: info.subtitle_guid,
                    play_link: new URL(fnapi.getVideoUrl(info.media_guid)).hostname,
                    ts: progressData.ts,
                    duration: progressData.duration,
                };

                await fnapi.recordPlayStatus(record);
                break;

            case ply.EventType.ERROR:
                const errorData = data as ply.PlayErrorData;
                log.error('MPV error:', errorData.message);
                // 等待50ms
                await new Promise(resolve => setTimeout(resolve, 50));
                await refreshWindow();
                break;

            case ply.EventType.EXIT:
                const event = data as ply.PlayExitData;
                if (event.code !== 0) {
                    log.error(`播放器异常退出 (code ${event.code})`);
                    await new Promise(resolve => setTimeout(resolve, 50));
                    await refreshWindow();
                    return;
                }

                if (event.status.itemGuid.length === 0) {
                    return;
                }

                log.info('MPV exited with code:', event.code);
                log.info('最后播放位置:', event.status);

                if (event.status.percentage > 90) {
                    log.info('视频播放接近结束，更新状态...');
                    await fnapi.setWatched(event.status.itemGuid);
                } else {
                    // 优先从缓存查询播放信息
                    const resp = await proxyModule.getPlayInfoCacheByGuid(event.status.itemGuid);
                    if (resp.code !== 0 || !resp.data) {
                        log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                        return;
                    }

                    const info = resp.data.playInfo;

                    const record: fn.PlayStatusData = {
                        item_guid: event.status.itemGuid,
                        media_guid: info.media_guid,
                        video_guid: info.video_guid,
                        audio_guid: info.audio_guid,
                        subtitle_guid: info.subtitle_guid,
                        play_link: new URL(fnapi.getVideoUrl(info.media_guid)).hostname,
                        ts: event.status.ts,
                        duration: event.status.duration,
                    };

                    await fnapi.recordPlayStatus(record);
                }

                // 等待50ms
                await new Promise(resolve => setTimeout(resolve, 50));
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
            const mediaItem = processEpisodeMedia(episode);
            playList.push(mediaItem);
            log.info('添加剧集到播放列表:', mediaItem);
        }
    } else {
        const mediaItem = processSingleMedia(response.data);
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
    } else if (os.platform() === 'darwin') {
        playerPath = '/opt/homebrew/bin/mpv';
        if (!fs.existsSync(playerPath)) {
            // 弹窗提示使用brew安装
            dialog.showErrorBox('错误', 'macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
            log.error('macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
            return;
        }
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
function processEpisodeMedia(info: fn.PlayListItem): ply.PlayItem {
    return {
        itemGuid: info.guid,
        title: info.title,
        tvTitle: info.tv_title,
        seasonNumber: info.season_number,
        episodeNumber: info.episode_number,
        ts: info.ts,
        duration: info.duration,
        playLink: proxyModule.getProxyUrl(info.guid),
    };
}

// 处理单个待播放媒体信息
function processSingleMedia(info: fn.PlayInfo): ply.PlayItem {
    return {
        itemGuid: info.guid,
        title: info.item.title,
        tvTitle: info.item.tv_title,
        seasonNumber: info.item.season_number,
        episodeNumber: info.item.episode_number,
        ts: info.ts,
        duration: info.item.duration,
        playLink: proxyModule.getProxyUrl(info.guid),
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
