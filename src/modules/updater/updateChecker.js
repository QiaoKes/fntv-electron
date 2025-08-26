const axios = require('axios');
const { dialog, shell } = require('electron');
const { getDownloadProxyConfig } = require('../fn_config/config');
const log = require('../logger');

// 尝试获取app模块，在非Electron环境中可能失败
let app;
try {
    app = require('electron').app;
} catch (error) {
    // 在非Electron环境中使用备用方案
    app = null;
}

// 尝试获取semver模块
let semver;
try {
    semver = require('semver');
} catch (error) {
    // 如果没有semver，使用简单的版本比较
    semver = null;
}

/**
 * 延时函数
 * @param {number} ms - 延时毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class UpdateChecker {
    constructor(owner = 'QiaoKes', repo = 'fntv-electron', currentVersion = null) {
        this.owner = owner;
        this.repo = repo;
        // 如果传入了版本号就使用传入的，否则尝试从app获取，最后使用默认值
        this.currentVersion = currentVersion || (app ? app.getVersion() : 'unknown');
        this.githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        // 重试配置
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2秒
    }

    /**
     * 检查是否有新版本
     * @returns {Promise<{hasUpdate: boolean, latestVersion?: string, downloadUrl?: string, releaseNotes?: string}>}
     */
    async checkForUpdates() {
        return await this.checkForUpdatesWithRetry();
    }

    /**
     * 带重试机制的检查更新
     * @param {number} retryCount - 当前重试次数
     * @returns {Promise<{hasUpdate: boolean, latestVersion?: string, downloadUrl?: string, releaseNotes?: string}>}
     */
    async checkForUpdatesWithRetry(retryCount = 0) {
        try {
            log.info(`检查更新: 当前版本 ${this.currentVersion}${retryCount > 0 ? ` (重试 ${retryCount}/${this.maxRetries})` : ''}`);
            
            const response = await axios.get(this.githubApiUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': `fntv-electron/${this.currentVersion}`
                }
            });

            const release = response.data;
            const latestVersion = release.tag_name.replace(/^v/, ''); // 移除 'v' 前缀
            const downloadUrl = this.getDownloadUrl(release.assets);
            
            log.info(`最新版本: ${latestVersion}`);
            
            // 使用 semver 比较版本，如果没有semver则使用简单比较
            let hasUpdate;
            if (semver) {
                hasUpdate = semver.gt(latestVersion, this.currentVersion);
            } else {
                // 简单的版本比较（仅用于测试）
                hasUpdate = this.compareVersions(latestVersion, this.currentVersion) > 0;
            }
            
            return {
                hasUpdate,
                latestVersion,
                downloadUrl,
                releaseNotes: release.body,
                publishedAt: release.published_at,
                htmlUrl: release.html_url
            };
        } catch (error) {
            log.error(`检查更新失败 (尝试 ${retryCount + 1}/${this.maxRetries + 1}):`, error.message);
            
            // 如果还有重试次数，则等待后重试
            if (retryCount < this.maxRetries) {
                log.info(`等待 ${this.retryDelay}ms 后重试...`);
                await delay(this.retryDelay);
                return await this.checkForUpdatesWithRetry(retryCount + 1);
            }
            
            // 所有重试都失败了，抛出错误
            throw new Error(`检查更新失败: ${error.message} (已重试 ${this.maxRetries} 次)`);
        }
    }

    /**
     * 简单的版本比较函数（用作semver的备用方案）
     * @param {string} version1 
     * @param {string} version2 
     * @returns {number} 1 if version1 > version2, -1 if version1 < version2, 0 if equal
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        const maxLength = Math.max(v1Parts.length, v2Parts.length);
        
        for (let i = 0; i < maxLength; i++) {
            const v1Part = v1Parts[i] || 0;
            const v2Part = v2Parts[i] || 0;
            
            if (v1Part > v2Part) return 1;
            if (v1Part < v2Part) return -1;
        }
        
        return 0;
    }

    /**
     * 从 release assets 中获取适合当前平台的下载链接
     * @param {Array} assets - GitHub release assets
     * @returns {string|null} 下载链接
     */
    getDownloadUrl(assets) {
        if (!assets || assets.length === 0) {
            return null;
        }

        // 根据平台选择合适的安装包
        const platform = process.platform;
        let pattern;

        switch (platform) {
            case 'win32':
                pattern = /\.exe$/i;
                break;
            case 'darwin':
                pattern = /\.dmg$/i;
                break;
            case 'linux':
                pattern = /\.AppImage$/i;
                break;
            default:
                return null;
        }

        const asset = assets.find(asset => pattern.test(asset.name));
        if (!asset) {
            return null;
        }
        
        // 获取原始下载链接
        const originalUrl = asset.browser_download_url;
        
        // 尝试获取代理配置并应用到下载链接
        try {
            const proxyConfig = getDownloadProxyConfig();
            if (proxyConfig.enabled && proxyConfig.proxyUrl && proxyConfig.proxyUrl.trim() !== '') {
                // 如果原始URL包含github.com，则使用代理
                if (originalUrl.includes('github.com')) {
                    const proxiedUrl = `${proxyConfig.proxyUrl.replace(/\/$/, '')}/${originalUrl}`;
                    log.info(`使用代理下载链接: ${proxiedUrl}`);
                    return proxiedUrl;
                }
            }
        } catch (error) {
            log.warn('获取代理配置失败，使用原始下载链接:', error.message);
        }
        
        log.info(`使用原始下载链接: ${originalUrl}`);
        return originalUrl;
    }

    /**
     * 显示更新对话框
     * @param {Object} updateInfo - 更新信息
     * @returns {Promise<boolean>} 用户是否选择立即更新
     */
    async showUpdateDialog(updateInfo) {
        const { latestVersion, releaseNotes, downloadUrl, htmlUrl } = updateInfo;
        
        const result = await dialog.showMessageBox({
            type: 'info',
            title: '发现新版本',
            message: `飞牛影视有新版本可用！`,
            detail: `当前版本: ${this.currentVersion}\n最新版本: ${latestVersion}\n\n更新内容:\n${releaseNotes || '暂无更新说明'}`,
            buttons: ['立即下载', '查看详情', '稍后提醒'],
            defaultId: 0,
            cancelId: 2
        });

        switch (result.response) {
            case 0: // 立即下载
                if (downloadUrl) {
                    shell.openExternal(downloadUrl);
                } else {
                    shell.openExternal(htmlUrl);
                }
                return true;
            case 1: // 查看详情
                shell.openExternal(htmlUrl);
                return false;
            case 2: // 稍后提醒
            default:
                return false;
        }
    }

    /**
     * 显示没有更新的提示
     */
    async showNoUpdateDialog() {
        await dialog.showMessageBox({
            type: 'info',
            title: '检查更新',
            message: '当前已是最新版本',
            detail: `当前版本: ${this.currentVersion}`,
            buttons: ['确定']
        });
    }

    /**
     * 显示检查更新失败的提示
     * @param {string} error - 错误信息
     */
    async showUpdateErrorDialog(error) {
        await dialog.showMessageBox({
            type: 'error',
            title: '检查更新失败',
            message: '无法检查更新',
            detail: error,
            buttons: ['确定']
        });
    }

    /**
     * 自动检查更新（静默检查，只在有更新时提示）
     */
    async autoCheckForUpdates() {
        try {
            const updateInfo = await this.checkForUpdates();
            
            if (updateInfo.hasUpdate) {
                log.info('发现新版本，显示更新提示');
                await this.showUpdateDialog(updateInfo);
            } else {
                log.info('当前已是最新版本');
            }
        } catch (error) {
            log.error('自动检查更新失败:', error.message);
            // 自动检查失败时不显示错误提示，避免打扰用户
        }
    }

    /**
     * 手动检查更新（显示所有结果）
     */
    async manualCheckForUpdates() {
        try {
            const updateInfo = await this.checkForUpdates();
            
            if (updateInfo.hasUpdate) {
                await this.showUpdateDialog(updateInfo);
            } else {
                await this.showNoUpdateDialog();
            }
        } catch (error) {
            await this.showUpdateErrorDialog(error.message);
        }
    }
}

module.exports = UpdateChecker;
