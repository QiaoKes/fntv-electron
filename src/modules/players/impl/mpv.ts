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
import NodeMpv from 'node-mpv-2';
import { title } from 'process';

export class MpvPlayer extends BasePlayer {
    private mpvInstance: NodeMpv | null = null;
    private progressInterval: NodeJS.Timeout | null = null;
    // 节流调用
    private lastProgressTime: number = 0;
    private throttleInterval: number = 15000; // 15秒间隔（毫秒）
    // 播放列表相关
    private playlistItems: PlayItem[] = [];
    private currentPlaylistIndex: number = 0;
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
            this.currentPlaylistIndex = pos;

            // 生成 M3U8 播放列表文件
            const playlistContent = this.generateM3U8Playlist(infos, pos);
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
                await this.mpvInstance.jump(pos);
                if (this.config.debug) {
                    log.debug(`跳转到播放列表位置: ${pos} (${infos[pos].title})`);
                }
            }

            // 更新全局状态
            const success = this.updateCurrentItemStatus(pos);
            if (!success) {
                throw new Error('当前播放项缺少必要字段');
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
        title = `${title}@${info.itemGuid}`;
        return title;
    }

    /**
     * 生成 M3U8 播放列表内容
     */
    private generateM3U8Playlist(infos: PlayItem[], startPos: number): string {
        let content = '#EXTM3U\n';

        for (let i = 0; i < infos.length; i++) {
            const item = infos[i];
            const title = this.getTitle(item);

            // 对于当前要播放的项目（startPos命中的），填充播放进度信息
            if (i === startPos) {
                // 获取当前播放进度信息
                const currentTs = item.ts || 0; // 当前播放时间戳（秒）
                const totalDuration = item.duration || 0; // 总时长（秒）
                const percentage = item.percentage || (totalDuration > 0 ? (currentTs / totalDuration) * 100 : 0); // 播放百分比

                // 使用实际时长，如果没有则使用 -1
                const duration = totalDuration > 0 ? totalDuration : -1;

                // 添加扩展信息，包含播放进度
                content += `#EXTINF:${duration},${title} (${percentage.toFixed(1)}%)\n`;
                content += `${item.playLink}\n`;

                if (this.config.debug) {
                    log.debug(`为播放项 ${i} 填充进度信息: ts=${currentTs}s, duration=${totalDuration}s, percentage=${percentage.toFixed(1)}%`);
                }
            } else {
                // 其他项目使用默认处理
                const duration = -1; // M3U8 格式中，-1 表示未知时长

                // 添加扩展信息
                content += `#EXTINF:${duration},${title}\n`;

                // 使用 itemGuid 作为占位符 URL，这样可以通过播放信息获取
                const placeholderUrl = `placeholder://${item.itemGuid}`;
                content += `${placeholderUrl}\n`;

                if (this.config.debug) {
                    log.debug(`为播放项 ${i} 生成占位符: ${placeholderUrl}`);
                }
            }
        }

        return content;
    }

    /**
     * 更新当前播放项状态
     */
    private updateCurrentItemStatus(index: number): boolean {
        if (index >= 0 && index < this.playlistItems.length) {
            const currentItem = this.playlistItems[index];
            this.currentPlaylistIndex = index;

            // 检查currentItem关键字段都有值
            const hasAllFields =
                currentItem.mediaGuid !== undefined &&
                currentItem.duration !== undefined &&
                currentItem.ts !== undefined

            if (!hasAllFields) {
                log.warn('当前播放项缺少必要字段:', currentItem);
                return false;
            }

            this.globalStatus = {
                media_guid: currentItem.mediaGuid || '',
                item_guid: currentItem.itemGuid || '',
                video_guid: currentItem.videoGuid || '',
                audio_guid: currentItem.audioGuid || '',
                subtitle_guid: currentItem.subtitleGuid || '',
                play_link: currentItem.playLink || '',
                duration: currentItem.duration || 0,
                ts: currentItem.ts || 0,
                percentage: currentItem.percentage || 0
            };
        }

        return true;
    }

    /**
     * 处理播放列表位置变化
     */
    private async handlePlaylistPositionChange(newPos: number): Promise<void> {
        if (newPos < 0 || newPos >= this.playlistItems.length) {
            return;
        }

        try {
            const targetItem = this.playlistItems[newPos];

            if (this.config.debug) {
                log.debug(`播放列表位置变化: ${this.currentPlaylistIndex} -> ${newPos} (${targetItem.title})`);
            }

            const info = await this.getFnApi().getPlayInfo(targetItem.itemGuid);
            if (!info.success || !info.data) {
                log.warn('获取播放信息失败:', info, ' itemguid:', targetItem.itemGuid);
                return;
            }

            const playUrl = await this.getFnApi().getVideoUrl(info.data.media_guid);
            // 更新播放列表元信息
            targetItem.mediaGuid = info.data.media_guid;
            targetItem.videoGuid = info.data.video_guid;
            targetItem.audioGuid = info.data.audio_guid;
            targetItem.subtitleGuid = info.data.subtitle_guid;
            targetItem.playLink = playUrl;
            targetItem.duration = info.data.item.duration;
            targetItem.ts = info.data.ts;
            targetItem.tvTitle = info.data.item.tv_title;
            targetItem.seasonNumber = info.data.item.season_number;
            targetItem.episodeNumber = info.data.item.episode_number;
            targetItem.title = info.data.item.title;

            // 获取字幕信息
            const subFiles = await this.getFnApi().getSubtitle(targetItem.itemGuid)
                .then(this.getFnApi().downloadSubtitle)
                .catch((error: Error) => {
                    log.error('获取字幕文件失败:', error);
                    return [];
                });
            targetItem.subtitles = subFiles;
            
            const title = this.getTitle(targetItem);

            // 更新当前播放的 URL
            await this.mpvInstance!.load(playUrl, 'replace', [
                ...subFiles.map(sub => `sub-file=${sub}`),
                `force-media-title=${title}`
            ]);

            // 更新状态
            const success = this.updateCurrentItemStatus(newPos);

            if (!success) {
                log.warn('更新当前播放项状态失败，可能缺少必要字段');
            }
        } catch (error: any) {
            log.error('切换播放列表项失败:', error);
        }
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

            // 监听播放列表位置变化
            if (status.property === 'playlist-pos' && typeof status.value === 'number') {
                const newPos = status.value;
                if (newPos !== this.currentPlaylistIndex && newPos >= 0) {
                    this.handlePlaylistPositionChange(newPos);
                }
            }
        });

        // 启动播放列表位置观察
        this.startPlaylistPositionObserver();
    }

    /**
     * 启动播放列表位置观察器
     */
    private async startPlaylistPositionObserver(): Promise<void> {
        try {
            if (this.mpvInstance) {
                // 观察播放列表位置属性
                await this.mpvInstance.observeProperty('playlist-pos');
                if (this.config.debug) {
                    log.debug('已启动播放列表位置观察器');
                }
            }
        } catch (error) {
            if (this.config.debug) {
                log.debug('启动播放列表位置观察器失败:', error);
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

                // 从title获取当前播放的itemGuid
                const titleParts = String(title).split('@');
                if (titleParts.length < 2) {
                    log.warn('无法从标题中解析出 itemGuid:', title);
                    return;
                }
                const currentItemGuid = titleParts[titleParts.length - 1];

                const progressData: PlayStatusData = this.getStatus();
                progressData.item_guid = currentItemGuid;
                progressData.ts = Math.floor(currentTime);
                progressData.duration = Math.floor(duration);
                progressData.percentage = Math.floor(percentage);

                // 通过item_guid更新media_guid等信息
                const currentItem = this.playlistItems.find(item => item.itemGuid === currentItemGuid);
                if (!currentItem) {
                    log.warn('无法通过 itemGuid 找到对应的播放项:', currentItemGuid);
                    return;
                }

                if (!currentItem.mediaGuid || !currentItem.duration || currentItem.duration === 0) {
                    log.warn('当前播放项缺少必要字段:', currentItem);
                    return;
                }

                progressData.media_guid = currentItem.mediaGuid || '';
                progressData.video_guid = currentItem.videoGuid || '';
                progressData.audio_guid = currentItem.audioGuid || '';
                progressData.subtitle_guid = currentItem.subtitleGuid || '';
                progressData.play_link = currentItem.playLink || '';

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
            // 如果实例已经不存在，也要清理播放列表文件
            this.cleanupPlaylistFile();
        }
    }

    /**
     * 检查是否正在播放
     */
    isPlaying(): boolean {
        return this.mpvInstance !== null && this.mpvInstance.isRunning();
    }

    /**
     * 手动切换到指定播放列表位置
     */
    async jumpToPlaylistItem(index: number): Promise<boolean> {
        if (!this.mpvInstance || index < 0 || index >= this.playlistItems.length) {
            return false;
        }

        try {
            await this.handlePlaylistPositionChange(index);
            return true;
        } catch (error) {
            log.error('切换播放列表项失败:', error);
            return false;
        }
    }

    /**
     * 获取当前播放列表信息
     */
    getPlaylistInfo(): { items: PlayItem[], currentIndex: number } {
        return {
            items: [...this.playlistItems], // 返回副本
            currentIndex: this.currentPlaylistIndex
        };
    }

    /**
     * 获取播放列表长度
     */
    getPlaylistLength(): number {
        return this.playlistItems.length;
    }

    /**
     * 获取当前播放项
     */
    getCurrentPlaylistItem(): PlayItem | null {
        if (this.currentPlaylistIndex >= 0 && this.currentPlaylistIndex < this.playlistItems.length) {
            return this.playlistItems[this.currentPlaylistIndex];
        }
        return null;
    }
}

// 注册 MPV 播放器到工厂
PlayerFactory.registerPlayer(PlayerType.MPV, MpvPlayer);
