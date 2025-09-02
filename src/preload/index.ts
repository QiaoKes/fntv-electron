import * as fs from 'fs';
import * as path from 'path';

import { HookType, runHooks } from './core/hooks';

// 导入渲染进程日志模块
import preloadLogger from './core/logger';

// 由于 contextIsolation: false，直接在全局对象上暴露日志接口
(global as any).log = preloadLogger;
(global as any).logger = preloadLogger;

// 如果在浏览器环境中，也暴露到window对象
if (typeof window !== 'undefined') {
    window.log = preloadLogger;
    window.logger = preloadLogger;
}

// 自动加载插件
const pluginsDir = path.join(__dirname, 'plugins');
fs.readdirSync(pluginsDir).forEach((file: string) => {
    if (file.endsWith('.js')) {
        require(path.join(pluginsDir, file));
    }
});

function initInjector(): void {
    // 由于 contextIsolation: false，在DOM ready时暴露到window对象
    if (typeof window !== 'undefined') {
        window.log = preloadLogger;
        window.logger = preloadLogger;
    }
    
    if (document.readyState !== 'loading') {
        runHooks(HookType.OnReady);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            runHooks(HookType.OnReady);
            const observer = new MutationObserver(() => runHooks(HookType.OnDomChange));
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
}

initInjector();
