/**
 * 数据脱敏模块
 * 提供各种数据脱敏功能，对使用者完全透明
 */

import { 
    maskingPatterns, 
    maskingChars, 
    maskingEnabled, 
    sensitiveKeywords,
    MaskType
} from './maskingConfig';

/**
 * 对单个值进行脱敏处理
 * @param value - 要脱敏的值
 * @param maskType - 脱敏类型
 * @param showStart - 显示开头字符数
 * @param showEnd - 显示结尾字符数
 * @returns 脱敏后的值
 */
export function maskValue(
    value: any, 
    maskType: MaskType = 'partial', 
    showStart: number = 3, 
    showEnd: number = 3
): string {
    if (!value || typeof value !== 'string') {
        return value;
    }

    const length = value.length;
    
    switch (maskType) {
        case 'full':
            return '*'.repeat(Math.min(length, 8)); // 完全遮蔽，最多显示8个*
            
        case 'partial':
            if (length <= showStart + showEnd) {
                return '*'.repeat(length);
            }
            const start = value.substring(0, showStart);
            const end = value.substring(length - showEnd);
            const maskLength = length - showStart - showEnd;
            return start + '*'.repeat(Math.min(maskLength, 10)) + end;
            
        case 'email':
            const emailMatch = value.match(/^([^@]+)@(.+)$/);
            if (emailMatch) {
                const [, localPart, domain] = emailMatch;
                if (localPart.length <= 2) {
                    return '*'.repeat(localPart.length) + '@' + domain;
                }
                return localPart.substring(0, 2) + '*'.repeat(Math.min(localPart.length - 2, 6)) + '@' + domain;
            }
            return value;

        case 'domain':
            // 处理域名脱敏
            return maskDomain(value);
            
        default:
            return value;
    }
}

/**
 * 域名脱敏处理
 * @param domainUrl - 要脱敏的域名或URL
 * @returns 脱敏后的域名或URL
 */
function maskDomain(domainUrl: string): string {
    if (!domainUrl || typeof domainUrl !== 'string') {
        return domainUrl;
    }

    try {
        // 处理完整的URL
        if (domainUrl.startsWith('http://') || domainUrl.startsWith('https://')) {
            const url = new URL(domainUrl);
            const protocol = url.protocol;
            const hostname = url.hostname;
            const port = url.port ? `:${url.port}` : '';
            const pathname = url.pathname;
            const search = url.search;
            const hash = url.hash;
            
            // 脱敏hostname
            const maskedHostname = maskHostname(hostname);
            
            return `${protocol}//${maskedHostname}${port}${pathname}${search}${hash}`;
        } else {
            // 处理域名:端口格式
            const colonIndex = domainUrl.lastIndexOf(':');
            if (colonIndex > 0 && /^\d+$/.test(domainUrl.substring(colonIndex + 1))) {
                // 包含端口号
                const hostname = domainUrl.substring(0, colonIndex);
                const port = domainUrl.substring(colonIndex);
                return maskHostname(hostname) + port;
            } else {
                // 纯域名
                return maskHostname(domainUrl);
            }
        }
    } catch (error) {
        // 如果URL解析失败，尝试按域名:端口格式处理
        const colonIndex = domainUrl.lastIndexOf(':');
        if (colonIndex > 0 && /^\d+$/.test(domainUrl.substring(colonIndex + 1))) {
            const hostname = domainUrl.substring(0, colonIndex);
            const port = domainUrl.substring(colonIndex);
            return maskHostname(hostname) + port;
        } else {
            return maskHostname(domainUrl);
        }
    }
}

/**
 * 主机名脱敏处理
 * @param hostname - 主机名
 * @returns 脱敏后的主机名
 */
function maskHostname(hostname: string): string {
    if (!hostname || typeof hostname !== 'string') {
        return hostname;
    }

    // IP地址特殊处理
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipPattern);
    if (ipMatch) {
        const [, ip1, ip2, ip3, ip4] = ipMatch;
        return `${ip1}.${ip2}.***.**`;
    }

    // 域名处理
    const parts = hostname.split('.');
    if (parts.length >= 2) {
        // 保留顶级域名和二级域名，脱敏子域名
        if (parts.length === 2) {
            // 如果只有两部分，脱敏第一部分的中间部分
            const domain = parts[0];
            const tld = parts[1];
            if (domain.length <= 4) {
                return `*****.${tld}`;
            } else {
                const masked = domain.substring(0, 2) + '*'.repeat(Math.min(domain.length - 2, 5));
                return `${masked}.${tld}`;
            }
        } else {
            // 多级域名，保留后两级，脱敏前面的
            const mainDomain = parts.slice(-2).join('.');
            const subdomains = parts.slice(0, -2);
            if (subdomains.length > 0) {
                return `*****.${mainDomain}`;
            }
            return mainDomain;
        }
    }

    // 单一字符串，部分脱敏
    if (hostname.length <= 4) {
        return '*'.repeat(hostname.length);
    }
    return hostname.substring(0, 2) + '*'.repeat(Math.min(hostname.length - 2, 5));
}

/**
 * 检查是否为文件路径或文件名
 * @param text - 要检查的文本
 * @returns 是否为文件路径
 */
function isFilePath(text: string): boolean {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    // 检查常见的文件路径模式
    const filePathPatterns = [
        /[A-Za-z]:\\/, // Windows盘符路径
        /\/[^\/\s]+\//, // Unix风格路径
        /\.(js|exe|log|txt|json|xml|html|css|png|jpg|gif|pdf|doc|docx|zip|rar|dll|so)$/i, // 文件扩展名
        /\w+\.(js|exe|log|txt|json|xml|html|css|png|jpg|gif|pdf|doc|docx|zip|rar|dll|so)\b/i, // 文件名
    ];
    
    return filePathPatterns.some(pattern => pattern.test(text));
}

/**
 * 对字符串进行模式匹配脱敏
 * @param text - 要处理的文本
 * @returns 脱敏后的文本
 */
export function maskStringByPatterns(text: string): string {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let maskedText = text;

    // 遍历所有脱敏模式
    Object.entries(maskingPatterns).forEach(([category, config]) => {
        config.patterns.forEach(pattern => {
            maskedText = maskedText.replace(pattern, (match, ...args) => {
                // 找到捕获组中的敏感数据
                const sensitiveValue = args.find(arg => typeof arg === 'string' && arg.length > 0);
                if (sensitiveValue) {
                    // 如果匹配的值看起来像文件路径，跳过脱敏
                    if (isFilePath(sensitiveValue) || isFilePath(match)) {
                        return match; // 不脱敏，返回原值
                    }
                    
                    const maskedValue = maskValue(
                        sensitiveValue, 
                        config.maskType, 
                        config.showStart, 
                        config.showEnd
                    );
                    return match.replace(sensitiveValue, maskedValue);
                }
                return match;
            });
        });
    });

    return maskedText;
}

/**
 * 检查对象键名是否包含敏感信息
 * @param key - 键名
 * @returns 是否为敏感键名
 */
export function isSensitiveKey(key: string): boolean {
    if (!key || typeof key !== 'string') {
        return false;
    }
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
}

/**
 * 深度脱敏对象
 * @param obj - 要脱敏的对象
 * @param depth - 当前递归深度
 * @param maxDepth - 最大递归深度
 * @returns 脱敏后的对象
 */
export function maskObjectDeep(obj: any, depth: number = 0, maxDepth: number = 10): any {
    // 防止无限递归
    if (depth > maxDepth) {
        return '[Object: too deep]';
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    // 基本类型处理
    if (typeof obj !== 'object') {
        if (typeof obj === 'string') {
            return maskStringByPatterns(obj);
        }
        return obj;
    }

    // 数组处理
    if (Array.isArray(obj)) {
        return obj.map(item => maskObjectDeep(item, depth + 1, maxDepth));
    }

    // 特殊对象处理
    if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error) {
        return obj;
    }

    // 普通对象处理
    const maskedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (isSensitiveKey(key)) {
            // 敏感键的值进行脱敏
            if (typeof value === 'string') {
                maskedObj[key] = maskValue(value, 'partial', 2, 2);
            } else if (value !== null && value !== undefined) {
                maskedObj[key] = '[MASKED]';
            } else {
                maskedObj[key] = value;
            }
        } else {
            // 普通键的值递归处理
            maskedObj[key] = maskObjectDeep(value, depth + 1, maxDepth);
        }
    }

    return maskedObj;
}

/**
 * 主要的脱敏函数，自动识别数据类型并进行相应处理
 * @param data - 要脱敏的数据
 * @returns 脱敏后的数据
 */
export function maskSensitiveData(data: any): any {
    if (!maskingEnabled) {
        return data;
    }

    try {
        if (data === null || data === undefined) {
            return data;
        }

        // 字符串直接进行模式匹配脱敏
        if (typeof data === 'string') {
            return maskStringByPatterns(data);
        }

        // 数字、布尔值等基本类型直接返回
        if (typeof data !== 'object') {
            return data;
        }

        // 对象类型进行深度脱敏
        return maskObjectDeep(data);

    } catch (error) {
        // 脱敏过程中出错，返回错误信息而不是原始数据
        return '[MASKING_ERROR: ' + (error as Error).message + ']';
    }
}

/**
 * 脱敏多个参数（用于日志函数的参数处理）
 * @param args - 要脱敏的参数列表
 * @returns 脱敏后的参数数组
 */
export function maskLogArguments(...args: any[]): any[] {
    if (!maskingEnabled) {
        return args;
    }

    // 先将所有参数连接成一个字符串进行整体脱敏
    const combinedString = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join('');
    
    const maskedCombined = maskStringByPatterns(combinedString);
    
    // 如果整体脱敏后的字符串发生了变化，说明有敏感信息被脱敏
    if (maskedCombined !== combinedString) {
        // 返回脱敏后的整体字符串作为单一参数
        return [maskedCombined];
    }
    
    // 如果整体没有变化，则逐个处理参数
    return args.map(arg => maskSensitiveData(arg));
}

/**
 * 格式化并脱敏错误对象
 * @param error - 错误对象
 * @returns 脱敏后的错误信息
 */
export function maskError(error: any): any {
    if (!error) {
        return error;
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: maskStringByPatterns(error.message),
            stack: error.stack ? maskStringByPatterns(error.stack) : undefined
        };
    }

    return maskSensitiveData(error);
}

/**
 * 启用/禁用脱敏功能
 * @param enabled - 是否启用
 */
export function setMaskingEnabled(enabled: boolean): void {
    // 注意：这里不能直接修改导入的常量，需要通过其他方式实现
    console.warn('动态修改脱敏状态需要重新配置模块');
}
