import express, { Express, Request, Response, NextFunction } from 'express';
import * as log from '../logger';
import { ApiService } from '../fn_api/api';
import * as fnConfig from '../fn_config/config';

// 响应代码常量
export const ResponseCode = {
    SUCCESS: 0,
    ERROR: 10000
} as const;

// 缓存项接口
interface CacheItem {
    data: any;
    timestamp: number;
}

/**
 * 代理服务器类
 * 使用Express框架处理HTTP请求和路由
 */
export class ProxyServer {
    private app: Express;
    private server: any = null;
    private port: number;
    private isRunning: boolean = false;
    private host: string = '';
    private playInfoCache: Map<string, CacheItem> = new Map();

    constructor(host: string, port: number) {
        this.port = port;
        this.host = host;
        this.app = express();
        this.setupMiddleware();
        this.registerDefaultRoutes();
    }

    /**
     * 设置中间件
     */
    private setupMiddleware(): void {
        // 启用CORS
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Authorization, Range, Content-Type');
            res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            next();
        });

        // 日志中间件
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            log.debug(`代理服务器收到请求: ${req.method} ${req.url}`);
            next();
        });
    }

    /**
     * 检查缓存是否命中
     */
    private getCachedPlayInfo(itemGuid: string): any | null {
        const cached = this.playInfoCache.get(itemGuid);
        if (!cached) {
            return null;
        }

        log.debug(`播放信息缓存命中: ${itemGuid}`);
        return cached.data;
    }

    /**
     * 设置播放信息缓存
     */
    private setCachedPlayInfo(itemGuid: string, data: any): void {
        this.playInfoCache.set(itemGuid, {
            data,
            timestamp: Date.now()
        });
        log.debug(`播放信息已缓存: ${itemGuid}`);
    }

    /**
     * 注册默认路由
     */
    private registerDefaultRoutes(): void {
        // 通用代理路由: /playproxy/:itemGuid
        this.app.get('/playproxy/:itemGuid', async (req: Request, res: Response) => {
            const { itemGuid } = req.params;

            if (!itemGuid) {
                return res.status(400).send('Missing item GUID parameter');
            }

            // 从全局配置读取url和token
            const config = fnConfig.readConfig();
            if (!config || !config.domain || !config.token) {
                return res.status(500).send('Server base URL is not configured');
            }

            const fnapi = new ApiService(config.domain, config.token)

            // 先检查缓存
            let playInfo = this.getCachedPlayInfo(itemGuid);

            if (!playInfo) {
                // 缓存未命中，调用API
                log.debug(`播放信息缓存未命中，请求API: ${itemGuid}`);
                const resp = await fnapi.getPlayInfo(itemGuid);
                if (!resp.success || !resp.data) {
                    log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                    return res.status(500).send('Failed to get play info');
                }

                playInfo = resp.data;
                // 将结果存入缓存
                this.setCachedPlayInfo(itemGuid, playInfo);
            }

            const targetUrl = fnapi.getVideoUrl(playInfo.media_guid);
            log.info(`代理请求重定向: ${itemGuid} -> ${targetUrl}`);

            // 直接重定向到目标URL，保持所有查询参数
            // res.set('Cache-Control', 'no-cache');
            // 这里设置不行，先用原来的逻辑
            // res.set('Authorization', config.token);
            res.redirect(302, targetUrl);
        });

        // PlayInfo查询API: /api/playinfo/:itemGuid
        this.app.get('/api/playinfo/:itemGuid', async (req: Request, res: Response) => {
            const { itemGuid } = req.params;

            if (!itemGuid) {
                return res.status(400).json({
                    code: ResponseCode.ERROR,
                    message: 'Missing item GUID parameter',
                    data: null
                });
            }

            try {
                // 先检查缓存
                let playInfo = this.getCachedPlayInfo(itemGuid);
                let fromCache = true;

                if (!playInfo) {
                    // 从全局配置读取url和token
                    const config = fnConfig.readConfig();
                    if (!config || !config.domain || !config.token) {
                        return res.status(500).json({
                            code: ResponseCode.ERROR,
                            message: 'Server configuration is not available',
                            data: null
                        });
                    }

                    const fnapi = new ApiService(config.domain, config.token);
                    // 缓存未命中，调用API
                    log.debug(`播放信息缓存未命中，请求API: ${itemGuid}`);
                    const resp = await fnapi.getPlayInfo(itemGuid);

                    if (!resp.success || !resp.data) {
                        log.error('获取播放信息失败:', resp ? resp.message : '未知错误');
                        return res.status(500).json({
                            code: ResponseCode.ERROR,
                            message: resp ? resp.message : 'Failed to get play info',
                            data: null
                        });
                    }

                    playInfo = resp.data;
                    fromCache = false;

                    // 将结果存入缓存
                    this.setCachedPlayInfo(itemGuid, playInfo);
                }

                // 返回播放信息
                res.json({
                    code: ResponseCode.SUCCESS,
                    message: 'success',
                    data: {
                        playInfo: playInfo,
                        fromCache: fromCache,
                        timestamp: Date.now()
                    }
                });

            } catch (error) {
                log.error('查询播放信息时发生错误:', error);
                res.status(500).json({
                    code: ResponseCode.ERROR,
                    message: 'Internal server error',
                    data: null
                });
            }
        });

        // 健康检查路由
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'ok',
                host: this.host,
                port: this.port,
                uptime: process.uptime()
            });
        });

        // 404处理
        this.app.use((req: Request, res: Response) => {
            res.status(404).send('Not Found');
        });
    }

    /**
     * 注册自定义路由
     * @param path - 路由路径 (支持Express路径模式)
     * @param handler - 路由处理函数
     */
    public registerRoute(path: string, handler: (req: Request, res: Response) => void): void {
        this.app.get(path, handler);
        log.info(`注册自定义路由: ${path}`);
    }

    /**
     * 获取Express应用实例 (用于高级自定义)
     */
    public getApp(): Express {
        return this.app;
    }
    /**
     * 启动代理服务器
     */
    public start(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isRunning) {
                log.warn('代理服务器已经在运行中');
                resolve();
                return;
            }

            this.server = this.app.listen(this.port, this.host, () => {
                this.isRunning = true;
                log.info(`代理服务器启动成功: host: ${this.host} 监听端口: ${this.port}`);
                resolve();
            });

            this.server.on('error', (error: Error) => {
                log.error('代理服务器启动失败:', error);
                reject(error);
            });
        });
    }

    /**
     * 停止代理服务器
     */
    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isRunning || !this.server) {
                log.warn('代理服务器未运行');
                resolve();
                return;
            }

            this.server.close(() => {
                this.isRunning = false;
                this.server = null;
                log.info('代理服务器已停止');
                resolve();
            });
        });
    }

    /**
     * 检查服务器是否正在运行
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    /**
     * 获取代理服务器的监听端口
     */
    public getPort(): number {
        return this.port;
    }

    /**
     * 获取代理服务器的监听主机
     */
    public getHost(): string {
        return this.host;
    }
}
