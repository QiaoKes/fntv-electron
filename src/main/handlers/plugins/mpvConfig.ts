import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as logger from '../../../modules/logger';

/**
 * MPV配置文件管理插件
 * 定时检查用户配置目录中的scripts文件夹，不存在则从应用中复制
 */

let configCheckInterval: NodeJS.Timeout | null = null;

// 获取用户MPV配置目录
function getMpvConfigDir(): string {
    const homeDir = os.homedir();
    if (process.platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Roaming', 'mpv');
    } else {
        return path.join(homeDir, '.config', 'mpv');
    }
}

// 获取应用中的portable_config目录
function getPortableConfigDir(): string {
    if (process.platform === 'darwin') {
        // macOS: third_party目录在应用包的Contents目录下，而不是在app.asar内
        // 构建时只复制了portable_config目录内容到third_party/fntv-mpv/portable_config
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath)); // 从app.asar向上两级到Contents
        return path.join(contentsPath, 'third_party', 'fntv-mpv', 'portable_config');
    } else if (process.platform === 'win32') {
        // Windows: 复制了完整的fntv-mpv目录，包含portable_config子目录
        const appPath = app.getAppPath();
        return path.join(appPath, 'third_party', 'fntv-mpv', 'portable_config');
    } else {
        // Linux: 构建时只复制了portable_config目录内容到third_party/fntv-mpv/portable_config
        const appPath = app.getAppPath();
        return path.join(path.dirname(appPath), 'third_party', 'fntv-mpv', 'portable_config');
    }
}

// 递归复制目录
function copyDirectoryRecursive(source: string, destination: string): void {
    if (!fs.existsSync(source)) {
        logger.log(`Source directory does not exist: ${source}`);
        return;
    }

    // 创建目标目录
    if (!fs.existsSync(destination)) {
        fs.mkdirSync(destination, { recursive: true });
    }

    const items = fs.readdirSync(source);

    items.forEach(item => {
        const sourcePath = path.join(source, item);
        const destPath = path.join(destination, item);

        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
            copyDirectoryRecursive(sourcePath, destPath);
        } else {
            fs.copyFileSync(sourcePath, destPath);
            logger.log(`Copied: ${sourcePath} -> ${destPath}`);
        }
    });
}

// 检查并复制配置文件
function checkAndCopyMpvConfig(): void {
    try {
        const mpvConfigDir = getMpvConfigDir();
        const scriptsDir = path.join(mpvConfigDir, 'scripts');
        const portableConfigDir = getPortableConfigDir();

        // 检查scripts目录是否存在
        if (!fs.existsSync(scriptsDir)) {
            logger.log(`Scripts directory not found, copying from portable config...`);

            // 确保MPV配置目录存在
            if (!fs.existsSync(mpvConfigDir)) {
                fs.mkdirSync(mpvConfigDir, { recursive: true });
                logger.log(`Created MPV config directory: ${mpvConfigDir}`);
            }

            // 复制portable_config目录中的所有内容到用户配置目录
            if (fs.existsSync(portableConfigDir)) {
                copyDirectoryRecursive(portableConfigDir, mpvConfigDir);
                logger.log(`MPV configuration copied successfully from ${portableConfigDir} to ${mpvConfigDir}`);
            } else {
                logger.log(`Portable config directory not found: ${portableConfigDir}`);
            }
        } else {
            logger.debug(`Scripts directory already exists: ${scriptsDir}`);
        }
    } catch (error) {
        logger.error('Error in checkAndCopyMpvConfig:', error);
    }
}

// 启动定时检查
function startConfigCheck(): void {
    // 立即执行一次检查
    checkAndCopyMpvConfig();

    // 设置定时检查（每分钟检查一次）
    configCheckInterval = setInterval(() => {
        checkAndCopyMpvConfig();
    }, 60 * 1000);

    logger.info('MPV config check started, checking every 1 minute');
}

// 停止定时检查
function stopConfigCheck(): void {
    if (configCheckInterval) {
        clearInterval(configCheckInterval);
        configCheckInterval = null;
        logger.info('MPV config check stopped');
    }
}

// 插件初始化函数
function init(): void {
    logger.info('Initializing MPV Config Plugin...');
    // 只在macOS和Linux上执行
    if (process.platform === 'win32') {
        return;
    }

    startConfigCheck();
    // 应用退出前停止检查
    app.on('before-quit', () => {
        stopConfigCheck();
    });
}

export {
    init
};