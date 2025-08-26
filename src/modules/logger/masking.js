/**
 * 数据脱敏模块
 * 提供各种数据脱敏功能，对使用者完全透明
 */

const { 
    maskingPatterns, 
    maskingChars, 
    maskingEnabled, 
    sensitiveKeywords 
} = require('./maskingConfig');

/**
 * 对单个值进行脱敏处理
 * @param {string} value - 要脱敏的值
 * @param {string} maskType - 脱敏类型
 * @param {number} showStart - 显示开头字符数
 * @param {number} showEnd - 显示结尾字符数
 * @returns {string} 脱敏后的值
 */
function maskValue(value, maskType = 'partial', showStart = 3, showEnd = 3) {
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
            
        default:
            return value;
    }
}

/**
 * 对字符串进行模式匹配脱敏
 * @param {string} text - 要处理的文本
 * @returns {string} 脱敏后的文本
 */
function maskStringByPatterns(text) {
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
 * @param {string} key - 键名
 * @returns {boolean} 是否为敏感键名
 */
function isSensitiveKey(key) {
    if (!key || typeof key !== 'string') {
        return false;
    }
    
    const lowerKey = key.toLowerCase();
    return sensitiveKeywords.some(keyword => lowerKey.includes(keyword));
}

/**
 * 深度脱敏对象
 * @param {any} obj - 要脱敏的对象
 * @param {number} depth - 当前递归深度
 * @param {number} maxDepth - 最大递归深度
 * @returns {any} 脱敏后的对象
 */
function maskObjectDeep(obj, depth = 0, maxDepth = 10) {
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
    const maskedObj = {};
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
 * @param {any} data - 要脱敏的数据
 * @returns {any} 脱敏后的数据
 */
function maskSensitiveData(data) {
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
        return '[MASKING_ERROR: ' + error.message + ']';
    }
}

/**
 * 脱敏多个参数（用于日志函数的参数处理）
 * @param {...any} args - 要脱敏的参数列表
 * @returns {Array} 脱敏后的参数数组
 */
function maskLogArguments(...args) {
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
 * @param {Error|any} error - 错误对象
 * @returns {any} 脱敏后的错误信息
 */
function maskError(error) {
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
 * @param {boolean} enabled - 是否启用
 */
function setMaskingEnabled(enabled) {
    // 注意：这里不能直接修改导入的常量，需要通过其他方式实现
    console.warn('动态修改脱敏状态需要重新配置模块');
}

module.exports = {
    maskSensitiveData,
    maskLogArguments,
    maskError,
    maskValue,
    maskStringByPatterns,
    maskObjectDeep,
    isSensitiveKey,
    setMaskingEnabled
};
