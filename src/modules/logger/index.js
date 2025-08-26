const { logger } = require('./logger');

/**
 * 简化的日志接口，替换console的使用
 * 用法：
 * const log = require('./path/to/logger');
 * log.info('这是一条信息');
 * log.error('这是一个错误', error);
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
    getLogDir: () => logger.getLogDir()
};
