import { session, OnBeforeRequestListenerDetails, OnBeforeSendHeadersListenerDetails, OnHeadersReceivedListenerDetails, OnBeforeRedirectListenerDetails, OnResponseStartedListenerDetails, OnCompletedListenerDetails, OnErrorOccurredListenerDetails, Session } from 'electron';
import * as log from '../../../modules/logger';

/**
 * Session 拦截管理器
 * 用于统一管理 webRequest 拦截器
 */

interface InterceptorFilter {
    urls: string[];
}

interface InterceptorCallback {
    (response?: { cancel?: boolean; redirectURL?: string; responseHeaders?: Record<string, string | string[]> }): void;
}

interface BeforeRequestHandler {
    (details: OnBeforeRequestListenerDetails, callback: InterceptorCallback): void;
}

interface BeforeSendHeadersHandler {
    (details: OnBeforeSendHeadersListenerDetails, callback: InterceptorCallback): void;
}

interface HeaderReceivedHandler {
    (details: OnHeadersReceivedListenerDetails, callback: InterceptorCallback): void;
}

interface BeforeRedirectHandler {
    (details: OnBeforeRedirectListenerDetails): void;
}

interface ResponseStartedHandler {
    (details: OnResponseStartedListenerDetails): void;
}

interface CompletedHandler {
    (details: OnCompletedListenerDetails): void;
}

interface ErrorOccurredHandler {
    (details: OnErrorOccurredListenerDetails): void;
}

interface InterceptorItem<T> {
    filter: InterceptorFilter;
    handler: T;
    name: string;
}

interface Interceptors {
    beforeRequest: InterceptorItem<BeforeRequestHandler>[];
    beforeSendHeaders: InterceptorItem<BeforeSendHeadersHandler>[];
    headerReceived: InterceptorItem<HeaderReceivedHandler>[];
    beforeRedirect: InterceptorItem<BeforeRedirectHandler>[];
    responseStarted: InterceptorItem<ResponseStartedHandler>[];
    completed: InterceptorItem<CompletedHandler>[];
    errorOccurred: InterceptorItem<ErrorOccurredHandler>[];
}

class SessionInterceptorManager {
    private interceptors: Interceptors;
    private session: Session | null = null;

    constructor() {
        this.interceptors = {
            beforeRequest: [],
            beforeSendHeaders: [],
            headerReceived: [],
            beforeRedirect: [],
            responseStarted: [],
            completed: [],
            errorOccurred: []
        };
    }

    /**
     * 初始化 session 拦截管理器
     * @param partition - session 分区名称
     */
    init(partition: string): void {
        this.session = session.fromPartition(partition);
    }

    /**
     * 运行拦截器
     */
    run(): void {
        if (!this.session) {
            log.error('Session 未初始化，无法运行');
            return;
        }

        this._setupInterceptors();
        log.info('Session 拦截管理器已初始化');
    }

    /**
     * 注册 beforeRequest 拦截器
     * @param filter - 请求过滤器 {urls: [...]}
     * @param handler - 处理函数
     * @param name - 拦截器名称（用于日志）
     */
    registerBeforeRequest(filter: InterceptorFilter, handler: BeforeRequestHandler, name: string = 'unknown'): void {
        this.interceptors.beforeRequest.push({
            filter,
            handler,
            name
        });
        log.info(`已注册 beforeRequest 拦截器: ${name}`);
    }

    /**
     * 注册 beforeSendHeaders 拦截器
     * @param filter - 请求过滤器
     * @param handler - 处理函数
     * @param name - 拦截器名称
     */
    registerBeforeSendHeaders(filter: InterceptorFilter, handler: BeforeSendHeadersHandler, name: string = 'unknown'): void {
        this.interceptors.beforeSendHeaders.push({
            filter,
            handler,
            name
        });
        log.info(`已注册 beforeSendHeaders 拦截器: ${name}`);
    }

    /**
     * 注册 headerReceived 拦截器
     * @param filter - 请求过滤器
     * @param handler - 处理函数
     * @param name - 拦截器名称
     */
    registerHeaderReceived(filter: InterceptorFilter, handler: HeaderReceivedHandler, name: string = 'unknown'): void {
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
    private _setupInterceptors(): void {
        if (!this.session) {
            log.error('Session 未初始化，无法设置拦截器');
            return;
        }

        // 直接遍历 this.interceptors 的 key，自动匹配 webRequest 方法
        Object.keys(this.interceptors).forEach(type => {
            const method = 'on' + type.charAt(0).toUpperCase() + type.slice(1);
            const webRequestMethod = (this.session!.webRequest as any)[method];
            if (typeof webRequestMethod !== 'function') return;
            
            (this.interceptors as any)[type].forEach((interceptor: any) => {
                webRequestMethod.call(
                    this.session!.webRequest,
                    interceptor.filter,
                    (details: any, callback?: any) => {
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
     * @returns session 实例
     */
    getSession(): Session | null {
        return this.session;
    }

    /**
     * 清除所有拦截器
     */
    clearAllInterceptors(): void {
        Object.keys(this.interceptors).forEach(key => {
            (this.interceptors as any)[key] = [];
        });
        log.info('所有拦截器已清除');
    }
}

// 创建单例实例
const instance = new SessionInterceptorManager();

/**
 * 获取 session 拦截管理器实例
 * @returns SessionInterceptorManager 实例
 */
function getInstance(): SessionInterceptorManager {
    return instance;
}

const interceptor = instance;

export {
    getInstance,
    SessionInterceptorManager,
    interceptor
};
