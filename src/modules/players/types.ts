// 播放器事件类型枚举
export enum EventType {
    PROGRESS = 'progress',
    ERROR = 'error',
    EXIT = 'exit',
}

// 播放状态接口
export type PlayStatusData = {
    mediaId: string;
    currentSeconds: number;
    totalSeconds: number;
    percentage: number;
}

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

// 单个播放源信息
export type PlayItem = {
    id: string;
    title: string;
    url: string;
};

// 播放器配置接口
export type Config = {
    headers?: Record<string, string>;
    debug?: boolean;
    extraArgs?: string[];
    playerPath?: string;
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

    constructor(config: Config) {
        // 设置默认配置
        this.config = {
            headers: config.headers || {},
            debug: config.debug || false,
            extraArgs: config.extraArgs || [],
            playerPath: config.playerPath || '',
            onEvent: config.onEvent || (() => {})
        };
    }

    // 播放单个
    abstract play(info: PlayItem): boolean;

    // 播放列表
    abstract playList(infos: PlayItem[]): boolean;

    // 停止播放
    abstract stop(): void;

    // 获取当前播放状态
    abstract getStatus(): PlayStatusData;

    // 判断播放器是否正在播放
    abstract isPlaying(): boolean;

    // 事件发射方法
    protected emitEvent(type: EventType, event: EventData): void {
        this.config.onEvent(type, event);
    }
}

// 播放器构造函数类型
export type PlayerConstructor = new (config: Config) => BasePlayer;

// 播放器注册表接口
export interface PlayerRegistry {
    [key: string]: PlayerConstructor;
}
