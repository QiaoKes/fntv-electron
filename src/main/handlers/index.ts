import * as fs from 'fs';
import * as path from 'path';
import { getInstance as getInterceptor } from './core/interceptor';
import { initAppHooks } from './core/appHook';
import * as log from '../../modules/logger';

/**
 * 处理器管理器主入口
 * 自动加载所有插件并初始化应用钩子
 */

interface Plugin {
    init?: () => void;
}

// 自动加载所有插件
function loadPlugins(): void {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    try {
        const files = fs.readdirSync(pluginsDir);
        
        files.forEach((file: string) => {
            if (file.endsWith('.js')) { // 保持 .js 扩展名检查，因为编译后的文件是 .js
                try {
                    const plugin: Plugin = require(path.join(pluginsDir, file));
                    
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
    } catch (error) {
        log.error('加载插件目录失败:', error);
    }
}

/**
 * 注册所有插件
 */
function registerAllPlugins(): void {
    const interceptor = getInterceptor();
    interceptor.init('persist:fntv');
    // 加载所有插件
    loadPlugins();

    // 初始化 session 拦截器
    interceptor.run();
    
    // 初始化应用钩子
    initAppHooks();
}

export {
    registerAllPlugins,
};
