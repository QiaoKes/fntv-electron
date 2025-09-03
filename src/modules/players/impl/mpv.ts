import { ChildProcess } from 'child_process';
import {
    BasePlayer,
    Config,
    PlayStatusData,
    PlayerType,
    EventType,
    PlayErrorData,
    PlayExitData,
    PlayItem // <-- Add PlayItem to the import list
} from '../types';
import { PlayerFactory } from '../factory';
import log from '../../logger';
import NodeMpv from 'node-mpv-2';

export class MpvPlayer extends BasePlayer {
    private mpvInstance: NodeMpv | null = null;
    private progressInterval: NodeJS.Timeout | null = null;

    constructor(config: Config) {
        super(config);
    }

    /**
     * 启动MPV播放器
     */
    play(info: PlayItem): boolean {
        try {
            // 构建 MPV 参数
            const mpvArgs: string[] = [];

            // 添加请求头
            const headerArgs: string[] = [];
            for (const [key, value] of Object.entries(this.config.headers)) {
                headerArgs.push(`${key}: ${value}`);
            }
            if (headerArgs.length > 0) {
                mpvArgs.push(`--http-header-fields=${headerArgs.join(',')}`);
            }

            // 添加其他参数
            mpvArgs.push(
                '--force-media-title=' + info.title,
                ...this.config.extraArgs
            );


            let mpvOptions = {
                debug: this.config.debug,
                binary: this.config.playerPath.length > 0 ? this.config.playerPath : undefined,
            };

            this.mpvInstance = new NodeMpv(mpvOptions, mpvArgs);

            // 设置事件监听器
            this.setupEventListeners();

            // 启动 MPV 并加载媒体
            this.mpvInstance.start()
                .then(() => {
                    if (this.config.debug) {
                        log.debug('MPV 实例启动成功');
                    }
                    return this.mpvInstance!.load(info.url, 'replace');
                })
                .then(() => {
                    if (this.config.debug) {
                        log.debug('MPV 成功加载媒体:', info.url);
                    }
                    return this.mpvInstance!.play();
                })
                .then(() => {
                    // 开始进度监控
                    this.startProgressMonitoring();
                })
                .catch((error: any) => {
                    log.error('MPV 播放失败:', error);
                    const errorEvent: PlayErrorData = {
                        message: error.message || error.toString()
                    };
                    this.emitEvent(EventType.ERROR, errorEvent);
                });

            // 返回一个模拟的 ChildProcess 对象（为了兼容接口）
            return true;

        } catch (error: any) {
            log.error('MPV 初始化失败:', error);
            const errorEvent: PlayErrorData = {
                message: error.message || error.toString()
            };
            this.emitEvent(EventType.ERROR, errorEvent);
            return true;
        }
    }

    playList(infos: PlayItem[]): boolean {
        return false;
    }

    /**
     * 获取当前播放状态
     */
    getStatus(): PlayStatusData {
        if (!this.mpvInstance || !this.mpvInstance.isRunning()) {
            return {
                mediaId: '',
                currentSeconds: 0,
                totalSeconds: 0,
                percentage: 0
            };
        }

        // 尝试同步获取状态（如果 node-mpv-2 支持同步，否则用默认值）
        // 由于 node-mpv-2 的方法是异步的，这里只能返回上一次的状态或默认值
        // 可以考虑缓存最近一次的进度数据
        // 这里简单返回 0，实际项目可优化为缓存最近一次的进度

        return {
            mediaId: '',
            currentSeconds: 0,
            totalSeconds: 0,
            percentage: 0
        };
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (!this.mpvInstance) return;

        // 监听播放结束事件
        this.mpvInstance.on('stopped', () => {
            this.handleExit(0);
        });

        // 监听错误事件
        this.mpvInstance.on('crashed', () => {
            log.error('MPV 播放器崩溃');
            const errorEvent: PlayErrorData = {
                message: 'MPV 播放器崩溃'
            };
            this.emitEvent(EventType.ERROR, errorEvent);
            this.handleExit(1);
        });

        // 监听退出事件
        this.mpvInstance.on('quit', () => {
            this.handleExit(0);
        });

        // 监听状态变化
        this.mpvInstance.on('status', (status: any) => {
            if (this.config.debug) {
                log.debug('MPV 状态变化:', status);
            }
        });
    }

    /**
     * 开始进度监控
     */
    private startProgressMonitoring(): void {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(async () => {
            try {
                if (!this.mpvInstance || !this.mpvInstance.isRunning()) {
                    return;
                }

                const [currentTime, duration, percentage] = await Promise.all([
                    this.mpvInstance.getTimePosition().catch(() => 0),
                    this.mpvInstance.getDuration().catch(() => 0),
                    this.mpvInstance.getPercentPosition().catch(() => 0)
                ]);

                const progressData: PlayStatusData = {
                    mediaId: '',
                    currentSeconds: Math.floor(currentTime),
                    totalSeconds: Math.floor(duration),
                    percentage: Math.floor(percentage)
                };

                // 更新全局状态
                this.emitEvent(EventType.PROGRESS, progressData);
            } catch (error) {
                if (this.config.debug) {
                    log.debug('获取进度信息失败:', error);
                }
            }
        }, 10000); // 每10秒检查一次
    }

    /**
     * 处理退出事件
     */
    private handleExit(code: number): void {
        // 清理进度监控
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }

        // 发射退出事件
        const event: PlayExitData = {
            code: code,
            status: this.getStatus()
        };

        this.emitEvent(EventType.EXIT, event);

        if (this.config.debug) {
            if (code !== 0) {
                log.error(`播放异常结束 (code ${code})`);
            } else {
                log.info('播放器正常退出');
            }
        }

        // 清理实例引用
        this.mpvInstance = null;
    }

    /**
     * 停止播放
     */
    stop(): void {
        if (this.mpvInstance) {
            try {
                log.info('停止播放');
                this.mpvInstance.quit().catch((error: any) => {
                    if (this.config.debug) {
                        log.debug('停止播放时出错:', error);
                    }
                });
            } catch (error) {
                if (this.config.debug) {
                    log.debug('停止播放异常:', error);
                }
            }

            // 手动触发退出事件
            this.handleExit(0);
        }
    }

    /**
     * 检查是否正在播放
     */
    isPlaying(): boolean {
        return this.mpvInstance !== null && this.mpvInstance.isRunning();
    }

    /**
     * 暂停播放
     */
    async pause(): Promise<void> {
        if (this.mpvInstance && this.mpvInstance.isRunning()) {
            try {
                await this.mpvInstance.pause();
                log.info('暂停播放');
            } catch (error) {
                log.error('暂停播放失败:', error);
                throw error;
            }
        }
    }

    /**
     * 恢复播放
     */
    async resume(): Promise<void> {
        if (this.mpvInstance && this.mpvInstance.isRunning()) {
            try {
                await this.mpvInstance.play();
                log.info('恢复播放');
            } catch (error) {
                log.error('恢复播放失败:', error);
                throw error;
            }
        }
    }

    /**
     * 跳转到指定时间
     */
    async seek(seconds: number): Promise<void> {
        if (this.mpvInstance && this.mpvInstance.isRunning()) {
            try {
                await this.mpvInstance.goToPosition(seconds);
                log.info(`跳转到 ${seconds} 秒`);
            } catch (error) {
                log.error('跳转失败:', error);
                throw error;
            }
        }
    }

    /**
     * 设置音量
     */
    async setVolume(volume: number): Promise<void> {
        if (this.mpvInstance && this.mpvInstance.isRunning()) {
            try {
                // 确保音量在 0-100 范围内
                const clampedVolume = Math.max(0, Math.min(100, volume));
                await this.mpvInstance.volume(clampedVolume);
                log.info(`设置音量为 ${clampedVolume}`);
            } catch (error) {
                log.error('设置音量失败:', error);
                throw error;
            }
        }
    }
}

// 注册 MPV 播放器到工厂
PlayerFactory.registerPlayer(PlayerType.MPV, MpvPlayer);
