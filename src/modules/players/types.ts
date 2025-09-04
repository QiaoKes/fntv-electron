import * as fn from '../fn_api/api';

// 播放器事件类型枚举
export enum EventType {
    PROGRESS = 'progress',
    ERROR = 'error',
    EXIT = 'exit',
}

// 单个播放源信息(非当前播放只需要传itemGuid)
export interface PlayItem {
    itemGuid: string;
    mediaGuid?: string;
    tvTitle?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    title?: string;
    videoGuid?: string;
    audioGuid?: string;
    subtitleGuid?: string;
    playLink?: string;
    subtitles?: string[];
    ts?: number;
    duration?: number;
    percentage?: number;
}

export type PlayStatusData = fn.PlayStatusData & { percentage: number };

// 播放器退出数据接口
export type PlayExitData = {
    code: number;
    status: PlayStatusData;
}

// 播放器错误数据接口
export type PlayErrorData = {
    message: string;
}

// 播放器事件数据类型
export type EventData = PlayStatusData | PlayExitData | PlayErrorData;

// 事件处理器类型
export type EventHandler = (type: EventType, data: EventData) => void;

// 播放器配置接口
export type Config = {
    headers?: Record<string, string>;
    debug?: boolean;
    extraArgs?: string[];
    playerPath?: string;
    fnapi: fn.ApiService;
    onEvent: EventHandler;
}

// 播放器类型枚举
export enum PlayerType {
    MPV = 'mpv',
    // 可以扩展其他播放器类型
}

// 播放器抽象基类
export abstract class BasePlayer {
    protected config: Required<Config>;
    protected globalStatus: PlayStatusData = {
        item_guid: '',
        media_guid: '',
        video_guid: '',
        audio_guid: '',
        subtitle_guid: '',
        play_link: '',
        ts: 0,
        duration: 0,
        percentage: 0,
    };

    constructor(config: Config) {
        // 设置默认配置
        this.config = {
            headers: config.headers || {},
            debug: config.debug || false,
            extraArgs: config.extraArgs || [],
            playerPath: config.playerPath || '',
            onEvent: config.onEvent,
            fnapi: config.fnapi
        };
    }

    // 播放列表
    abstract playList(infos: PlayItem[], pos: number, args?: string[]): Promise<boolean>;

    // 停止播放
    abstract stop(): void;

    // 判断播放器是否正在播放
    abstract isPlaying(): boolean;

    // 获取当前播放状态
    protected getStatus(): PlayStatusData {
        return this.globalStatus;
    }

    // 事件发射方法
    protected emitEvent(type: EventType, event: EventData): void {
        this.config.onEvent(type, event);
    }

    // 更新全局播放状态
    protected updateGlobalStatus(status: PlayStatusData): void {
        this.globalStatus = status;
    }

    // 获取fnapi实例
    protected getFnApi(): fn.ApiService {
        return this.config.fnapi;
    }
}

// 播放器构造函数类型
export type PlayerConstructor = new (config: Config) => BasePlayer;

// 播放器注册表接口
export interface PlayerRegistry {
    [key: string]: PlayerConstructor;
}