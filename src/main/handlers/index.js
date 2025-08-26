const fs = require('fs');
const path = require('path');
const { initAppHooks } = require('./core/appHook');
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
                    
                    // 查找并执行初始化函数
                    Object.keys(plugin).forEach(key => {
                        if (key.startsWith('init') && typeof plugin[key] === 'function') {
                            log.info(`正在初始化插件: ${file} - ${key}`);
                            plugin[key]();
                        }
                    });
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
 * 注册所有IPC处理器的聚合函数
 */
function registerAllPlugins() {
    // 初始化应用钩子
    initAppHooks();
    
    // 加载所有插件
    loadPlugins();
}

module.exports = {
    registerAllPlugins,
};
