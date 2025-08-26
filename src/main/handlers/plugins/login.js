const path = require('path');
const interceptor = require('../core/interceptor');
const { readConfig, saveConfig } = require('../../../modules/fn_config/config');
const { getMainWindow } = require('../../common/mainwin');
const { session } = require('electron');
const log = require('../../../modules/logger');

/**
 * 登录拦截插件
 * 处理登录和登出请求的拦截
 */

/**
 * 清空登录信息和Cookie
 */
function clearLoginCookies() {
    log.info('清空登录信息和Cookie');

    // 清空配置中保存的token
    const config = readConfig() || {};
    if (config.token || config.domain) {
        // 保留domain和useHttps但清空token
        saveConfig({
            account: config.account,
            domain: config.domain,
            token: '',
            useHttps: config.useHttps
        });
        log.info('已清空配置中的登录token');
    }

    // 清除会话中的cookie
    const ses = session.fromPartition('persist:fntv');
    ses.clearStorageData({
        storages: ['cookies']
    }).then(() => {
        log.info('会话Cookie已清除');
    }).catch(err => {
        log.error('清除Cookie失败:', err);
    });
}

/**
 * 处理登录请求拦截
 * @param {Object} details - 请求详情
 * @param {Function} callback - 回调函数
 */
function handleLoginRequest(details, callback) {
    log.info('检测到登录请求，清空登录信息并跳转到登录页面');
    
    // 清空配置cookie
    clearLoginCookies();
    
    // 取消请求
    callback({ cancel: true });
    
    // 加载自定义页面
    const mainWindow = getMainWindow();
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../../../public/login.html'));
    } else {
        log.error('主窗口未创建，无法跳转到登录页面');
    }
}

/**
 * 处理登出请求拦截
 * @param {Object} details - 请求详情
 * @param {Function} callback - 回调函数
 */
function handleLogoutRequest(details, callback) {
    log.info('检测到登出请求，清空登录信息并跳转到登录页面');
    
    // 清空配置cookie
    clearLoginCookies();
    
    // 取消请求
    callback({ cancel: true });
    
    // 加载自定义页面
    const mainWindow = getMainWindow();
    if (mainWindow) {
        mainWindow.loadFile(path.join(__dirname, '../../../public/login.html'));
    } else {
        log.error('主窗口未创建，无法跳转到登录页面');
    }
}

/**
 * 初始化登录拦截插件
 */
function init() {
    const interceptorManager = interceptor.getInstance();

    // 注册登录请求拦截器
    interceptorManager.registerBeforeRequest(
        {
            urls: [
                'http://*/v/login',
                'https://*/v/login'
            ]
        },
        handleLoginRequest,
        'login-interceptor'
    );

    // 注册登出请求拦截器
    interceptorManager.registerBeforeRequest(
        {
            urls: [
                'http://*/v/api/v1/user/logout',
                'https://*/v/api/v1/user/logout'
            ]
        },
        handleLogoutRequest,
        'logout-interceptor'
    );

    log.info('登录拦截插件已初始化');
}

module.exports = {
    init,
};
