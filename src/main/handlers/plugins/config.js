const fnConfig = require('../../../modules/fn_config/config');
const { registerHandler } = require('../core/ipcHandler');

/**
 * 系统配置插件
 * 处理下载代理等系统配置功能
 */

// 获取当前代理设置
function handleGetDownloadProxy(event) {
    const proxyConfig = fnConfig.getDownloadProxyConfig();
    event.reply('download-proxy-info', proxyConfig);
}

// 设置代理配置
function handleSetDownloadProxy(event, { enabled, proxyUrl }) {
    try {
        fnConfig.setDownloadProxyConfig({ 
            enabled: enabled !== false, 
            proxyUrl: proxyUrl || 'https://ghfast.top' 
        });
        event.reply('download-proxy-set', { success: true });
    } catch (error) {
        event.reply('download-proxy-set', { success: false, error: error.message });
    }
}

// 注册配置相关处理器
function init() {
    registerHandler('get-download-proxy', handleGetDownloadProxy);
    registerHandler('set-download-proxy', handleSetDownloadProxy);
}

module.exports = {
    init
};
