import { app, BrowserWindow, dialog, Notification } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { registerAllPlugins } from '../handlers';
import { getInstance as getUpdateChecker } from '../../modules/updater/updateChecker';
import * as winctrl from './winctrl';
import { createTray, showTrayNotification, destroyTray } from './tray';
import { getMacCloseAction, setMacCloseAction, getTrayNotificationShown, setTrayNotificationShown } from './preferences';
import * as log from '../../modules/logger';
import { getDaemonInstance, ProxyDaemon } from './proxyDaemon';


// 全局守护程序实例
let proxyDaemon: ProxyDaemon | null = null;
let restartScheduled = false;

// 获取应用中的proxy可执行文件路径
function getProxyExecPath(): string {
    // 检查是否在开发环境（未打包）
    if (!app.isPackaged) {
        // 未打包时使用相对路径
        return process.platform === 'win32' 
            ? ".\\third_party\\proxy\\proxy.exe"
            : "./third_party/proxy/proxy";
    }

    // 已打包情况下的路径处理
    if (process.platform === 'darwin') {
        // macOS: third_party目录在应用包的Contents目录下，而不是在app.asar内
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath)); // 从app.asar向上两级到Contents
        return path.join(contentsPath, 'third_party', 'proxy', 'proxy');
    } else if (process.platform === 'win32') {
        return ".\\third_party\\proxy\\proxy.exe";
    } else {
        // Linux: 构建时只复制了proxy目录内容到third_party/proxy
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath));
        return path.join(contentsPath, 'third_party', 'proxy', 'proxy');
    }
}

// 启动proxy模块的函数
export async function startProxyProcess(): Promise<ChildProcess> {
    const proxyPath = getProxyExecPath();

    // 检查可执行文件是否存在
    if (!fs.existsSync(proxyPath)) {
        const errorMsg = `Proxy可执行文件不存在`;
        const detailMsg = `文件路径: ${proxyPath}\n\n请确保已正确编译proxy模块。\n编译命令: npm run build:proxy`;
        log.error(errorMsg + ': ' + proxyPath);
        dialog.showErrorBox('启动失败 - 文件不存在', errorMsg + '\n\n' + detailMsg);
        throw new Error(errorMsg);
    }

    try {
        // 启动proxy进程
        const proxyProcess = spawn(proxyPath, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false,
            env: { ...process.env, LANG: 'C.UTF-8' } // 设置UTF-8编码环境
        });

        log.info('正在启动proxy进程...');

        // 等待proxy进程启动成功
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                const errorMsg = 'Proxy进程启动超时';
                const detailMsg = `等待时间: 10秒\n可执行文件: ${proxyPath}\n\n可能的原因:\n• Proxy程序启动缓慢\n• 端口2345被占用\n• 系统资源不足\n\n建议检查:\n1. 确认端口2345未被其他程序占用\n2. 查看系统资源使用情况\n3. 重新编译proxy模块`;
                log.error(errorMsg);
                reject(new Error(errorMsg + '\n' + detailMsg));
            }, 10000); // 10秒超时

            proxyProcess.on('error', (error) => {
                clearTimeout(timeout);
                const errorMsg = `Proxy进程启动失败`;
                const detailMsg = `错误详情: ${error.message}\n可执行文件: ${proxyPath}\n\n可能的原因:\n• 文件损坏或权限不足\n• 缺少必要的动态库\n• 系统兼容性问题\n\n建议检查:\n1. 确认文件完整性\n2. 检查文件执行权限\n3. 查看系统日志`;
                log.error(errorMsg + ': ' + error.message);
                reject(new Error(errorMsg + '\n' + detailMsg));
            });

            // 监听stdout来确认进程已启动
            proxyProcess.stdout?.on('data', (data) => {
                const output = data.toString('utf8');
                log.noformat(output);
                // 检查启动成功的标志
                if (output.includes('启动') || output.includes('listening') || output.includes('server') || output.includes('运行')) {
                    clearTimeout(timeout);
                    resolve();
                }
            });

            proxyProcess.stderr?.on('data', (data) => {
                const output = data.toString('utf8');
                log.error('Proxy stderr:', output);
            });

            // 如果进程在短时间内没有错误，认为启动成功
            setTimeout(() => {
                if (proxyProcess && !proxyProcess.killed) {
                    clearTimeout(timeout);
                    resolve();
                }
            }, 2000);
        });

        log.info('Proxy模块启动成功');

        // 初始化或更新守护程序
        if (!proxyDaemon) {
            proxyDaemon = getDaemonInstance({
                restartDelay: 3000,
                maxRestartAttempts: 5,
                restartAttemptResetTime: 60000,
                enableHeartbeat: true,
                heartbeatInterval: 5000,
            });
        }

        // 设置重启回调
        const handleProxyRestart = async (attempts: number) => {
            if (restartScheduled) return;
            restartScheduled = true;

            // 延迟重启，避免频繁重启
            setTimeout(async () => {
                try {
                    log.info(`尝试重启Proxy进程 (第 ${attempts} 次)...`);
                    const newProxyProcess = await startProxyProcessInternal();
                    if (proxyDaemon) {
                        proxyDaemon.updateProcess(newProxyProcess);
                    }
                    restartScheduled = false;
                } catch (error) {
                    const errorObj = error instanceof Error ? error : new Error(String(error));
                    log.error('Proxy进程重启失败:', errorObj.message);
                    restartScheduled = false;
                }
            }, 3000);
        };

        // 启用守护程序监控
        proxyDaemon.watchProcess(proxyProcess, handleProxyRestart);

        return proxyProcess;

    } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        const errorMsg = `启动proxy模块失败`;
        const detailMsg = `错误详情: ${errorObj.message}\n\n这通常表示:\n• Proxy程序无法正常启动\n• 网络或端口配置问题\n• 系统环境配置错误\n\n请检查上述错误详情并尝试解决。\n如果问题持续，请查看应用程序日志获取更多信息。`;
        log.error(errorMsg + ': ' + errorObj.message);
        dialog.showErrorBox('启动失败', errorMsg + '\n\n' + detailMsg);
        throw error;
    }
}

/**
 * 内部启动函数（用于重启）
 */
async function startProxyProcessInternal(): Promise<ChildProcess> {
    const proxyPath = getProxyExecPath();

    // 启动proxy进程
    const proxyProcess = spawn(proxyPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        env: { ...process.env, LANG: 'C.UTF-8' }
    });

    log.info('正在启动proxy进程（重启）...');

    // 等待proxy进程启动成功
    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Proxy进程重启启动超时'));
        }, 10000);

        proxyProcess.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });

        proxyProcess.stdout?.on('data', (data) => {
            const output = data.toString('utf8');
            log.noformat(output);
            if (output.includes('启动') || output.includes('listening') || output.includes('server') || output.includes('运行')) {
                clearTimeout(timeout);
                resolve();
            }
        });

        proxyProcess.stderr?.on('data', (data) => {
            const output = data.toString('utf8');
            log.error('Proxy stderr:', output);
        });

        setTimeout(() => {
            if (proxyProcess && !proxyProcess.killed) {
                clearTimeout(timeout);
                resolve();
            }
        }, 2000);
    });

    return proxyProcess;
}

/**
 * 优雅关闭Proxy进程（用于应用退出）
 */
export async function shutdownProxyProcess(): Promise<void> {
    if (proxyDaemon) {
        await proxyDaemon.shutdown();
        proxyDaemon = null;
    }
}