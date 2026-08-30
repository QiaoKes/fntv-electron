import { app, BrowserWindow, dialog, IpcMainEvent } from 'electron';
import * as ply from '../../../modules/players';
import * as fn from '../../../modules/fn_api/api';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import { registerAppHook } from '../core/appHook';
import * as log from '../../../modules/logger';
import * as os from 'os';
import * as fs from 'fs';
import { PlayStatusData, ItemListRequest } from '../../../modules/fn_api/types';
import { isTrusted } from '../../../modules/cert_trust';
import { checkLibraryPageUrl } from '../../common/utils';
import { getMainWindow } from '../../common/mainwin';
import { getMpvConfigDir } from './mpvConfig';
import { resolveBundledMpvPath } from '../../common/mpvConfigHelpers';
import { getProxySecret } from '../../common/proxy';
import { createProxyPlaybackUrl, registerPlaybackSession } from '../../common/proxySession';
import { getAccessCookieHeader } from '../../../modules/fn_api/accessGrant';
import { isNearEnd } from '../../../modules/playback/nearEnd';

/**
* 媒体播放插件
* 处理视频播放相关功能
*/
interface PlayRequest {
    id: string;
    sourceIndex: number; // 可选，播放源
}

// 全局播放器实例引用
let currentPlayer: ply.BasePlayer | null = null;
let playbackStarting = false;

// MPV播放器路径缓存
let cachedPlayerPath: string | null = null;

// 设置MPV播放器路径（用于覆盖默认路径）
export function setMpvPlayerPath(path: string | null): void {
    cachedPlayerPath = path;
}

/**
 * 获取MPV播放器路径（带缓存）
 * @returns 播放器路径或undefined
 */
function getMpvPlayerPath(): string | undefined {
    // 如果已经缓存了路径，直接返回
    if (cachedPlayerPath) {
        return cachedPlayerPath;
    }

    const platform = os.platform();

    if (platform === 'win32') {
        cachedPlayerPath = resolveBundledMpvPath({
            appPath: app.getAppPath(),
            execPath: process.execPath,
            isPackaged: app.isPackaged,
        });
        return cachedPlayerPath;
    } else if (platform === 'darwin') {
        // macOS 常用安装路径
        const macPaths = [
            '/opt/homebrew/bin/mpv',  // Apple Silicon Mac (M1/M2)
            '/usr/local/bin/mpv',     // Intel Mac 或手动安装
            '/Applications/mpv.app/Contents/MacOS/mpv', // App bundle
        ];

        for (const path of macPaths) {
            if (fs.existsSync(path)) {
                cachedPlayerPath = path;
                log.info(`找到MPV播放器路径: ${path}`);
                return cachedPlayerPath;
            }
        }

        // 未找到mpv播放器
        dialog.showErrorBox('错误', 'macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
        log.error('macOS平台未找到mpv播放器，请使用Homebrew安装mpv后重试: brew install mpv');
        return undefined;
    } else if (platform === 'linux') {
        // Linux 常用安装路径
        const linuxPaths = [
            '/usr/bin/mpv',           // 系统包管理器安装
            '/usr/local/bin/mpv',     // 手动编译安装
            '/snap/bin/mpv',          // Snap 包
            '/usr/games/mpv',         // 某些发行版
            '/opt/mpv/bin/mpv',       // 可选安装位置
        ];

        for (const path of linuxPaths) {
            if (fs.existsSync(path)) {
                cachedPlayerPath = path;
                log.info(`找到MPV播放器路径: ${path}`);
                return cachedPlayerPath;
            }
        }

        // 未找到mpv播放器
        dialog.showErrorBox('错误', 'Linux平台未找到mpv播放器，请安装mpv播放器后重试');
        log.error('Linux平台未找到mpv播放器，请安装mpv播放器后重试');
        return undefined;
    }

    return undefined;
}

// 刷新窗口
async function refreshWindow(): Promise<void> {
    const currentURL = getMainWindow().webContents.getURL() || '';
    // 如果是资源库页面则不刷新
    if (checkLibraryPageUrl(currentURL)) {
        return;
    }

    log.info('刷新当前窗口');
    getMainWindow().webContents.reloadIgnoringCache();
}

/**
 * 上报一次播放进度记录（进度更新与播放项结束共用同一份记录结构）。
 *
 * 进度上报属于外部依赖：查询播放信息或写入记录失败时只记日志并返回 false，
 * 不抛出、不重试、不提示用户，避免影响播放。
 *
 * @param fnapi - API服务实例
 * @param status - 播放状态快照
 * @returns 是否上报成功
 */
async function reportPlayRecord(fnapi: fn.ApiService, status: ply.PlayStatusData): Promise<boolean> {
    try {
        // 优先从缓存查询播放信息
        const resp = await fnapi.getPlayInfoCached(status.itemGuid);
        if (!resp.success || !resp.data) {
            log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
            return false;
        }

        const info = resp.data;

        const record: fn.PlayStatusData = {
            item_guid: status.itemGuid,
            media_guid: info.media_guid,
            video_guid: info.video_guid,
            audio_guid: info.audio_guid,
            subtitle_guid: info.subtitle_guid,
            play_link: new URL(fnapi.getVideoUrl(info.media_guid)).hostname,
            ts: status.ts,
            duration: status.duration,
        };

        log.info('播放进度更新:', record);

        const recorded = await fnapi.recordPlayStatus(record);
        if (!recorded.success) {
            log.error('记录播放状态失败:', recorded.message || '未知错误');
            return false;
        }
        return true;
    } catch (err) {
        log.error('记录播放状态异常:', err instanceof Error ? err.message : String(err));
        return false;
    }
}

/**
 * 播放项结束时的收尾处理：先上报最终播放进度，再判定是否标记为已观看。
 *
 * 顺序不可颠倒：已观看必须后写，否则可能被随后的进度记录覆盖，导致服务端出现
 * 「标了已观看但进度停在一半」的不一致。
 *
 * 两步彼此独立：进度上报失败（例如断网、缓存未命中）不会阻止已观看判定，
 * 因为该判定只依赖播放器实测的 ts / duration，不需要服务端返回的播放信息。
 *
 * 整条收尾链路只记日志、不抛异常：不重试、不提示用户、不影响播放。
 *
 * @param fnapi - API服务实例
 * @param status - 被离开的播放项的最终播放状态快照
 */
async function finishPlayItem(fnapi: fn.ApiService, status: ply.PlayStatusData): Promise<void> {
    if (status.itemGuid.length === 0) {
        return;
    }

    // 先尝试上报最终进度，成功与否都继续判定已观看
    await reportPlayRecord(fnapi, status);

    if (!isNearEnd(status.ts, status.duration)) {
        return;
    }

    try {
        const watchedResp = await fnapi.setWatched(status.itemGuid);
        if (!watchedResp.success) {
            log.error('标记已观看失败:', watchedResp.message || '未知错误');
            return;
        }
        log.info('已标记为已观看:', status.itemGuid);
    } catch (err) {
        log.error('标记已观看异常:', err instanceof Error ? err.message : String(err));
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

                await reportPlayRecord(fnapi, progressData);
                break;

            case ply.EventType.ITEM_END:
                // 播放器只报告"这一项结束了"，是否算已观看在这里判定
                const endedItem = data as ply.PlayStatusData;
                log.info('播放项结束:', endedItem);
                await finishPlayItem(fnapi, endedItem);
                break;

            case ply.EventType.ERROR:
                const errorData = data as ply.PlayErrorData;
                log.error('MPV error:', String(errorData.message));
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

                await finishPlayItem(fnapi, event.status);

                // 正常退出只回传最终进度与已观看状态；整页刷新会造成主窗口白闪。
                break;

            default:
                log.debug('收到播放器事件:', type);
                break;
        }
    };
}

// 处理播放事件
async function handlePlayMovie(_event: IpcMainEvent, request: PlayRequest): Promise<void> {
    if (playbackStarting || currentPlayer?.isPlaying()) {
        log.warn('播放器正在启动或播放，忽略重复播放请求');
        return;
    }

    playbackStarting = true;
    try {
        await startPlayback(request);
    } finally {
        playbackStarting = false;
    }
}

async function startPlayback({ id, sourceIndex }: PlayRequest): Promise<void> {
    log.info('Play movie event received id:', id, ' index:', sourceIndex);

    const config = fnConfig.readConfig();
    if (!config?.domain || !config.token || !config.account) {
        throw new Error('无法找到有效的服务器登录配置');
    }

    // 播放凭据只取自主进程安全配置，不信任远程页面传入的 token。
    const fnapi = new fn.ApiService(config.domain, config.token);

    const response = await fnapi.getPlayInfo(id);
    if (!response.success || !response.data) {
        log.error('获取播放信息失败:', response ? response.message : '未知错误');
        return;
    }

    log.info('获取播放信息成功:', {
        guid: response.data.guid,
        type: response.data.type,
        parent_guid: response.data.parent_guid || '',
    });

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
            log.info('添加剧集到播放列表:', mediaItem.itemGuid);
        }
    } 
    else if (type === 'Video' && parentGuid) {
        log.info('当前为其他视频，添加到播放列表');
        const req: ItemListRequest = {
            parent_guid: parentGuid,
            exclude_folder: 1,
            sort_column: 'sort_title',
            sort_type: 'ASC',
        };

        const mediaList = await fnapi.getItemList(req);
        if (!mediaList.success || !mediaList.data || !mediaList.data.list) {
            log.error('获取媒体列表失败:', mediaList ? mediaList.message : '未知错误');
            return;
        }
        log.info(`获取媒体列表成功，共 ${mediaList.data.list.length} 项`);

        for (const media of mediaList.data.list) {
            const mediaItem = processEpisodeMedia(media);
            playList.push(mediaItem);
            log.info('添加媒体到播放列表:', mediaItem.itemGuid);
        }
    }
    else {
        const mediaItem = processSingleMedia(response.data);
        playList.push(mediaItem);
        log.info('添加单集到播放列表:', mediaItem.itemGuid);
    }

    if (playList.length === 0) {
        log.warn('播放列表为空');
        return;
    }

    // 寻找当前播放的媒体在数组中的位置
    const currentIndex = playList.findIndex(item => item.itemGuid === itemGuid);
    if (currentIndex < 0) {
        throw new Error('当前播放项不在生成的播放列表中');
    }

    const session = await registerPlaybackSession(getProxySecret(), {
        token: config.token,
        account: config.account,
        domain: config.domain,
        accessCookie: getAccessCookieHeader(config.domain),
        skipVerify: isTrusted(config.domain),
        useNasLocal: config.nasProxyEnabled === true,
        itemGuids: playList.map(item => item.itemGuid),
    });
    playList = playList.map(item => ({
        ...item,
        playLink: createProxyPlaybackUrl(session, item.itemGuid),
    }));

    // 检查是否选择了特定的播放源索引
    const selectedSourceIndex = Number.isInteger(sourceIndex) && sourceIndex > 0 ? sourceIndex : 0;
    if (selectedSourceIndex > 0) {
        log.info(`使用指定的播放源索引: ${selectedSourceIndex}`);
        // 修改播放列表中的源索引
        playList[currentIndex].playLink = createProxyPlaybackUrl(
            session,
            playList[currentIndex].itemGuid,
            selectedSourceIndex,
        );
    }

    // 获取MPV播放器路径
    const playerPath = getMpvPlayerPath();
    if (!playerPath) {
        log.error('无法找到MPV播放器路径');
        return;
    }

    const mpvArgs = [
        '--force-window=immediate',
        '--border=no',
        '--network-timeout=180',
        `--volume=${fnConfig.getMpvVolume()}`,
    ];
    if (os.platform() === 'win32' && !fnConfig.getMpvPlayerPath()) {
        // bundled mpv.exe 自带 portable_config；显式指向用户目录，避免状态写入安装目录。
        mpvArgs.push(`--config-dir=${getMpvConfigDir()}`);
    }

    let playConfig: ply.Config = {
        fnapi: fnapi,
        playerPath: playerPath,
        // headers: {
        //     Authorization: token,
        // },
        extraArgs: mpvArgs,
        debug: true,
        onEvent: eventHandler(fnapi),
        onVolumeChange: fnConfig.setMpvVolume,
    };

    // 创建播放器实例
    const player = ply.PlayerFactory.createPlayer(ply.PlayerType.MPV, playConfig);

    // 保存全局引用
    currentPlayer = player;

    // 开始播放
    const started = await player.playList(playList, currentIndex);
    if (!started && currentPlayer === player) {
        currentPlayer = null;
        return;
    }
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
        playLink: '',
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
        playLink: '',
    };
}

// 应用退出前清理播放器
function handleBeforeQuit(): void {
    if (currentPlayer) {
        log.info('应用退出前关闭播放器');
        currentPlayer.stop();
        currentPlayer = null;
    }

    // 清理播放器路径缓存
    cachedPlayerPath = null;
}

// 注册媒体播放处理器
function init(): void {
    // 从配置中读取MPV播放器路径并设置
    const configMpvPath = fnConfig.getMpvPlayerPath();
    if (configMpvPath) {
        setMpvPlayerPath(configMpvPath);
        log.info(`从配置中加载MPV播放器路径: ${configMpvPath}`);
    }

    registerHandler('play-movie', handlePlayMovie);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

export {
    init
};
