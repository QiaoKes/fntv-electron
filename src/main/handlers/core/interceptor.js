const { session } = require('electron');
const log = require('../../../modules/logger');

/**
 * Session 拦截管理器
 * 用于统一管理 webRequest 拦截器
 */
class SessionInterceptorManager {
    constructor(partition) {
        this.interceptors = {
            beforeRequest: [],
            beforeSendHeaders: [],
            headerReceived: [],
            beforeRedirect: [],
            responseStarted: [],
            completed: [],
            errorOccurred: []
        };
        this.session = null;
    }

    /**
     * 初始化 session 拦截管理器
     * @param {string} partition - session 分区名称
     */
    init(partition) {
        this.session = session.fromPartition(partition);
    }

    /**
     * 运行拦截器
     */
    run() {
        if (!this.session) {
            log.error('Session 未初始化，无法运行');
            return;
        }

        this._setupInterceptors();
        log.info('Session 拦截管理器已初始化');
    }

    /**
     * 注册 beforeRequest 拦截器
     * @param {Object} filter - 请求过滤器 {urls: [...]}
     * @param {Function} handler - 处理函数
     * @param {string} name - 拦截器名称（用于日志）
     */
    registerBeforeRequest(filter, handler, name = 'unknown') {
        this.interceptors.beforeRequest.push({
            filter,
            handler,
            name
        });
        log.info(`已注册 beforeRequest 拦截器: ${name}`);
    }

    /**
     * 注册 beforeSendHeaders 拦截器
     * @param {Object} filter - 请求过滤器
     * @param {Function} handler - 处理函数
     * @param {string} name - 拦截器名称
     */
    registerBeforeSendHeaders(filter, handler, name = 'unknown') {
        this.interceptors.beforeSendHeaders.push({
            filter,
            handler,
            name
        });
        log.info(`已注册 beforeSendHeaders 拦截器: ${name}`);
    }

    /**
     * 注册 headerReceived 拦截器
     * @param {Object} filter - 请求过滤器
     * @param {Function} handler - 处理函数
     * @param {string} name - 拦截器名称
     */
    registerHeaderReceived(filter, handler, name = 'unknown') {
        this.interceptors.headerReceived.push({
            filter,
            handler,
            name
        });
        log.info(`已注册 headerReceived 拦截器: ${name}`);
    }

    /**
     * 设置所有拦截器
     * @private
     */
    _setupInterceptors() {
        if (!this.session) {
            log.error('Session 未初始化，无法设置拦截器');
            return;
        }

        // 直接遍历 this.interceptors 的 key，自动匹配 webRequest 方法
        Object.keys(this.interceptors).forEach(type => {
            const method = 'on' + type.charAt(0).toUpperCase() + type.slice(1);
            if (typeof this.session.webRequest[method] !== 'function') return;
            this.interceptors[type].forEach(interceptor => {
                this.session.webRequest[method](
                    interceptor.filter,
                    (details, callback) => {
                        try {
                            interceptor.handler(details, callback);
                        } catch (error) {
                            log.error(`${type} 拦截器 ${interceptor.name} 执行失败:`, error);
                            callback && callback({});
                        }
                    }
                );
            });
        });
    }

    /**
     * 获取 session 实例
     * @returns {Electron.Session}
     */
    getSession() {
        return this.session;
    }

    /**
     * 清除所有拦截器
     */
    clearAllInterceptors() {
        Object.keys(this.interceptors).forEach(key => {
            this.interceptors[key] = [];
        });
        log.info('所有拦截器已清除');
    }
}

// 创建单例实例
let instance = new SessionInterceptorManager();

/**
 * 获取 session 拦截管理器实例
 * @returns {SessionInterceptorManager}
 */
function getInstance() {
    return instance;
}

module.exports = {
    getInstance,
};
