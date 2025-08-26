const fs = require('fs');
const path = require('path');
const { logConfig, getLogLevel, LogLevel } = require('./config');
const { maskLogArguments, maskError } = require('./masking');

// 尝试获取app模块，在非Electron环境中可能失败
let app;
try {
    app = require('electron').app;
} catch (error) {
    // 在非Electron环境中使用备用方案
    app = null;
}

/**
 * 日志级别名称映射
 */
const LogLevelNames = {
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR'
};

/**
 * 日志模块类
 */
class Logger {
    constructor() {
        this.logLevel = getLogLevel(); // 使用配置获取日志级别
        this.maxFileSize = logConfig.maxFileSize;
        this.maxFiles = logConfig.maxFiles;
        this.logDir = this.getLogDirectory();
        this.currentLogFile = path.join(this.logDir, 'app.log');
        
        // 确保日志目录存在
        this.ensureLogDirectory();
        
        // 初始化时检查并清理旧的日志文件
        this.cleanupOldLogs();
    }

    /**
     * 获取日志目录路径
     */
    getLogDirectory() {
        if (app) {
            // 在Electron环境中，使用应用安装目录下的log文件夹
            const appPath = app.getAppPath();
            const isPackaged = app.isPackaged;
            
            if (isPackaged) {
                // 打包后，使用可执行文件所在目录的log文件夹
                const execPath = process.execPath;
                const execDir = path.dirname(execPath);
                return path.join(execDir, 'log');
            } else {
                // 开发环境，使用项目根目录的log文件夹
                return path.join(appPath, 'log');
            }
        } else {
            // 非Electron环境，使用当前工作目录的log文件夹
            return path.join(process.cwd(), 'log');
        }
    }

    /**
     * 确保日志目录存在
     */
    ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.logDir)) {
                fs.mkdirSync(this.logDir, { recursive: true });
            }
        } catch (error) {
            console.error('创建日志目录失败:', error.message);
        }
    }

    /**
     * 检查并轮转日志文件
     */
    checkLogRotation() {
        try {
            if (fs.existsSync(this.currentLogFile)) {
                const stats = fs.statSync(this.currentLogFile);
                if (stats.size >= this.maxFileSize) {
                    this.rotateLogFile();
                }
            }
        } catch (error) {
            console.error('检查日志轮转失败:', error.message);
        }
    }

    /**
     * 轮转日志文件
     */
    rotateLogFile() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const rotatedFile = path.join(this.logDir, `app-${timestamp}.log`);
            
            // 移动当前日志文件
            if (fs.existsSync(this.currentLogFile)) {
                fs.renameSync(this.currentLogFile, rotatedFile);
            }
            
            // 清理超过限制的旧日志文件
            this.cleanupOldLogs();
        } catch (error) {
            console.error('轮转日志文件失败:', error.message);
        }
    }

    /**
     * 清理旧的日志文件，只保留最近的几个
     */
    cleanupOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir)
                .filter(file => file.startsWith('app-') && file.endsWith('.log'))
                .map(file => ({
                    name: file,
                    path: path.join(this.logDir, file),
                    mtime: fs.statSync(path.join(this.logDir, file)).mtime
                }))
                .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序排列

            // 删除超过保留数量的文件
            if (files.length > this.maxFiles - 1) { // -1 因为当前日志文件不在这个列表中
                const filesToDelete = files.slice(this.maxFiles - 1);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (error) {
                        console.error(`删除旧日志文件失败: ${file.name}`, error.message);
                    }
                });
            }
        } catch (error) {
            console.error('清理旧日志文件失败:', error.message);
        }
    }

    /**
     * 格式化日志消息
     */
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const levelName = LogLevelNames[level];
        
        // 对参数进行脱敏处理
        const maskedArgs = maskLogArguments(message, ...args);
        const [maskedMessage, ...restMaskedArgs] = maskedArgs;
        
        const formattedArgs = restMaskedArgs.length > 0 ? ' ' + restMaskedArgs.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ') : '';
        
        return `[${timestamp}] [${levelName}] ${maskedMessage}${formattedArgs}`;
    }

    /**
     * 写入日志到文件
     */
    writeToFile(formattedMessage) {
        try {
            // 检查是否需要轮转日志
            this.checkLogRotation();
            
            // 写入日志
            fs.appendFileSync(this.currentLogFile, formattedMessage + '\n', 'utf8');
        } catch (error) {
            console.error('写入日志文件失败:', error.message);
        }
    }

    /**
     * 通用日志方法
     */
    log(level, message, ...args) {
        if (level >= this.logLevel) {
            const formattedMessage = this.formatMessage(level, message, ...args);
            
            // 写入文件
            this.writeToFile(formattedMessage);
            
            // 同时输出到控制台（开发环境）
            if (logConfig.consoleOutput && (!app || !app.isPackaged)) {
                switch (level) {
                    case LogLevel.DEBUG:
                        console.log(formattedMessage);
                        break;
                    case LogLevel.INFO:
                        console.info(formattedMessage);
                        break;
                    case LogLevel.WARN:
                        console.warn(formattedMessage);
                        break;
                    case LogLevel.ERROR:
                        console.error(formattedMessage);
                        break;
                }
            }
        }
    }

    /**
     * Debug级别日志
     */
    debug(message, ...args) {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    /**
     * Info级别日志
     */
    info(message, ...args) {
        this.log(LogLevel.INFO, message, ...args);
    }

    /**
     * Warn级别日志
     */
    warn(message, ...args) {
        this.log(LogLevel.WARN, message, ...args);
    }

    /**
     * Error级别日志
     */
    error(message, ...args) {
        // 特殊处理错误对象
        const processedArgs = args.map(arg => {
            if (arg instanceof Error) {
                return maskError(arg);
            }
            return arg;
        });
        
        this.log(LogLevel.ERROR, message, ...processedArgs);
    }

    /**
     * 设置日志级别
     */
    setLogLevel(level) {
        this.logLevel = level;
    }

    /**
     * 获取当前日志文件路径
     */
    getCurrentLogFile() {
        return this.currentLogFile;
    }

    /**
     * 获取日志目录路径
     */
    getLogDir() {
        return this.logDir;
    }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = {
    Logger,
    LogLevel,
    logger
};
