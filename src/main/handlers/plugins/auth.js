const { getMainWindow } = require('../../windowManager');
const fn = require('../../../modules/fn_api/api');
const { restoreCookies } = require('../../../modules/fn_config/cookie');
const fnConfig = require('../../../modules/fn_config/config');
const { registerHandler } = require('../core/ipcHandler');
const log = require('../../../modules/logger');

/**
 * 用户认证插件
 * 处理登录、配置管理、历史记录等功能
 */

// 获取配置处理
function handleGetConfig(event) {
    try {
        const config = fnConfig.readConfig() || {};
        const history = fnConfig.getHistory() || [];
        event.reply('config-data', { config, history });
    } catch (error) {
        log.error('读取配置失败:', error);
        event.reply('config-data', { config: {}, history: [] });
    }
}

// 清除历史记录处理
function handleClearHistory(event) {
    try {
        fnConfig.clearHistory();
        event.reply('history-cleared');
    } catch (error) {
        log.error('清除历史记录失败:', error);
    }
}

// 删除单个历史记录处理
function handleDeleteHistoryItem(event, { domain, account }) {
    try {
        const success = fnConfig.deleteHistoryItem({ domain, account });
        if (success) {
            event.reply('history-item-deleted');
        }
    } catch (error) {
        log.error('删除历史记录项失败:', error);
    }
}

// 用户登录处理
async function handleLogin(event, loginData) {
    log.info('Received loginData:', loginData);
    
    if (!loginData || !loginData.domain || !loginData.username || !loginData.password) {
        log.error('登录失败: 缺少必要的登录信息, loginData:', loginData);
        event.reply('login-error', {
            title: '登录失败',
            message: '请提供完整的登录信息。'
        });
        return;
    }

    // 构建服务器地址
    const server = loginData.useHttps ? `https://${loginData.domain}` : `http://${loginData.domain}`;
    const fnapi = new fn.apiService(server);

    try {
        const response = await fnapi.login(loginData.username, loginData.password);
        
        if (!response || !response.success) {
            log.error('登录失败:', response ? response.message : '未知错误');
            event.reply('login-error', {
                title: '登录失败',
                message: '请检查账号、密码或者域名是否正确。'
            });
            return;
        }

        const token = response.data.token;
        if (!token) {
            log.error('登录失败: 没有有效的登录信息，无法恢复 cookies');
            event.reply('login-error', {
                title: '登录失败',
                message: '没有有效的登录信息，无法恢复 cookies'
            });
            return;
        }

        // 保存登录信息
        const { saveConfig, addHistory } = require('../../../modules/fn_config/config');

        // 保存配置
        saveConfig({
            account: loginData.username,
            domain: server,
            token: response.data.token,
            useHttps: loginData.useHttps
        });

        // 添加到登录历史
        addHistory({
            domain: loginData.domain,
            account: loginData.username,
            password: loginData.password,
            useHttps: loginData.useHttps
        });

        // 跳转到主页
        const mainWindow = getMainWindow();
        if (mainWindow) {
            log.info('恢复登录状态，跳转到主页面, domain:', server);
            await restoreCookies(server, token);
            mainWindow.loadURL(`${server}/v`);
        }
    } catch (error) {
        log.error('登录请求失败:', error);
        event.reply('login-error', {
            title: '连接失败',
            message: '无法连接到服务器，请检查域名是否正确或网络连接是否正常。'
        });
    }
}

// 注册认证相关处理器
function init() {
    registerHandler('get-config', handleGetConfig);
    registerHandler('clear-history', handleClearHistory);
    registerHandler('delete-history-item', handleDeleteHistoryItem);
    registerHandler('login', handleLogin);
}

module.exports = {
    init
};
