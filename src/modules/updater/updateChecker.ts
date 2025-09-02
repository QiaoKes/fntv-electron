import axios, { AxiosResponse } from 'axios';
import { dialog, shell, app } from 'electron';
import { getDownloadProxyConfig } from '../fn_config/config';
import log from '../logger';

// 尝试获取semver模块
let semver: any;
try {
    semver = require('semver');
} catch (error) {
    // 如果没有semver，使用简单的版本比较
    semver = null;
}

// 类型定义
export interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion?: string;
    downloadUrl?: string | null;
    releaseNotes?: string;
    publishedAt?: string;
    htmlUrl?: string;
}

export interface GitHubRelease {
    tag_name: string;
    body: string;
    published_at: string;
    html_url: string;
    assets: GitHubAsset[];
}

export interface GitHubAsset {
    name: string;
    browser_download_url: string;
}

export interface DialogResult {
    response: number;
}

/**
 * 延时函数
 * @param ms - 延时毫秒数
 * @returns Promise<void>
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class UpdateChecker {
    private owner: string;
    private repo: string;
    private currentVersion: string;
    private githubApiUrl: string;
    private maxRetries: number;
    private baseRetryDelay: number;

    constructor(owner: string = 'QiaoKes', repo: string = 'fntv-electron', currentVersion: string | null = null) {
        this.owner = owner;
        this.repo = repo;
        // 如果传入了版本号就使用传入的，否则尝试从app获取，最后使用默认值
        this.currentVersion = currentVersion || (app ? app.getVersion() : 'unknown');
        this.githubApiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        // 重试配置
        this.maxRetries = 5;
        this.baseRetryDelay = 2000; // 基础延迟2秒
    }

    /**
     * 检查是否有新版本
     * @returns 更新信息
     */
    async checkForUpdates(): Promise<UpdateInfo> {
        return await this.checkForUpdatesWithRetry();
    }

    /**
     * 带梯度重试机制的检查更新
     * @param retryCount - 当前重试次数
     * @returns 更新信息
     */
    async checkForUpdatesWithRetry(retryCount: number = 0): Promise<UpdateInfo> {
        try {
            log.info(`检查更新: 当前版本 ${this.currentVersion}${retryCount > 0 ? ` (重试 ${retryCount}/${this.maxRetries})` : ''}`);
            
            const response: AxiosResponse<GitHubRelease> = await axios.get(this.githubApiUrl, {
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
            let hasUpdate: boolean;
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
        } catch (error: any) {
            log.error(`检查更新失败 (尝试 ${retryCount + 1}/${this.maxRetries + 1}):`, error.message);
            
            // 如果还有重试次数，则等待后重试
            if (retryCount < this.maxRetries) {
                // 梯度延迟
                const retryDelay = this.baseRetryDelay * Math.pow(2, retryCount);
                log.info(`等待 ${retryDelay}ms 后重试...`);
                await delay(retryDelay);
                return await this.checkForUpdatesWithRetry(retryCount + 1);
            }
            
            // 所有重试都失败了，抛出错误
            throw new Error(`检查更新失败: ${error.message} (已重试 ${this.maxRetries} 次)`);
        }
    }

    /**
     * 简单的版本比较函数（用作semver的备用方案）
     * @param version1 
     * @param version2 
     * @returns 1 if version1 > version2, -1 if version1 < version2, 0 if equal
     */
    compareVersions(version1: string, version2: string): number {
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
     * @param assets - GitHub release assets
     * @returns 下载链接
     */
    getDownloadUrl(assets: GitHubAsset[]): string | null {
        if (!assets || assets.length === 0) {
            return null;
        }

        // 根据平台选择合适的安装包
        const platform = process.platform;
        let pattern: RegExp;

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
        } catch (error: any) {
            log.warn('获取代理配置失败，使用原始下载链接:', error.message);
        }
        
        log.info(`使用原始下载链接: ${originalUrl}`);
        return originalUrl;
    }

    /**
     * 显示更新对话框
     * @param updateInfo - 更新信息
     * @returns 用户是否选择立即更新
     */
    async showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
        const { latestVersion, releaseNotes, downloadUrl, htmlUrl } = updateInfo;
        
        const result: DialogResult = await dialog.showMessageBox({
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
                } else if (htmlUrl) {
                    shell.openExternal(htmlUrl);
                }
                return true;
            case 1: // 查看详情
                if (htmlUrl) {
                    shell.openExternal(htmlUrl);
                }
                return false;
            case 2: // 稍后提醒
            default:
                return false;
        }
    }

    /**
     * 显示没有更新的提示
     */
    async showNoUpdateDialog(): Promise<void> {
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
     * @param error - 错误信息
     */
    async showUpdateErrorDialog(error: string): Promise<void> {
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
    async autoCheckForUpdates(): Promise<void> {
        try {
            const updateInfo = await this.checkForUpdates();
            
            if (updateInfo.hasUpdate) {
                log.info('发现新版本，显示更新提示');
                await this.showUpdateDialog(updateInfo);
            } else {
                log.info('当前已是最新版本');
            }
        } catch (error: any) {
            log.error('自动检查更新失败:', error.message);
            // 自动检查失败时不显示错误提示，避免打扰用户
        }
    }

    /**
     * 手动检查更新（显示所有结果）
     */
    async manualCheckForUpdates(): Promise<void> {
        try {
            const updateInfo = await this.checkForUpdates();
            
            if (updateInfo.hasUpdate) {
                await this.showUpdateDialog(updateInfo);
            } else {
                await this.showNoUpdateDialog();
            }
        } catch (error: any) {
            await this.showUpdateErrorDialog(error.message);
        }
    }
}

// 单例实例
let instance: UpdateChecker | null = null;

/**
 * 获取 UpdateChecker 单例实例
 * @param owner - GitHub 仓库所有者，默认 'QiaoKes'
 * @param repo - GitHub 仓库名称，默认 'fntv-electron'
 * @param currentVersion - 当前版本号，默认从 app.getVersion() 获取
 * @returns UpdateChecker 实例
 */
export function getInstance(owner: string = 'QiaoKes', repo: string = 'fntv-electron', currentVersion: string | null = null): UpdateChecker {
    if (!instance) {
        instance = new UpdateChecker(owner, repo, currentVersion);
    }
    return instance;
}

/**
 * 重置单例实例（主要用于测试）
 */
export function resetInstance(): void {
    instance = null;
}
