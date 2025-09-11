import * as fn from "./request";
import { HttpMethod } from "./request";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { app } from 'electron';
import log from '../logger';
import * as types from './types';
import { isTrusted } from '../cert_trust';

export class ApiService {
    private baseURL: string;
    private tempDir: string;
    private token: string;

    /**
     * 创建api服务实例
     * @param baseURL - API基础URL
     * @param token - 授权令牌
     */
    constructor(baseURL: string, token: string = '') {
        this.baseURL = baseURL;
        this.tempDir = path.join(app.getPath('temp'), 'fntv_subtitles');
        this.token = token;

        this.downloadSubtitle = this.downloadSubtitle.bind(this);
    }

    /** 获取当前API基础URL
     * @returns 返回基础URL字符串
     */
    getBaseURL(): string {
        return this.baseURL;
    }

    /**
     * 清理字幕临时目录（当超过100MB时）
     */
    private async cleanupSubtitleDirectory(): Promise<void> {
        try {
            let totalSize = 0;
            const files = fs.readdirSync(this.tempDir);

            // 计算目录总大小
            for (const file of files) {
                const filePath = path.join(this.tempDir, file);
                const stats = fs.lstatSync(filePath);
                if (stats.isFile()) {
                    totalSize += stats.size;
                }
            }

            // 如果超过100MB（104857600字节），清理目录
            const maxSize = 100 * 1024 * 1024; // 100MB
            if (totalSize > maxSize) {
                log.info(`字幕目录大小 ${(totalSize / 1024 / 1024).toFixed(2)}MB 超过限制，开始清理...`);
                
                files.forEach(file => {
                    const filePath = path.join(this.tempDir, file);
                    if (fs.lstatSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    }
                });
                
                log.info('字幕目录清理完成');
            } else {
                log.info(`字幕目录大小 ${(totalSize / 1024 / 1024).toFixed(2)}MB，无需清理`);
            }
        } catch (error) {
            log.error('清理字幕目录时发生错误:', error);
        }
    }

     /**
     * 用户登录
     */
    login(username: string, password: string): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/login', HttpMethod.POST, this.token, {
            app_name: "trimemedia-web",
            username: username,
            password: password,
        } as types.LoginData);
    }

    /**
     * 用户登出
     */
    logout(): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/logout', HttpMethod.POST, this.token);
    }

    /**
     * 获取用户信息
     */
    getUserInfo(): Promise<fn.ApiResponse<types.UserInfo>> {
        return fn.request(this.baseURL, '/v/api/v1/user/info', HttpMethod.GET, this.token);
    }

    /**
     * 获取视频播放信息
     * @param itemGuid - 视频项目的唯一标识符
     * @param options - 可选参数，包括媒体、音频、字幕、视频流的GUID
     * @returns 返回播放信息的Promise
     */
    getPlayInfo(itemGuid: string): Promise<fn.ApiResponse<types.PlayInfo>> {
        const data: types.PlayInfoData = {
            item_guid: itemGuid,
        };
        return fn.request(this.baseURL, '/v/api/v1/play/info', HttpMethod.POST, this.token, data);
    }

    /**
     * 获取播放质量列表
     * @param mediaGuid - 媒体文件的唯一标识符
     * @returns 返回播放质量列表的Promise
     */
    getPlayQuality(mediaGuid: string): Promise<fn.ApiResponse<types.PlayQualityResponse>> {
        return fn.request(this.baseURL, '/v/api/v1/play/quality', HttpMethod.POST, this.token, {
            media_guid: mediaGuid,
        });
    }

    /**
     * 获取流列表（包括视频、音频、字幕流）
     * @param itemGuid - 视频项目的唯一标识符
     * @returns 返回流列表的Promise
     */
    getStreamList(itemGuid: string): Promise<fn.ApiResponse<types.StreamListResponse>> {
        return fn.request(this.baseURL, `/v/api/v1/stream/list/${itemGuid}`, HttpMethod.GET, this.token);
    }

    /**
     * 获取播放列表
     * @returns 返回播放列表的Promise
     */
    getEpisodeList(id: string): Promise<fn.ApiResponse<types.PlayListItem[]>> {
        return fn.request(this.baseURL, `/v/api/v1/episode/list/${id}`, HttpMethod.GET, this.token);
    }

    /**
     * 获取字幕文件列表
     * @param itemGuid - 视频项目的唯一标识符
     * @returns 返回字幕对象数组的Promise
     */
    async getSubtitle(itemGuid: string): Promise<types.Subtitle[]> {
        try {
            const response = await this.getStreamList(itemGuid);

            if (response.success && response.data) {
                const streams = response.data.subtitle_streams || [];
                const subtitles: types.Subtitle[] = streams.filter(stream => stream.is_external).map(stream => ({
                    id: stream.guid,
                    format: stream.format,
                    name: stream.title
                }));

                if (subtitles.length > 0) {
                    log.info('获取到字幕文件:', subtitles);
                    return subtitles;
                } else {
                    log.info('没有找到字幕文件');
                    return [];
                }
            } else {
                log.error('获取字幕列表失败:', response.message);
                return [];
            }
        } catch (error) {
            log.error('获取字幕列表时发生错误:', error);
            return [];
        }
    }

    /**
     * 下载字幕文件
     * @param subs - 字幕对象数组
     * @returns 返回下载成功的字幕文件路径数组
     */
    async downloadSubtitle(subs: types.Subtitle[]): Promise<string[]> {
        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        } else {
            // 检查文件夹大小，超过100MB时清理
            await this.cleanupSubtitleDirectory();
        }

        // 创建Axios实例，根据信任状态决定是否验证证书
        const shouldIgnoreCert = isTrusted(this.baseURL);
        const api: AxiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            responseType: 'text',
            httpsAgent: new https.Agent({
                rejectUnauthorized: !shouldIgnoreCert // 根据信任状态决定是否验证证书
            }),
        });

        // 准备下载任务
        const downloadTasks = subs.map(sub => {
            const { id, name = id, format = 'srt' } = sub;
            const safeName = name.replace(/[^a-z0-9]/gi, '_'); // 文件名安全处理
            const filePath = path.join(this.tempDir, `${safeName}_${id}.${format}`);
            const url = `/v/api/v1/subtitle/dl/${id}`;

            // 检查文件是否已存在
            if (fs.existsSync(filePath)) {
                log.info(`⏭️  字幕文件已存在，跳过下载: ${filePath}`);
                return Promise.resolve({ id, filePath, success: true } as types.SubtitleDownloadResult);
            }

            return api.get(url)
                .then(response => {
                    if (response.status >= 200 && response.status < 300) {
                        return fs.promises.writeFile(filePath, response.data)
                            .then(() => {
                                log.info(`✅ 字幕文件已下载到: ${filePath}`);
                                return { id, filePath, success: true } as types.SubtitleDownloadResult;
                            });
                    } else {
                        log.error(`❌ 服务端错误: ${response.status} (ID: ${id})`);
                        return { id, filePath, success: false, error: `HTTP ${response.status}` } as types.SubtitleDownloadResult;
                    }
                })
                .catch((error: any) => {
                    let errorMsg = '未知错误';
                    if (error.response) {
                        errorMsg = `服务端错误: ${error.response.status}`;
                    } else if (error.request) {
                        errorMsg = '网络错误: 无响应';
                    } else {
                        errorMsg = `请求错误: ${error.message}`;
                    }
                    log.error(`❌ ID ${id} 下载失败: ${errorMsg}`);
                    return { id, filePath, success: false, error: errorMsg } as types.SubtitleDownloadResult;
                });
        });

        // 执行所有下载任务
        const results = await Promise.allSettled(downloadTasks);

        // 处理结果
        const successfulDownloads = results
            .filter((result): result is PromiseFulfilledResult<types.SubtitleDownloadResult> => 
                result.status === 'fulfilled' && result.value.success)
            .map(result => result.value.filePath);

        const failedCount = results.length - successfulDownloads.length;
        const skippedCount = subs.filter(sub => {
            const safeName = (sub.name || sub.id).replace(/[^a-z0-9]/gi, '_');
            const filePath = path.join(this.tempDir, `${safeName}.${sub.format || 'srt'}`);
            return fs.existsSync(filePath);
        }).length;
        const downloadedCount = successfulDownloads.length - skippedCount;

        log.info('========================================');
        log.info('字幕下载摘要:');
        log.info(`🔹 总数: ${subs.length}`);
        log.info(`📥 新下载: ${downloadedCount}`);
        log.info(`⏭️  跳过: ${skippedCount}`);
        log.info(`❌ 失败: ${failedCount}`);
        log.info('========================================');

        log.info('成功下载的字幕文件:', successfulDownloads);
        return successfulDownloads;
    }

    /**
     * 获取视频直链地址
     * @param mediaGuid - 视频项目的唯一标识符
     * @returns 返回视频直链地址
     */
    getVideoUrl(mediaGuid: string): string {
        return `${this.baseURL}/v/api/v1/media/range/${mediaGuid}`;
    }

    /**
     * 设置视频为已观看状态
     * @param itemGuid - 视频项目的唯一标识符
     * @returns 返回设置结果的Promise
     */
    setWatched(itemGuid: string): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/item/watched', HttpMethod.POST, this.token, {
            item_guid: itemGuid,
        } as types.WatchedData);
    }

    /**
     * 记录播放状态
     * @param statusData - 播放状态数据
     * @returns 返回记录结果的Promise
     */
    recordPlayStatus(statusData: types.PlayStatusData): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/play/record', HttpMethod.POST, this.token, statusData);
    }
}

// 重新导出类型定义，保持向后兼容
export * from './types';
