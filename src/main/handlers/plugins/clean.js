const {getSessionInterceptorManager} = require('../core/interceptor');
const log = require('../../../modules/logger');

/**
 * 设置缓存管理
 * @param {Electron.Session} ses - session 实例
 */
function setupCacheManagement(ses) {
    // 检查并清理缓存的函数
    const checkAndClearCache = async () => {
        try {
            const usage = await ses.getCacheSize();
            log.info('当前缓存使用量：', Math.round(usage / (1024 * 1024)), 'MB');

            // 如果超过100MB，清理缓存
            if (usage > 100 * 1024 * 1024) {
                await ses.clearCache();
                log.info('已清理缓存文件夹');
            }
        } catch (err) {
            log.error('检查缓存使用量失败:', err);
        }
    };

    // 程序启动时立即执行一次
    checkAndClearCache();

    // 后续每6小时执行一次
    setInterval(checkAndClearCache, 6 * 60 * 60 * 1000);
}

function init() {
    // 初始化 session 和缓存管理
    const interceptorManager = getSessionInterceptorManager();
    const ses = interceptorManager.getSession();
    setupCacheManagement(ses);
}

module.exports = {
    init,
};