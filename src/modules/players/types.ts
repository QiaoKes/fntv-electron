import { ChildProcess } from 'child_process';

// 播放状态接口
export interface PlaybackStatus {
    currentSeconds: number;
    totalSeconds: number;
    percentage: number;
}

// 播放器配置接口
export interface PlayerConfig {
    url: string;
    title?: string;
    headers?: Record<string, string>;
    debug?: boolean;
    extraArgs?: string[];
    playerPath?: string;
    onData?: (data: PlaybackStatus) => void;
    onError?: (error: string) => void;
    onExit?: (code: number, status: PlaybackStatus) => void;
}

// 播放器类型枚举
export enum PlayerType {
    MPV = 'mpv',
    // 可以扩展其他播放器类型
}

// 播放器抽象基类
export abstract class BasePlayer {
    protected config: Required<PlayerConfig>;
    protected playerProcess: ChildProcess | null = null;
    protected static globalStatus: PlaybackStatus = {
        currentSeconds: 0,
        totalSeconds: 0,
        percentage: 0
    };

    constructor(config: PlayerConfig) {
        // 设置默认配置
        this.config = {
            url: config.url,
            title: config.title || 'Media Player',
            headers: config.headers || {},
            debug: config.debug || false,
            extraArgs: config.extraArgs || [],
            playerPath: config.playerPath || 'mpv',
            onData: config.onData || (() => {}),
            onError: config.onError || (() => {}),
            onExit: config.onExit || (() => {})
        };
    }

    // 抽象方法，子类必须实现
    abstract play(): ChildProcess | null;
    
    // 通用方法
    stop(): void {
        if (this.playerProcess) {
            this.config.onExit(0, BasePlayer.globalStatus);
            this.playerProcess.kill();
            this.playerProcess = null;
        }
    }

    getStatus(): PlaybackStatus {
        return BasePlayer.globalStatus;
    }

    isPlaying(): boolean {
        return this.playerProcess !== null && !this.playerProcess.killed;
    }

    // 保护方法，供子类使用
    protected updateGlobalStatus(status: PlaybackStatus): void {
        BasePlayer.globalStatus = status;
    }
}

// 播放器构造函数类型
export type PlayerConstructor = new (config: PlayerConfig) => BasePlayer;

// 播放器注册表接口
export interface PlayerRegistry {
    [key: string]: PlayerConstructor;
}
