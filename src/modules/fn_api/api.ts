import * as fn from "./request";
import { HttpMethod } from "./request";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios, { AxiosInstance } from 'axios';
import { app } from 'electron';
import log from '../logger';

// 类型定义
export interface LoginData {
    app_name: string;
    username: string;
    password: string;
}

export interface PlayInfoData {
    item_guid: string;
}

export interface SubtitleStream {
    guid: string;
    format: string;
    title: string;
}

export interface SubtitleResponse {
    subtitle_streams?: SubtitleStream[];
}

export interface Subtitle {
    id: string;
    format: string;
    name: string;
}

export interface SubtitleDownloadResult {
    id: string;
    filePath: string;
    success: boolean;
    error?: string;
}

export interface UserInfo {
    // 根据实际API响应定义用户信息结构
    [key: string]: any;
}

export interface PlayInfo {
    // 根据实际API响应定义播放信息结构
    [key: string]: any;
}

export interface WatchedData {
    item_guid: string;
}

export interface PlayStateData {
    item_guid: string;
    media_guid: string;
    video_guid: string;
    audio_guid: string;
    subtitle_guid: string;
    play_link: string;
}

export class ApiService {
    private baseURL: string;
    private tempDir: string;
    private token: string;

    /**
     * 创建字幕服务实例
     * @param baseURL - API基础URL
     * @param token - 授权令牌
     */
    constructor(baseURL: string, token: string = '') {
        this.baseURL = baseURL;
        this.tempDir = path.join(app.getPath('temp'), 'fntv_subtitles');
        this.token = token;

        this.downloadSubtitle = this.downloadSubtitle.bind(this);
    }

     /**
     * 用户登录
     */
    login(username: string, password: string): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/login', HttpMethod.POST, this.token, {
            app_name: "trimemedia-web",
            username: username,
            password: password,
        } as LoginData, 2000);
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
    getUserInfo(): Promise<fn.ApiResponse<UserInfo>> {
        return fn.request(this.baseURL, '/v/api/v1/user/info', HttpMethod.GET, this.token);
    }

    /**
     * 获取视频播放信息
     * @param itemGuid - 视频项目的唯一标识符
     * @returns 返回播放信息的Promise
     */
    getPlayInfo(itemGuid: string): Promise<fn.ApiResponse<PlayInfo>> {
        return fn.request(this.baseURL, '/v/api/v1/play/info', HttpMethod.POST, this.token, {
            item_guid: itemGuid,
        } as PlayInfoData);
    }

    /**
     * 获取字幕文件列表
     * @param itemGuid - 视频项目的唯一标识符
     * @returns 返回字幕对象数组的Promise
     */
    async getSubtitle(itemGuid: string): Promise<Subtitle[]> {
        try {
            const response = await fn.request<SubtitleResponse>(
                this.baseURL, 
                '/v/api/v1/stream/list/' + itemGuid, 
                HttpMethod.GET, 
                this.token, 
                null
            );

            if (response.success && response.data) {
                const streams = response.data.subtitle_streams || [];
                const subtitles: Subtitle[] = streams.map(stream => ({
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
    async downloadSubtitle(subs: Subtitle[]): Promise<string[]> {
        // 确保临时目录存在
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        } else {
            // 清空现有文件
            fs.readdirSync(this.tempDir).forEach(file => {
                const filePath = path.join(this.tempDir, file);
                if (fs.lstatSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            });
        }

        // 创建Axios实例
        const api: AxiosInstance = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            responseType: 'text',
        });

        // 准备下载任务
        const downloadTasks = subs.map(sub => {
            const { id, name = id, format = 'srt' } = sub;
            const safeName = name.replace(/[^a-z0-9]/gi, '_'); // 文件名安全处理
            const filePath = path.join(this.tempDir, `${safeName}.${format}`);
            const url = `/v/api/v1/subtitle/dl/${id}`;

            return api.get(url)
                .then(response => {
                    if (response.status >= 200 && response.status < 300) {
                        return fs.promises.writeFile(filePath, response.data)
                            .then(() => {
                                log.info(`✅ 字幕文件已下载到: ${filePath}`);
                                return { id, filePath, success: true } as SubtitleDownloadResult;
                            });
                    } else {
                        log.error(`❌ 服务端错误: ${response.status} (ID: ${id})`);
                        return { id, filePath, success: false, error: `HTTP ${response.status}` } as SubtitleDownloadResult;
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
                    return { id, filePath, success: false, error: errorMsg } as SubtitleDownloadResult;
                });
        });

        // 执行所有下载任务
        const results = await Promise.allSettled(downloadTasks);

        // 处理结果
        const successfulDownloads = results
            .filter((result): result is PromiseFulfilledResult<SubtitleDownloadResult> => 
                result.status === 'fulfilled' && result.value.success)
            .map(result => result.value.filePath);

        const failedCount = results.length - successfulDownloads.length;

        log.info('========================================');
        log.info('字幕下载摘要:');
        log.info(`🔹 总数: ${subs.length}`);
        log.info(`✅ 成功: ${successfulDownloads.length}`);
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
        } as WatchedData);
    }

    /**
     * 记录播放状态
     * @param statusData - 播放状态数据
     * @returns 返回记录结果的Promise
     */
    recordPlayState(statusData: PlayStateData): Promise<fn.ApiResponse<any>> {
        return fn.request(this.baseURL, '/v/api/v1/play/record', HttpMethod.POST, this.token, statusData);
    }
}

export { ApiService as apiService };
