const { logger } = require('./logger');

/**
 * 简化的日志接口，替换console的使用
 * 自动进行数据脱敏，对使用者完全透明
 * 用法：
 * const log = require('./path/to/logger');
 * log.info('这是一条信息');
 * log.error('这是一个错误', error);
 * log.debug('用户信息:', { username: 'admin', password: '123456' }); // 密码会被自动脱敏
 */
module.exports = {
    debug: (...args) => logger.debug(...args),
    info: (...args) => logger.info(...args),
    warn: (...args) => logger.warn(...args),
    error: (...args) => logger.error(...args),
    log: (...args) => logger.info(...args), // log方法映射到info
    
    // 提供logger实例的访问
    getLogger: () => logger,
    
    // 提供设置日志级别的方法
    setLogLevel: (level) => logger.setLogLevel(level),
    
    // 获取日志相关信息
    getLogFile: () => logger.getCurrentLogFile(),
    getLogDir: () => logger.getLogDir(),
    
    // 方便的方法别名
    d: (...args) => logger.debug(...args),   // debug简写
    i: (...args) => logger.info(...args),    // info简写
    w: (...args) => logger.warn(...args),    // warn简写
    e: (...args) => logger.error(...args),   // error简写
    
    // 专门的错误日志方法（自动格式化错误对象）
    logError: (message, error, ...extraArgs) => {
        if (error instanceof Error) {
            logger.error(message, error, ...extraArgs);
        } else {
            logger.error(message, error, ...extraArgs);
        }
    }
};
