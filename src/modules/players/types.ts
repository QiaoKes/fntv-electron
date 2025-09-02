import { ChildProcess } from 'child_process';
import { e } from '../logger';

// 播放器事件类型枚举
export enum EventType {
    PROGRESS = 'progress',
    ERROR = 'error',
    EXIT = 'exit',
}

// 播放状态接口
export interface PlayStatusData {
    currentSeconds: number;
    totalSeconds: number;
    percentage: number;
}

// 播放器退出数据接口
export interface PlayExitData {
    code: number;
    status: PlayStatusData;
}

// 播放器错误数据接口
export interface PlayErrorData {
    message: string;
}

// 播放器事件数据类型
export type EventData = PlayStatusData | PlayExitData | PlayErrorData;

// 事件处理器类型
export type EventHandler = (type: EventType, data: EventData) => void;

// 播放器配置接口
export interface Config {
    url: string;
    title?: string;
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
    protected playerProcess: ChildProcess | null = null;
    protected static globalStatus: PlayStatusData = {
        currentSeconds: 0,
        totalSeconds: 0,
        percentage: 0
    };

    constructor(config: Config) {
        // 设置默认配置
        this.config = {
            url: config.url,
            title: config.title || 'Media Player',
            headers: config.headers || {},
            debug: config.debug || false,
            extraArgs: config.extraArgs || [],
            playerPath: config.playerPath || 'mpv',
            onEvent: config.onEvent || (() => {})
        };
    }

    // 抽象方法，子类必须实现
    abstract play(): ChildProcess | null;
    
    // 通用方法
    stop(): void {
        if (this.playerProcess) {
            const exitEvent: PlayExitData = {
                code: 0,
                status: BasePlayer.globalStatus
            };
            this.emitEvent(EventType.EXIT, exitEvent);
            this.playerProcess.kill();
            this.playerProcess = null;
        }
    }

    getStatus(): PlayStatusData {
        return BasePlayer.globalStatus;
    }

    isPlaying(): boolean {
        return this.playerProcess !== null && !this.playerProcess.killed;
    }

    // 事件发射方法
    protected emitEvent(type: EventType, event: EventData): void {
        this.config.onEvent(type, event);
    }

    // 保护方法，供子类使用
    protected updateGlobalStatus(status: PlayStatusData): void {
        BasePlayer.globalStatus = status;
        this.emitEvent(EventType.PROGRESS, status);
    }
}

// 播放器构造函数类型
export type PlayerConstructor = new (config: Config) => BasePlayer;

// 播放器注册表接口
export interface PlayerRegistry {
    [key: string]: PlayerConstructor;
}
