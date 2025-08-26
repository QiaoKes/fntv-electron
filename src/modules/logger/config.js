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
    // 尝试获取app模块来判断是否为打包环境
    let isPackaged = false;
    try {
        const { app } = require('electron');
        isPackaged = app ? app.isPackaged : false;
    } catch (error) {
        // 在非Electron环境中，假设为开发环境
        isPackaged = false;
    }
    
    return isPackaged ? logConfig.productionLevel : logConfig.developmentLevel;
}

module.exports = {
    logConfig,
    getLogLevel,
    LogLevel
};
