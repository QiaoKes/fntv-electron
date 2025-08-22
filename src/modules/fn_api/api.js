const fn = require("./request");
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { app } = require('electron');

class apiService {
    /**
     * 创建字幕服务实例
     * @param {string} baseURL - API基础URL
     */
    constructor(baseURL, token = '') {
        this.baseURL = baseURL;
        this.tempDir = path.join(app.getPath('temp'), 'fntv_subtitles');
        this.token = token;

        this.downloadSubtitle = this.downloadSubtitle.bind(this);
    }

     /**
     * 用户登录
     */
    login(username, password) {
        return fn.request(this.baseURL, '/v/api/v1/login', 'post', this.token, {
            app_name: "trimemedia-web",
            username: username,
            password: password,
        }, 2000);
    }

    /**
     * 用户登出
     */
    logout() {
        return fn.request(this.baseURL, '/v/api/v1/logout', 'post', this.token);
    }

    /**
     * 获取视频播放信息
     * @param {string} itemGuid - 视频项目的唯一标识符
     * @returns {Promise} 返回播放信息的Promise
     */
    getPlayInfo(itemGuid) {
        return fn.request(this.baseURL, '/v/api/v1/play/info', 'post', this.token, {
            item_guid: itemGuid,
        });
    }

    /**
     * 获取字幕文件列表
     * @param {string} itemGuid - 视频项目的唯一标识符
     * @returns {Promise<Array>} 返回字幕对象数组的Promise
     */
    getSubtitle(itemGuid) {
        return fn.request(this.baseURL, '/v/api/v1/stream/list/' + itemGuid, 'get', this.token, null)
            .then(response => {
                if (response.success) {
                    const streams = response.data.subtitle_streams || [];
                    const subtitles = streams.map(stream => ({
                        id: stream.guid,
                        format: stream.format,
                        name: stream.title
                    }));

                    if (subtitles.length > 0) {
                        console.log('获取到字幕文件:', subtitles);
                        return subtitles;
                    } else {
                        console.warn('没有找到字幕文件');
                        return [];
                    }
                } else {
                    console.error('获取字幕列表失败:', response.message);
                    return [];
                }
            })
            .catch(error => {
                console.error('获取字幕列表时发生错误:', error);
                return [];
            });
    }

    /**
     * 下载字幕文件
     * @param {Array} subs - 字幕对象数组
     * @returns {Promise<Array>} 返回下载成功的字幕文件路径数组
     */
    async downloadSubtitle(subs) {
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
        const api = axios.create({
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
                                console.log(`✅ 字幕文件已下载到: ${filePath}`);
                                return { id, filePath, success: true };
                            });
                    } else {
                        console.error(`❌ 服务端错误: ${response.status} (ID: ${id})`);
                        return { id, filePath, success: false, error: `HTTP ${response.status}` };
                    }
                })
                .catch(error => {
                    let errorMsg = '未知错误';
                    if (error.response) {
                        errorMsg = `服务端错误: ${error.response.status}`;
                    } else if (error.request) {
                        errorMsg = '网络错误: 无响应';
                    } else {
                        errorMsg = `请求错误: ${error.message}`;
                    }
                    console.error(`❌ ID ${id} 下载失败: ${errorMsg}`);
                    return { id, filePath, success: false, error: errorMsg };
                });
        });

        // 执行所有下载任务
        const results = await Promise.allSettled(downloadTasks);

        // 处理结果
        const successfulDownloads = results
            .filter(result => result.status === 'fulfilled' && result.value.success)
            .map(result => result.value.filePath);

        const failedCount = results.length - successfulDownloads.length;

        console.log('========================================');
        console.log('字幕下载摘要:');
        console.log(`🔹 总数: ${subs.length}`);
        console.log(`✅ 成功: ${successfulDownloads.length}`);
        console.log(`❌ 失败: ${failedCount}`);
        console.log('========================================');

        console.log('成功下载的字幕文件:', successfulDownloads);
        return successfulDownloads;
    }

    /**
     * 获取视频直链地址
     * @param {string} mediaGuid - 视频项目的唯一标识符
     * @returns {Promise<string>} 返回视频直链地址的Promise
     */
    getVideoUrl(mediaGuid) {
        return `${this.baseURL}/v/api/v1/media/range/${mediaGuid}`;
    }

    /**
     * 设置视频为已观看状态
     * @param {string} itemGuid - 视频项目的唯一标识符
     * @returns {Promise} 返回设置结果的Promise
     */
    setWatched(itemGuid) {
        return fn.request(this.baseURL, '/v/api/v1/item/watched', 'post', this.token, {
            item_guid: itemGuid,
        });
    }

    /**
     * 记录播放状态
     * @param {Object} statusData - 播放状态数据
     * @param {number} ts - 当前播放时间戳
     * @returns {Promise} 返回记录结果的Promise
     */
    recordPlayState(statusData) {
        return fn.request(this.baseURL, '/v/api/v1/play/record', 'post', this.token, statusData);
    }
}


module.exports = {
    apiService
};