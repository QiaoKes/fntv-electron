import { app, BrowserWindow, dialog, Notification } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { registerAllPlugins } from './handlers';
import { getInstance as getUpdateChecker } from '../modules/updater/updateChecker';
import * as winctrl from './common/winctrl';
import { createTray, showTrayNotification, destroyTray } from './common/tray';
import { getMacCloseAction, setMacCloseAction, getTrayNotificationShown, setTrayNotificationShown } from './common/preferences';
import * as log from '../modules/logger';


// 获取应用中的proxy可执行文件路径
function getProxyExecPath(): string {
    if (process.platform === 'darwin') {
        // macOS: third_party目录在应用包的Contents目录下，而不是在app.asar内
        // 构建时只复制了proxy目录内容到third_party/proxy
        const appPath = app.getAppPath();
        const contentsPath = path.dirname(path.dirname(appPath)); // 从app.asar向上两级到Contents
        return path.join(contentsPath, 'third_party', 'proxy', 'proxy');
    } else if (process.platform === 'win32') {
        return ".\\third_party\\proxy\\proxy.exe";
    } else {
        // Linux: 构建时只复制了proxy目录内容到third_party/proxy
        const appPath = app.getAppPath();
        return path.join(path.dirname(appPath), 'third_party', 'proxy', 'proxy');
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
                log.info('Proxy stdout:', output);
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

        // 设置进程退出处理
        proxyProcess.on('close', (code) => {
            log.info('Proxy进程退出，退出码:', code);
            // 弹窗提示
            dialog.showErrorBox('Proxy模块已退出', `Proxy模块意外退出，退出码: ${code}\n请检查日志以获取更多信息。`);
            app.quit();
        });

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