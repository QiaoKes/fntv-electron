/**
 * 数据脱敏配置
 * 定义需要脱敏的数据模式和脱敏规则
 */

/**
 * 脱敏模式配置
 */
const maskingPatterns = {
    // 密码相关 - 完全脱敏
    password: {
        patterns: [
            /password['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
            /pwd['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
            /passwd['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
        ],
        maskType: 'full' // 完全遮蔽
    },

    // Token相关 - 部分脱敏
    token: {
        patterns: [
            /token['":\s*]*['"]*([^'",\s}]+)['"]*?/gi,  // 支持 token*, token:, token 等格式
            /authorization['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
            /access_token['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
            /refresh_token['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
        ],
        maskType: 'partial', // 部分遮蔽
        showStart: 4, // 显示前4位
        showEnd: 4    // 显示后4位
    },

    // 手机号 - 部分脱敏
    phone: {
        patterns: [
            /phone['":\s]*['"]*(\d{11})['"]*?/gi,
            /mobile['":\s]*['"]*(\d{11})['"]*?/gi,
            /\b(1[3-9]\d{9})\b/g, // 直接匹配手机号格式
        ],
        maskType: 'partial',
        showStart: 3,
        showEnd: 4
    },

    // 身份证号 - 部分脱敏
    idCard: {
        patterns: [
            /id_card['":\s]*['"]*(\d{15}|\d{18})['"]*?/gi,
            /idcard['":\s]*['"]*(\d{15}|\d{18})['"]*?/gi,
            /\b(\d{15}|\d{18})\b/g, // 直接匹配身份证格式
        ],
        maskType: 'partial',
        showStart: 4,
        showEnd: 4
    },

    // 邮箱 - 部分脱敏
    email: {
        patterns: [
            /email['":\s]*['"]*([^'",\s}]+@[^'",\s}]+\.[^'",\s}]+)['"]*?/gi,
            /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g, // 直接匹配邮箱格式
        ],
        maskType: 'email' // 特殊的邮箱脱敏规则
    },

    // IP地址 - 部分脱敏
    ip: {
        patterns: [
            /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
        ],
        maskType: 'partial',
        showStart: 7, // 显示前两段
        showEnd: 0
    },

    // 银行卡号 - 部分脱敏
    bankCard: {
        patterns: [
            /card_no['":\s]*['"]*(\d{16,19})['"]*?/gi,
            /bank_card['":\s]*['"]*(\d{16,19})['"]*?/gi,
            /\b(\d{16,19})\b/g, // 直接匹配银行卡格式
        ],
        maskType: 'partial',
        showStart: 4,
        showEnd: 4
    },

    // 用户名 - 部分脱敏（在某些上下文中）
    username: {
        patterns: [
            /username['":\s]*['"]*([^'",\s}]{4,})['"]*?/gi,
            /user_name['":\s]*['"]*([^'",\s}]{4,})['"]*?/gi,
        ],
        maskType: 'partial',
        showStart: 2,
        showEnd: 2
    },

    // URL中的敏感参数
    urlParams: {
        patterns: [
            /([?&](?:token|key|secret|password|pwd)=)([^&\s]+)/gi,
        ],
        maskType: 'partial',
        showStart: 4,
        showEnd: 4
    }
};

/**
 * 脱敏字符配置
 */
const maskingChars = {
    default: '*',
    number: '*',
    letter: '*'
};

/**
 * 是否启用脱敏功能
 */
const maskingEnabled = true;

/**
 * 敏感关键词列表（用于检测可能包含敏感信息的对象）
 */
const sensitiveKeywords = [
    'password', 'pwd', 'passwd', 'token', 'secret', 'key', 'auth',
    'phone', 'mobile', 'email', 'id_card', 'idcard', 'bank_card',
    'username', 'user_name', 'address', 'location'
];

module.exports = {
    maskingPatterns,
    maskingChars,
    maskingEnabled,
    sensitiveKeywords
};
