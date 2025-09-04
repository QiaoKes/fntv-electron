import { ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
import NodeMpv, { TimePosition } from 'node-mpv-2';
import { title } from 'process';

export class MpvPlayer extends BasePlayer {
    private mpvInstance: NodeMpv | null = null;
    private progressInterval: NodeJS.Timeout | null = null;
    // 节流调用
    private lastProgressTime: number = 0;
    private throttleInterval: number = 15000; // 15秒间隔（毫秒）
    // 播放列表相关
    private playlistItems: PlayItem[] = [];
    private playlistFilePath: string = '';

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
     * 生成并加载播放列表文件
     */
    private async loadPlaylistItems(infos: PlayItem[], pos: number): Promise<void> {
        if (!this.mpvInstance || infos.length === 0) {
            throw new Error('MPV实例未启动或播放列表为空');
        }

        try {
            // 保存播放列表信息
            this.playlistItems = infos;

            // 生成 M3U8 播放列表文件
            const playlistContent = this.generateM3U8Playlist(infos);
            this.playlistFilePath = path.join(os.tmpdir(), `mpv_playlist_${Date.now()}.m3u8`);

            await fs.promises.writeFile(this.playlistFilePath, playlistContent, 'utf-8');

            if (this.config.debug) {
                log.debug(`生成播放列表文件: ${this.playlistFilePath}`);
                log.debug(`播放列表内容:\n${playlistContent}`);
            }

            // 加载播放列表文件
            await this.mpvInstance.loadPlaylist(this.playlistFilePath, 'replace');

            // 跳转到指定位置
            if (pos > 0) {
                // 更新全局状态
                this.updateCurrentItemStatus(pos);
                await this.mpvInstance.jump(pos);
                if (this.config.debug) {
                    log.debug(`跳转到播放列表位置: ${pos} (${infos[pos].title})`);
                }
            }

            if (this.config.debug) {
                log.debug(`播放列表加载完成，当前播放: ${infos[pos].title}`);
            }
        } catch (error: any) {
            log.error('加载播放列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取视频标题
     */
    private getTitle(info: PlayItem): string {
        // 构建标题
        let title = info.title || '';
        if (info.tvTitle) {
            title = `${info.tvTitle || ''} - S${info.seasonNumber || ''}E${info.episodeNumber || ''}: ${info.title || ''}`;
        }

        // 补充一个item_id用于区分当前是哪个视频
        // title = `${title}@${info.itemGuid}`;
        return title;
    }

    /**
     * 生成 M3U8 播放列表内容
     */
    private generateM3U8Playlist(infos: PlayItem[]): string {
        let content = '#EXTM3U\n';

        for (let i = 0; i < infos.length; i++) {
            const item = infos[i];
            const title = this.getTitle(item);

            // 使用实际时长，如果没有则使用 -1
            const duration = item.duration || -1;

            // 添加扩展信息，包含播放进度
            content += `#EXTINF:${duration},${title}\n`;
            content += `${item.playLink}\n`;
        }

        return content;
    }

    /**
     * 更新当前播放项状态
     */
    private updateCurrentItemStatus(index: number): void {
        if (index >= 0 && index < this.playlistItems.length) {
            const currentItem = this.playlistItems[index];

            let st = this.getStatus();
            st.itemGuid = currentItem.itemGuid;
            st.ts = currentItem.ts;
            st.duration = currentItem.duration;
            st.percentage = currentItem.duration > 0 ? Math.floor((currentItem.ts / currentItem.duration) * 100) : 0;
            this.updateGlobalStatus(st);
        }
    }

    /**
     * 设置事件监听器
     */
    private setupEventListeners(): void {
        if (!this.mpvInstance) return;

        // 监听播放结束事件
        this.mpvInstance.on('stopped', () => {
            // this.handleExit(0);
            log.info('MPV 播放结束');
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
            // if (this.config.debug) {
            // log.debug('MPV 状态变化:', status);
            // }

            // 监听播放路径位置
            if (status.property === 'path' && typeof status.value === 'string') {
                const itemGuid = String(status.value).split('/').pop();
                if (!itemGuid) {
                    log.warn('无法从文件名中解析出 itemGuid:', status.value);
                    return;
                }

                const fnapi = this.getFnApi();
                fnapi.getPlayInfo(itemGuid).then(resp => {
                    if (!resp.success || !resp.data) {
                        log.error('path changed: 获取播放信息失败:', resp ? resp.message : '未知错误');
                        return;
                    }

                    // 只有当进度大于0时才执行跳转
                    const ts = resp.data.ts;
                    if (ts > 0) {
                        // 使用重试机制进行跳转, 这里粗暴了点, 视频没加载没法跳，只能重试
                        this.seekWithRetry(ts, 50000, 10);
                    } else {
                        if (this.config.debug) {
                            log.debug('path changed: 跳过跳转，播放进度为0秒');
                        }
                    }
                });

                // 获取并下载字幕
                fnapi.getSubtitle(itemGuid).then(fnapi.downloadSubtitle).then(subPaths => {
                    // 加载字幕
                    subPaths.forEach(subPath => {
                        this.mpvInstance?.addSubtitles(subPath).catch(err => {
                            if (this.config.debug) {
                                log.debug('加载字幕失败:', err);
                            }
                        });
                    });
                });
            }
        });

        // 监听跳转事件
        this.mpvInstance.on('seek', (t: TimePosition) => {
            // Handle seek events
            if (this.config.debug) {
                log.debug('Seek event detected, new position:', t);
            }

            // 通知更新跳转
            const st = this.getStatus();
            st.ts = Math.floor(t.end);
            this.emitEvent(EventType.PROGRESS, st);
        });
    }

    /**
     * 带重试机制的跳转函数
     * @param position 跳转位置（秒）
     * @param maxRetries 最大重试次数
     * @param delayMs 每次重试的延迟时间（毫秒）
     */
    private async seekWithRetry(position: number, maxRetries: number = 3, delayMs: number = 500): Promise<void> {
        let retryCount = 0;

        const attemptSeek = async (): Promise<void> => {
            return new Promise((resolve, reject) => {
                setTimeout(async () => {
                    if (!this.mpvInstance || !this.mpvInstance.isRunning()) {
                        reject(new Error('MPV 实例不存在或未运行'));
                        return;
                    }

                    try {
                        await this.mpvInstance.goToPosition(position);
                        if (this.config.debug) {
                            log.info(`跳转成功: 位置 ${position}s ${retryCount > 0 ? `(重试 ${retryCount} 次后成功)` : ''}`);
                        }
                        resolve();
                    } catch (error) {
                        retryCount++;
                        if (retryCount <= maxRetries) {
                            // 重试，使用固定延迟时间
                            setTimeout(() => {
                                attemptSeek().then(resolve).catch(reject);
                            }, delayMs);
                        } else {
                            log.info(`跳转失败，已达到最大重试次数 ${maxRetries} (位置: ${position}s):`, error);
                            reject(error);
                        }
                    }
                }, delayMs);
            });
        };

        try {
            await attemptSeek();
        } catch (error) {
            // 最终失败，记录错误但不抛出异常
            if (this.config.debug) {
                log.debug('path changed: 跳转到指定时间点最终失败:', error);
            }
        }
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

                const [currentTime, duration, percentage, filename] = await Promise.all([
                    this.mpvInstance.getTimePosition().catch(() => 0),
                    this.mpvInstance.getDuration().catch(() => 0),
                    this.mpvInstance.getPercentPosition().catch(() => 0),
                    this.mpvInstance.getFilename().catch(() => 0)
                ]);

                if (duration === 0) {
                    log.warn('视频时长为 0，无法获取进度信息');
                    return;
                }

                // 从filename获取当前播放的itemGuid
                const itemGuid = String(filename).split('/').pop();
                if (!itemGuid) {
                    log.warn('无法从文件名中解析出 itemGuid:', filename);
                    return;
                }

                const progressData: PlayStatusData = this.getStatus();
                progressData.itemGuid = itemGuid;
                progressData.ts = Math.floor(currentTime);
                progressData.duration = Math.floor(duration);
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

        // 清理播放列表文件
        this.cleanupPlaylistFile();

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
     * 清理播放列表文件
     */
    private cleanupPlaylistFile(): void {
        if (this.playlistFilePath && fs.existsSync(this.playlistFilePath)) {
            try {
                fs.unlinkSync(this.playlistFilePath);
                if (this.config.debug) {
                    log.debug(`已清理播放列表文件: ${this.playlistFilePath}`);
                }
            } catch (error) {
                if (this.config.debug) {
                    log.debug('清理播放列表文件失败:', error);
                }
            }
            this.playlistFilePath = '';
        }
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
        } else {
            // 如果实例已经不存在，也要清理播放列表文件和当前播放项 GUID
            this.cleanupPlaylistFile();
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
