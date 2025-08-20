const fs = require('fs');
const path = require('node:path');
const crypto = require('crypto');
const { app } = require('electron');
const { USER_DATA_PATH } = require('../../public/constants');

const HISTORY_LIMIT = 5;
const ENCRYPTION_KEY = 'U2XDcFsV6rdTE9wB5ZHvy6BW9hBTKJ1H'; // 32 chars for aes-256
const IV = Buffer.alloc(16, 0); // Initialization vector

app.setPath('userData', USER_DATA_PATH);

function getConfigPath() {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'config.json');
}

// 加密密码
function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

// 解密密码
function decrypt(encrypted) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), IV);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// 读取配置
function readConfig() {
    const p = getConfigPath();
    if (fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        } catch {
            return null;
        }
    }
    return null;
}

// 保存配置（账号、域名、token）
function saveConfig({ account, domain, token }) {
    const config = readConfig() || {};
    config.account = account;
    config.domain = domain;
    config.token = token;
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 添加历史记录（域名、账号、加密密码）
function addHistory({ domain, account, password }) {
    const config = readConfig() || {};
    config.history = config.history || [];
    // 移除重复项
    config.history = config.history.filter(
        item => !(item.domain === domain && item.account === account)
    );
    // 添加新项
    config.history.unshift({
        domain,
        account,
        password: encrypt(password)
    });
    // 限制最多数量
    if (config.history.length > HISTORY_LIMIT) {
        config.history = config.history.slice(0, HISTORY_LIMIT);
    }
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 获取历史记录（解密密码）
function getHistory() {
    const config = readConfig() || {};
    if (!config.history) return [];
    return config.history.map(item => ({
        domain: item.domain,
        account: item.account,
        password: decrypt(item.password)
    }));
}

// 清除历史记录
function clearHistory() {
    const config = readConfig() || {};
    config.history = [];
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}

// 删除单个历史记录
function deleteHistoryItem({ domain, account }) {
    const config = readConfig() || {};
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

module.exports = {
    saveConfig,
    readConfig,
    addHistory,
    getHistory,
    clearHistory,
    deleteHistoryItem
};