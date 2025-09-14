import * as fs from 'fs';
import * as path from 'node:path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { USER_DATA_PATH } from '../../public/constants';

const HISTORY_LIMIT = 5;
const ENCRYPTION_KEY = 'U2XDcFsV6rdTE9wB5ZHvy6BW9hBTKJ1H'; // 32 chars for aes-256
const IV = Buffer.alloc(16, 0); // Initialization vector

app.setPath('userData', USER_DATA_PATH);

/**
 * 配置接口
 */
export interface Config {
    account?: string;
    domain?: string;
    token?: string;
    useHttps?: boolean;
    history?: HistoryItem[];
    downloadProxyEnabled?: boolean;
    downloadProxy?: string;
    hideOriginalPlayButton?: boolean;
    macCloseAction?: 'minimize' | 'quit' | 'ask';
    trayNotificationShown?: boolean;
    nasProxyEnabled?: boolean;
}

/**
 * 历史记录项接口
 */
export interface HistoryItem {
    domain: string;
    account: string;
    password: string;
    useHttps?: boolean;
}

/**
 * 保存配置参数接口
 */
export interface SaveConfigParams {
    account: string;
    domain: string;
    token: string;
    useHttps?: boolean;
}

/**
 * 添加历史记录参数接口
 */
export interface AddHistoryParams {
    domain: string;
    account: string;
    password: string;
    useHttps?: boolean;
}

/**
 * 删除历史记录参数接口
 */
export interface DeleteHistoryParams {
    domain: string;
    account: string;
}

/**
 * 下载代理配置接口
 */
export interface DownloadProxyConfig {
    enabled: boolean;
    proxyUrl: string;
}

/**
 * 设置下载代理配置参数接口
 */
export interface SetDownloadProxyConfigParams {
    enabled?: boolean;
    proxyUrl?: string;
}

function getConfigPath(): string {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'config.json');
}

// 加密密码
function encrypt(text: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 解密密码
function decrypt(encrypted: string): string {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 读取配置
export function readConfig(): Config | null {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, 'utf-8')) as Config;
        } catch {
            return null;
        }
    }
    return null;
}

// 保存配置（账号、域名、token、HTTPS设置）
export function saveConfig({ account, domain, token, useHttps }: SaveConfigParams): void {
    const config: Config = readConfig() || {};
    config.account = account;
    config.domain = domain;
    config.token = token;
    config.useHttps = useHttps || false;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 添加历史记录（域名、账号、加密密码、HTTPS设置）
export function addHistory({ domain, account, password, useHttps }: AddHistoryParams): void {
    const config: Config = readConfig() || {};
    config.history = config.history || [];
    // 移除重复项
    config.history = config.history.filter(
        item => !(item.domain === domain && item.account === account)
    );
    // 添加新项
    config.history.unshift({
        domain,
        account,
        password: encrypt(password),
        useHttps: useHttps || false
    });
    // 限制最多数量
    if (config.history.length > HISTORY_LIMIT) {
        config.history = config.history.slice(0, HISTORY_LIMIT);
    }
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取历史记录（解密密码）
export function getHistory(): HistoryItem[] {
    const config: Config = readConfig() || {};
    if (!config.history) return [];
    return config.history.map(item => ({
        domain: item.domain,
        account: item.account,
        password: decrypt(item.password),
        useHttps: item.useHttps || false
    }));
}

// 清除历史记录
export function clearHistory(): void {
    const config: Config = readConfig() || {};
    config.history = [];
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 删除单个历史记录
export function deleteHistoryItem({ domain, account }: DeleteHistoryParams): boolean {
    const config: Config = readConfig() || {};
    if (!config.history) return false;
    
    const originalLength = config.history.length;
    config.history = config.history.filter(
        item => !(item.domain === domain && item.account === account)
    );
    
    if (config.history.length < originalLength) {
        fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
        return true;
    }
    return false;
}

// 获取下载代理配置
export function getDownloadProxyConfig(): DownloadProxyConfig {
    const config: Config = readConfig() || {};
    return {
        enabled: config.downloadProxyEnabled !== false, // 默认开启
        proxyUrl: config.downloadProxy || 'https://ghfast.top'
    };
}

// 设置下载代理配置
export function setDownloadProxyConfig({ enabled = true, proxyUrl = 'https://ghfast.top' }: SetDownloadProxyConfigParams = {}): void {
    const config: Config = readConfig() || {};
    config.downloadProxyEnabled = enabled;
    config.downloadProxy = proxyUrl;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取是否隐藏原有播放按钮配置
export function getHideOriginalPlayButton(): boolean {
    const config: Config = readConfig() || {};
    return config.hideOriginalPlayButton !== false; // 默认为隐藏（true）
}

// 设置是否隐藏原有播放按钮配置
export function setHideOriginalPlayButton(hide: boolean): void {
    const config: Config = readConfig() || {};
    config.hideOriginalPlayButton = hide;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取NAS本地网盘代理配置
export function getNasProxyEnabled(): boolean {
    const config: Config = readConfig() || {};
    return config.nasProxyEnabled === true; // 默认关闭
}

// 设置NAS本地网盘代理配置
export function setNasProxyEnabled(enabled: boolean): void {
    const config: Config = readConfig() || {};
    config.nasProxyEnabled = enabled;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取 macOS 关闭行为偏好
export function getMacCloseAction(): 'minimize' | 'quit' | 'ask' {
    const config: Config = readConfig() || {};
    return config.macCloseAction || 'ask';
}

// 设置 macOS 关闭行为偏好
export function setMacCloseAction(action: 'minimize' | 'quit' | 'ask'): void {
    const config: Config = readConfig() || {};
    config.macCloseAction = action;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取托盘通知是否已显示过
export function getTrayNotificationShown(): boolean {
    const config: Config = readConfig() || {};
    return config.trayNotificationShown || false;
}

// 设置托盘通知已显示状态
export function setTrayNotificationShown(shown: boolean): void {
    const config: Config = readConfig() || {};
    config.trayNotificationShown = shown;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 向后兼容的函数
export function getDownloadProxyUrl(): string {
    return getDownloadProxyConfig().proxyUrl;
}

export function setDownloadProxyUrl(proxyUrl: string): void {
    const current = getDownloadProxyConfig();
    setDownloadProxyConfig({ enabled: current.enabled, proxyUrl });
}

// CommonJS导出，确保与现有代码兼容
module.exports = {
    saveConfig,
    readConfig,
    addHistory,
    getHistory,
    clearHistory,
    deleteHistoryItem,
    getDownloadProxyUrl,
    setDownloadProxyUrl,
    getDownloadProxyConfig,
    setDownloadProxyConfig,
    getHideOriginalPlayButton,
    setHideOriginalPlayButton,
    getNasProxyEnabled,
    setNasProxyEnabled,
    getMacCloseAction,
    setMacCloseAction,
    getTrayNotificationShown,
    setTrayNotificationShown
};
