import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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
    const appPath = app.getAppPath();
    return path.join(appPath, 'third_party', 'fntv-mpv', 'portable_config');
}

// 递归复制目录
function copyDirectoryRecursive(source: string, destination: string): void {
    if (!fs.existsSync(source)) {
        console.log(`Source directory does not exist: ${source}`);
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
            console.log(`Copied: ${sourcePath} -> ${destPath}`);
        }
    });
}

// 检查并复制配置文件
function checkAndCopyMpvConfig(): void {
    try {
        // 只在macOS和Linux上执行
        if (process.platform === 'win32') {
            return;
        }

        const mpvConfigDir = getMpvConfigDir();
        const scriptsDir = path.join(mpvConfigDir, 'scripts');
        const portableConfigDir = getPortableConfigDir();

        // 检查scripts目录是否存在
        if (!fs.existsSync(scriptsDir)) {
            console.log(`Scripts directory not found, copying from portable config...`);
            
            // 确保MPV配置目录存在
            if (!fs.existsSync(mpvConfigDir)) {
                fs.mkdirSync(mpvConfigDir, { recursive: true });
                console.log(`Created MPV config directory: ${mpvConfigDir}`);
            }

            // 复制portable_config目录中的所有内容到用户配置目录
            if (fs.existsSync(portableConfigDir)) {
                copyDirectoryRecursive(portableConfigDir, mpvConfigDir);
                console.log(`MPV configuration copied successfully from ${portableConfigDir} to ${mpvConfigDir}`);
            } else {
                console.log(`Portable config directory not found: ${portableConfigDir}`);
            }
        } else {
            console.log(`Scripts directory already exists: ${scriptsDir}`);
        }
    } catch (error) {
        console.error('Error in checkAndCopyMpvConfig:', error);
    }
}

// 启动定时检查
function startConfigCheck(): void {
    // 立即执行一次检查
    checkAndCopyMpvConfig();
    
    // 设置定时检查（每分钟检查一次）
    configCheckInterval = setInterval(() => {
        checkAndCopyMpvConfig();
    }, 60 * 1000); // 60秒 = 1分钟
    
    console.log('MPV config check started, checking every 1 minute');
}

// 停止定时检查
function stopConfigCheck(): void {
    if (configCheckInterval) {
        clearInterval(configCheckInterval);
        configCheckInterval = null;
        console.log('MPV config check stopped');
    }
}

// 插件初始化函数 (符合项目的插件加载模式)
export function init(): void {
    console.log('Initializing MPV Config Plugin...');
    
    // 应用准备就绪后启动检查
    if (app.isReady()) {
        startConfigCheck();
    } else {
        app.whenReady().then(() => {
            startConfigCheck();
        });
    }
    
    // 应用退出前停止检查
    app.on('before-quit', () => {
        stopConfigCheck();
    });
}

// 手动触发检查（可选，用于调试）
export function triggerMpvConfigCheck(): void {
    checkAndCopyMpvConfig();
}
