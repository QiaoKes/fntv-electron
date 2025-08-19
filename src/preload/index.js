const fs = require('fs');
const path = require('path');

const { runHooks } = require('./core/hooks.js');

// 自动加载插件
const pluginsDir = path.join(__dirname, 'plugins');
fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
        require(path.join(pluginsDir, file));
    }
});

function initInjector() {
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
