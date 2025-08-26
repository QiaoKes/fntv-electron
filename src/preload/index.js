const fs = require('fs');
const path = require('path');

const { runHooks } = require('./core/hooks.js');

// 导入渲染进程日志模块
const preloadLogger = require('./logger');

// 由于 contextIsolation: false，直接在全局对象上暴露日志接口
global.log = preloadLogger;
global.logger = preloadLogger;

// 如果在浏览器环境中，也暴露到window对象
if (typeof window !== 'undefined') {
    window.log = preloadLogger;
    window.logger = preloadLogger;
}

// 自动加载插件
const pluginsDir = path.join(__dirname, 'plugins');
fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
        require(path.join(pluginsDir, file));
    }
});

function initInjector() {
    // 由于 contextIsolation: false，在DOM ready时暴露到window对象
    if (typeof window !== 'undefined') {
        window.log = preloadLogger;
        window.logger = preloadLogger;
    }
    
    if (document.readyState !== 'loading') {
        runHooks('onReady');
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            runHooks('onReady');
            const observer = new MutationObserver(() => runHooks('onDomChange'));
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
}

initInjector();
