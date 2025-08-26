const fs = require('fs');
const path = require('path');
const { initAppHooks } = require('./core/appHook');
const { initSessionInterceptor } = require('./core/interceptor');
const { getInstance: getUpdateChecker } = require('../../modules/updater/updateChecker');
const log = require('../../modules/logger');

/**
 * 处理器管理器主入口
 * 自动加载所有插件并初始化应用钩子
 */

// 自动加载所有插件
function loadPlugins() {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    try {
        const files = fs.readdirSync(pluginsDir);
        
        files.forEach(file => {
            if (file.endsWith('.js')) {
                try {
                    const plugin = require(path.join(pluginsDir, file));
                    
                    // 直接调用 init 函数
                    if (typeof plugin.init === 'function') {
                        log.info(`正在初始化插件: ${file}`);
                        plugin.init();
                    } else {
                        log.warn(`插件 ${file} 没有导出 init 函数`);
                    }
                } catch (error) {
                    log.error(`加载插件 ${file} 失败:`, error);
                }
            }
        });
        
        log.info('所有处理器插件加载完成');
    } catch (error) {
        log.error('加载插件目录失败:', error);
    }
}

/**
 * 注册所有插件
 */
function registerAllPlugins() {
    // 初始化 session 拦截器
    initSessionInterceptor();
    
    // 初始化应用钩子
    initAppHooks();
    
    // 加载所有插件
    loadPlugins();
}

module.exports = {
    registerAllPlugins,
};
