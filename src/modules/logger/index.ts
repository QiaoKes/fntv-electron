import { logger, LogLevel } from './logger';

/**
 * 日志方法类型定义
 */
type LogMethod = (message: string, ...args: any[]) => void;

/**
 * 日志接口类型定义
 */
interface ILogger {
    debug: LogMethod;
    info: LogMethod;
    warn: LogMethod;
    error: LogMethod;
    log: LogMethod;
    d: LogMethod;
    i: LogMethod;
    w: LogMethod;
    e: LogMethod;
    logError(message: string, error?: any, ...extraArgs: any[]): void;
    getLogger(): typeof logger;
    setLogLevel(level: LogLevel): void;
    getLogFile(): string;
    getLogDir(): string;
}

/**
 * 简化的日志接口，替换console的使用
 * 自动进行数据脱敏，对使用者完全透明
 * 用法：
 * const log = require('./path/to/logger');
 * log.info('这是一条信息');
 * log.error('这是一个错误', error);
 * log.debug('用户信息:', { username: 'admin', password: '123456' }); // 密码会被自动脱敏
 */
const loggerInterface: ILogger = {
    debug: (message: string, ...args: any[]) => logger.debug(message, ...args),
    info: (message: string, ...args: any[]) => logger.info(message, ...args),
    warn: (message: string, ...args: any[]) => logger.warn(message, ...args),
    error: (message: string, ...args: any[]) => logger.error(message, ...args),
    log: (message: string, ...args: any[]) => logger.info(message, ...args), // log方法映射到info
    
    // 提供logger实例的访问
    getLogger: () => logger,
    
    // 提供设置日志级别的方法
    setLogLevel: (level: LogLevel) => logger.setLogLevel(level),
    
    // 获取日志相关信息
    getLogFile: () => logger.getCurrentLogFile(),
    getLogDir: () => logger.getLogDir(),
    
    // 方便的方法别名
    d: (message: string, ...args: any[]) => logger.debug(message, ...args),   // debug简写
    i: (message: string, ...args: any[]) => logger.info(message, ...args),    // info简写
    w: (message: string, ...args: any[]) => logger.warn(message, ...args),    // warn简写
    e: (message: string, ...args: any[]) => logger.error(message, ...args),   // error简写
    
    // 专门的错误日志方法（自动格式化错误对象）
    logError: (message: string, error?: any, ...extraArgs: any[]) => {
        if (error instanceof Error) {
            logger.error(message, error, ...extraArgs);
        } else {
            logger.error(message, error, ...extraArgs);
        }
    }
};

// 使用CommonJS风格的导出来确保与现有代码兼容
export = loggerInterface;
