import { spawn, ChildProcess } from 'child_process';
import { BasePlayer, PlayerConfig, PlaybackStatus, PlayerType } from '../types';
import { PlayerFactory } from '../factory';
import log from '../../logger';

export class MpvPlayer extends BasePlayer {
    private mpvPath: string;
    private lastProgressTime: number = 0;
    private throttleInterval: number = 15000; // 15秒间隔（毫秒）

    constructor(config: PlayerConfig & { mpvPath?: string }) {
        super(config);
        this.mpvPath = config.mpvPath || 'mpv';
    }

    /**
     * 解析MPV输出的时间数据
     * @param str - MPV输出的字符串
     * @returns 解析后的时间对象
     */
    static parseVideoData(str: string): PlaybackStatus | null {
        const timeRegex = /(\d{2}:\d{2}:\d{2}) \/ (\d{2}:\d{2}:\d{2}) \((\d+)%\)/;
        const match = str.match(timeRegex);

        if (!match) return null;

        const parseTimeToSeconds = (timeStr: string): number => {
            const [hours, minutes, seconds] = timeStr.split(':').map(Number);
            return hours * 3600 + minutes * 60 + seconds;
        };

        return {
            currentSeconds: parseTimeToSeconds(match[1]),
            totalSeconds: parseTimeToSeconds(match[2]),
            percentage: parseInt(match[3])
        };
    }

    /**
     * 启动MPV播放器
     */
    play(): ChildProcess | null {
        // 构建命令行参数
        const args: string[] = [];

        // 添加请求头
        const headerArgs: string[] = [];
        for (const [key, value] of Object.entries(this.config.headers)) {
            headerArgs.push(`${key}: ${value}`);
        }
        if (headerArgs.length > 0) {
            args.push(`--http-header-fields=${headerArgs.join(',')}`);
        }

        // 添加其他参数
        args.push(
            '--force-media-title=' + this.config.title,
            ...this.config.extraArgs,
            this.config.url
        );

        // 调试模式输出命令
        if (this.config.debug) {
            log.debug('MPV 命令:', `"${this.mpvPath}" ${args.join(' ')}`);
        }

        // 启动播放器进程
        this.playerProcess = spawn(this.mpvPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true
        });

        // 处理标准输出
        this.playerProcess.stdout?.on('data', (data: Buffer) => {
            const output = data.toString().trim();

            // 尝试解析进度数据
            const progressData = MpvPlayer.parseVideoData(output);
            if (progressData) {
                // 更新全局状态
                this.updateGlobalStatus(progressData);
                // 节流处理
                const now = Date.now();
                if (now - this.lastProgressTime >= this.throttleInterval) {
                    // 触发进度回调
                    this.config.onData(progressData);
                    this.lastProgressTime = now;
                }
            }
        });

        // 处理错误输出
        this.playerProcess.stderr?.on('data', (data: Buffer) => {
            const errorMessage = data.toString().trim();
            if (errorMessage) {
                if (this.config.debug) {
                    log.error(`[MPV Error] ${errorMessage}`);
                }
                this.config.onError(errorMessage);
            }
        });

        // 处理进程退出
        this.playerProcess.on('exit', (code: number | null) => {
            // 退出时传递最后记录的进度状态
            this.config.onExit(code, this.getStatus());

            if (this.config.debug) {
                if (code !== 0 && code !== null) {
                    log.error(`播放异常结束 (code ${code})`);
                } else {
                    log.info('播放器正常退出');
                }
            }

            // 清理进程引用
            this.playerProcess = null;
        });

        // 处理启动错误
        this.playerProcess.on('error', (err: Error) => {
            const nodeError = err as NodeJS.ErrnoException;
            if (nodeError.code === 'ENOENT') {
                log.error('错误: 找不到 mpv 播放器。请确保已安装 mpv。');
                log.error('在 macOS/Linux 上: brew install mpv');
                log.error('在 Windows 上: 从 https://mpv.io/installation/ 下载');
                log.error('或使用 --mpvPath 参数指定 mpv 的完整路径');
            } else {
                log.error(`播放失败: ${err.message}`);
            }

            this.config.onError(err.message);
            this.playerProcess = null;
        });

        return this.playerProcess;
    }

    stop(): void {
        if (this.playerProcess) {
            this.config.onExit(0, this.getStatus());
            log.info('停止播放');
            this.playerProcess.kill();
            this.playerProcess = null;
        }
    }
}

// 注册 MPV 播放器到工厂
PlayerFactory.registerPlayer(PlayerType.MPV, MpvPlayer);
