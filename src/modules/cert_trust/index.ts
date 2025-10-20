import { dialog, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import log from '../logger';

// 内存缓存 - 存储已信任的域名/URL
let trustedHostsCache: Set<string> | null = null;
let cacheLoaded = false;

/**
 * 获取证书信任配置文件路径
 */
function getTrustedHostsConfigPath(): string {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'trusted-hosts.json');
}

/**
 * 从文件加载信任列表到内存缓存
 */
function loadTrustedHostsFromFile(): Set<string> {
    const configPath = getTrustedHostsConfigPath();
    
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const hostsArray = JSON.parse(data) as string[];
            log.info(`从文件加载了 ${hostsArray.length} 个信任主机`);
            return new Set(hostsArray);
        }
    } catch (error) {
        log.error('加载信任主机列表失败:', error);
    }
    
    log.info('创建新的信任主机列表');
    return new Set<string>();
}

/**
 * 保存信任列表到文件
 */
function saveTrustedHostsToFile(trustedHosts: Set<string>): void {
    const configPath = getTrustedHostsConfigPath();
    
    try {
        const hostsArray = Array.from(trustedHosts);
        fs.writeFileSync(configPath, JSON.stringify(hostsArray, null, 2), 'utf-8');
        log.info(`保存了 ${hostsArray.length} 个信任主机到文件`);
    } catch (error) {
        log.error('保存信任主机列表失败:', error);
    }
}

/**
 * 获取内存中的信任列表（懒加载）
 */
function getTrustedHostsCache(): Set<string> {
    if (!cacheLoaded || trustedHostsCache === null) {
        trustedHostsCache = loadTrustedHostsFromFile();
        cacheLoaded = true;
        log.info('信任主机缓存已加载到内存');
    }
    return trustedHostsCache;
}

/**
 * 从URL中提取主机名和端口
 * @param url - 完整URL或主机:端口格式
 * @returns 标准化的主机名:端口
 */
function normalizeHost(url: string): string {
    try {
        // 如果不是完整URL，添加protocol
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }
        
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
        
        return `${host}:${port}`;
    } catch (error) {
        log.error('解析URL失败:', error);
        return url;
    }
}

/**
 * 检查主机是否已被信任
 * @param url - URL或主机名
 * @returns 是否已信任
 */
export function isTrusted(url: string): boolean {
    const host = normalizeHost(url);
    const trustedHosts = getTrustedHostsCache();
    return trustedHosts.has(host);
}

/**
 * 添加信任的主机
 * @param url - URL或主机名
 */
export function addTrustedHost(url: string): void {
    const host = normalizeHost(url);
    const trustedHosts = getTrustedHostsCache();
    
    // 添加到内存缓存
    trustedHosts.add(host);
    
    // 保存到文件
    saveTrustedHostsToFile(trustedHosts);
    
    log.info(`已添加信任主机: ${host}`);
}

/**
 * 移除信任的主机
 * @param url - URL或主机名
 */
export function removeTrustedHost(url: string): void {
    const host = normalizeHost(url);
    const trustedHosts = getTrustedHostsCache();
    
    // 从内存缓存中移除
    const deleted = trustedHosts.delete(host);
    
    if (deleted) {
        // 保存到文件
        saveTrustedHostsToFile(trustedHosts);
        log.info(`已移除信任主机: ${host}`);
    } else {
        log.warn(`尝试移除不存在的信任主机: ${host}`);
    }
}

/**
 * 获取所有信任的主机
 * @returns 信任主机列表
 */
export function getTrustedHosts(): string[] {
    const trustedHosts = getTrustedHostsCache();
    return Array.from(trustedHosts);
}

/**
 * 清空所有信任的主机
 */
export function clearTrustedHosts(): void {
    const trustedHosts = getTrustedHostsCache();
    
    // 清空内存缓存
    trustedHosts.clear();
    
    // 保存到文件
    saveTrustedHostsToFile(trustedHosts);
    
    log.info('已清空所有信任主机');
}

/**
 * 重新加载信任列表（强制从文件重新读取）
 */
export function reloadTrustedHosts(): void {
    cacheLoaded = false;
    trustedHostsCache = null;
    getTrustedHostsCache(); // 触发重新加载
    log.info('已重新加载信任主机列表');
}

/**
 * 获取信任主机数量
 * @returns 信任主机的数量
 */
export function getTrustedHostsCount(): number {
    const trustedHosts = getTrustedHostsCache();
    return trustedHosts.size;
}

/**
 * 检查缓存是否已加载
 * @returns 缓存是否已加载
 */
export function isCacheLoaded(): boolean {
    return cacheLoaded;
}

/**
 * 批量添加信任主机
 * @param urls - URL列表
 */
export function addTrustedHosts(urls: string[]): void {
    const trustedHosts = getTrustedHostsCache();
    let addedCount = 0;
    
    for (const url of urls) {
        const host = normalizeHost(url);
        if (!trustedHosts.has(host)) {
            trustedHosts.add(host);
            addedCount++;
        }
    }
    
    if (addedCount > 0) {
        // 保存到文件
        saveTrustedHostsToFile(trustedHosts);
        log.info(`批量添加了 ${addedCount} 个信任主机`);
    } else {
        log.info('没有新的主机需要添加');
    }
}

/**
 * 批量移除信任主机
 * @param urls - URL列表
 */
export function removeTrustedHosts(urls: string[]): void {
    const trustedHosts = getTrustedHostsCache();
    let removedCount = 0;
    
    for (const url of urls) {
        const host = normalizeHost(url);
        if (trustedHosts.delete(host)) {
            removedCount++;
        }
    }
    
    if (removedCount > 0) {
        // 保存到文件
        saveTrustedHostsToFile(trustedHosts);
        log.info(`批量移除了 ${removedCount} 个信任主机`);
    } else {
        log.info('没有主机被移除');
    }
}

/**
 * 显示证书信任确认对话框
 * @param url - 相关URL
 * @param error - 错误信息
 * @param parentWindow - 父窗口
 * @returns 用户是否选择信任证书
 */
export async function showCertificateTrustDialog(
    url: string, 
    error: string, 
    parentWindow?: BrowserWindow
): Promise<boolean> {
    const host = normalizeHost(url);
    
    try {
        const result = parentWindow 
            ? await dialog.showMessageBox(parentWindow, {
                type: 'warning',
                title: '证书安全警告',
                message: '检测到不受信任的SSL证书',
                detail: `域名: ${host}\n错误: ${error}\n\n此证书可能存在安全风险。您是否要信任此证书并继续访问？\n\n警告：只有在您确信该服务器是安全的情况下才选择信任。`,
                buttons: ['信任证书', '取消'],
                defaultId: 1, // 默认选择"取消"
                cancelId: 1,
                checkboxChecked: false
            })
            : await dialog.showMessageBox({
                type: 'warning',
                title: '证书安全警告',
                message: '检测到不受信任的SSL证书',
                detail: `域名: ${host}\n错误: ${error}\n\n此证书可能存在安全风险。您是否要信任此证书并继续访问？\n\n警告：只有在您确信该服务器是安全的情况下才选择信任。`,
                buttons: ['信任证书', '取消'],
                defaultId: 1, // 默认选择"取消"
                cancelId: 1,
                checkboxChecked: false
            });

        if (result.response === 0) {
            // 用户选择信任
            if (result.checkboxChecked) {
                // 记住选择，添加到信任列表
                addTrustedHost(url);
            }
            log.info(`用户选择信任证书: ${host}, 记住选择: ${result.checkboxChecked}`);
            return true;
        } else {
            log.info(`用户取消信任证书: ${host}`);
            return false;
        }
    } catch (error) {
        log.error('显示证书信任对话框失败:', error);
        return false;
    }
}

/**
 * 检查错误是否为证书验证错误
 * @param error - 错误信息
 * @returns 是否为证书错误
 */
// 创建一个包含常见证书错误代码的 Set，以便快速查找
const CERTIFICATE_ERROR_CODES = new Set([
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', // 无法验证叶证书签名（最常见的自签名错误）
    'DEPTH_ZERO_SELF_SIGNED_CERT',     // 深度为零的自签名证书
    'CERT_HAS_EXPIRED',                // 证书已过期
    'ERR_TLS_CERT_ALTNAME_INVALID',    // 主机名/证书名称不匹配
    'CERT_SIGNATURE_FAILURE',          // 证书签名失败
    // ... 可以根据需要添加其他来自 OpenSSL 的错误码
]);

// 新的、更可靠的错误检查函数
export function isCertificateError(error: any): boolean {
    // 关键：直接检查 error.code 是否在我们的 Set 中
    return error && CERTIFICATE_ERROR_CODES.has(error.code);
}