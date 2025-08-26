/**
 * 日志级别枚举
 */
const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

/**
 * 日志配置
 */
const logConfig = {
    // 默认日志级别
    defaultLevel: LogLevel.INFO,
    
    // 开发环境日志级别
    developmentLevel: LogLevel.DEBUG,
    
    // 生产环境日志级别
    productionLevel: LogLevel.INFO,
    
    // 最大文件大小 (字节)
    maxFileSize: 10 * 1024 * 1024, // 10MB
    
    // 最大文件数量
    maxFiles: 3,
    
    // 是否在控制台也输出日志（开发环境）
    consoleOutput: true,
    
    // 日志格式配置
    format: {
        timestamp: true,
        level: true,
        colors: false // 文件日志不使用颜色
    }
};

/**
 * 根据环境获取适当的日志级别
 */
function getLogLevel() {
    // 首先检查环境变量
    if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod') {
        return logConfig.productionLevel;
    }
    
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev') {
        return logConfig.developmentLevel;
    }
    
    // 尝试获取app模块来判断是否为打包环境
    let isPackaged = false;
    try {
        const { app } = require('electron');
        isPackaged = app ? app.isPackaged : false;
        
        // 如果成功获取到app对象，则使用isPackaged判断
        return isPackaged ? logConfig.productionLevel : logConfig.developmentLevel;
    } catch (error) {
        // 在非Electron环境中，如果没有明确的环境变量，默认为开发环境
        return logConfig.developmentLevel;
    }
}

module.exports = {
    logConfig,
    getLogLevel,
    LogLevel
};
