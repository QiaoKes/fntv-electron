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
    // 节流调用
    private lastProgressTime: number = 0;
    private throttleInterval: number = 15000; // 15秒间隔（毫秒）

    constructor(config: Config) {
        super(config);
    }

    /**
     * 播放媒体列表
     */
    async playList(infos: PlayItem[], pos: number, args?: string[]): Promise<boolean> {
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
                ...this.config.extraArgs,
                ...args || []
            );

            let mpvOptions = {
                debug: this.config.debug,
                binary: this.config.playerPath.length > 0 ? this.config.playerPath : undefined,
            };

            this.mpvInstance = new NodeMpv(mpvOptions, mpvArgs);

            // 设置事件监听器
            this.setupEventListeners();

            // 启动 MPV 并加载媒体
            await this.mpvInstance.start()

            // 将所有的infos按顺序加入播放列表，并且播放第pos个视频
            await this.loadPlaylistItems(infos, pos);

            if (this.config.debug) {
                log.debug('MPV 实例启动成功');
            }

            await this.mpvInstance!.play();

            // 开始进度监控
            this.startProgressMonitoring();

            return true;

        } catch (error: any) {
            log.error('MPV 初始化失败:', error);
            const errorEvent: PlayErrorData = {
                message: error.message || error.toString()
            };
            this.emitEvent(EventType.ERROR, errorEvent);
            return false;
        }
    }

    /**
     * 加载播放列表项
     */
    private async loadPlaylistItems(infos: PlayItem[], pos: number): Promise<void> {
        if (!this.mpvInstance || infos.length === 0) {
            throw new Error('MPV实例未启动或播放列表为空');
        }

        try {
            // 首先添加第一个媒体文件（replace模式）
            if (infos.length > 0) {
                const args = infos[0].subtitles.map(sub => `sub-file=${sub}`)
                args.push(`force-media-title=${infos[0].title}`)
                await this.mpvInstance.append(infos[0].playLink, 'replace', args);
                if (this.config.debug) {
                    log.debug(`已添加第一个媒体文件: ${infos[0].title} - ${infos[0].playLink}`);
                }
            }

            // 添加其余媒体文件
            for (let i = 1; i < infos.length; i++) {
                const args = infos[i].subtitles.map(sub => `sub-file=${sub}`)
                args.push(`force-media-title=${infos[i].title}`)
                log.debug('opt', args)
                await this.mpvInstance.append(infos[i].playLink, 'append', args);
                if (this.config.debug) {
                    log.debug(`已添加媒体文件 ${i + 1}: ${infos[i].title} - ${infos[i].playLink}`);
                }
            }

            // 如果指定的位置不是第一个，跳转到指定位置
            if (pos > 0 && pos < infos.length) {
                await this.mpvInstance.jump(pos);
                if (this.config.debug) {
                    log.debug(`跳转到播放列表位置: ${pos} (${infos[pos].title})`);
                }
            }

            // 更新全局状态
            const currentItem = infos[Math.max(0, Math.min(pos, infos.length - 1))];
            this.globalStatus = {
                mediaGuid: currentItem.mediaGuid,
                itemGuid: currentItem.itemGuid,
                videoGuid: currentItem.videoGuid,
                audioGuid: currentItem.audioGuid,
                subtitleGuid: currentItem.subtitleGuid,
                playLink: currentItem.playLink,
                title: currentItem.title,
                subtitles: currentItem.subtitles,
                currentSeconds: this.globalStatus.currentSeconds,
                totalSeconds: this.globalStatus.totalSeconds,
                percentage: this.globalStatus.percentage,
            };

            if (this.config.debug) {
                log.debug(`播放列表加载完成，当前播放: ${currentItem.title}`);
            }
        } catch (error: any) {
            log.error('加载播放列表失败:', error);
            throw error;
        }
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (!this.mpvInstance) return;

        // 监听播放结束事件
        this.mpvInstance.on('stopped', () => {
            this.emitEvent(EventType.PROGRESS, this.getStatus());
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
    private async startProgressMonitoring(): Promise<void> {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }

        this.progressInterval = setInterval(async () => {
            try {
                if (!this.mpvInstance || !this.mpvInstance.isRunning()) {
                    return;
                }

                const [currentTime, duration, percentage, title] = await Promise.all([
                    this.mpvInstance.getTimePosition().catch(() => 0),
                    this.mpvInstance.getDuration().catch(() => 0),
                    this.mpvInstance.getPercentPosition().catch(() => 0),
                    this.mpvInstance.getTitle().catch(() => 0)
                ]);

                if (duration === 0) {
                    log.warn('视频时长为 0，无法获取进度信息');
                    return;
                }

                const progressData: PlayStatusData = this.getStatus();
                progressData.currentSeconds = Math.floor(currentTime);
                progressData.totalSeconds = Math.floor(duration);
                progressData.percentage = Math.floor(percentage);

                // 更新全局状态
                this.updateGlobalStatus(progressData);
                // 节流处理
                const now = Date.now();
                if (now - this.lastProgressTime >= this.throttleInterval) {
                    this.emitEvent(EventType.PROGRESS, progressData);
                    this.lastProgressTime = now;
                }
            } catch (error) {
                if (this.config.debug) {
                    log.debug('获取进度信息失败:', error);
                }
            }
        }, 1000); // 每1秒检查一次
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
}

// 注册 MPV 播放器到工厂
PlayerFactory.registerPlayer(PlayerType.MPV, MpvPlayer);
