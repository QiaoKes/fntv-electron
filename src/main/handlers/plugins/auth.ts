import { IpcMainEvent } from 'electron';
import { getMainWindow } from '../../common/mainwin';
import * as fn from '../../../modules/fn_api/api';
import { restoreCookies } from '../../../modules/fn_config/cookie';
import * as fnConfig from '../../../modules/fn_config/config';
import { registerHandler } from '../core/ipcHandler';
import * as log from '../../../modules/logger';

/**
 * 用户认证插件
 * 处理登录、配置管理、历史记录等功能
 */

interface LoginData {
    domain: string;
    username: string;
    password: string;
    useHttps?: boolean;
}

interface HistoryItem {
    domain: string;
    account: string;
}

// 获取配置处理
function handleGetConfig(event: IpcMainEvent): void {
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
function handleClearHistory(event: IpcMainEvent): void {
    try {
        fnConfig.clearHistory();
        event.reply('history-cleared');
    } catch (error) {
        log.error('清除历史记录失败:', error);
    }
}

// 删除单个历史记录处理
function handleDeleteHistoryItem(event: IpcMainEvent, { domain, account }: HistoryItem): void {
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
async function handleLogin(event: IpcMainEvent, loginData: LoginData): Promise<void> {
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
        log.info('登录成功 token:', token);

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
            log.info('恢复登录状态，即将跳转到主页面, domain:', server);
            const success = await restoreCookies(server, token, true);
            if (success) {
                mainWindow.loadURL(`${server}/v`);
            } else {
                event.reply('login-error', {
                    title: '登录失败',
                    message: '无法恢复登录状态，请重新登录。'
                });
            }
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
function init(): void {
    registerHandler('get-config', handleGetConfig);
    registerHandler('clear-history', handleClearHistory);
    registerHandler('delete-history-item', handleDeleteHistoryItem);
    registerHandler('login', handleLogin);
}

export {
    init
};
