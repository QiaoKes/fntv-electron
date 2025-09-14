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
import { getMainWindow } from './common/mainwin';
import { isTrusted } from '../modules/cert_trust';
import { startProxyProcess } from './proxy';

// 禁用输入法自动切换
app.commandLine.appendSwitch('--lang', 'en-US');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');

// 抑制SSL相关的底层错误日志
app.commandLine.appendSwitch('--log-level', '3'); // 只显示致命错误
app.commandLine.appendSwitch('--disable-logging');
app.commandLine.appendSwitch('--silent');
app.commandLine.appendSwitch('--no-sandbox'); // 有助于减少某些安全相关日志
app.commandLine.appendSwitch('--disable-web-security'); // 禁用web安全检查（减少相关日志）
app.commandLine.appendSwitch('--ignore-ssl-errors-spki-list'); // 忽略SSL SPKI列表错误
app.commandLine.appendSwitch('--ignore-ssl-errors'); // 忽略SSL错误（减少相关日志）

let mainWindow: BrowserWindow | null = null;
let proxyProcess: ChildProcess | null = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    // 如果没有获取到锁，说明应用已经在运行，直接退出
    app.quit();
} else {
    // 当尝试启动第二个实例时，聚焦到现有窗口
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(async () => {
        try {
            // 初始化日志系统
            log.info('=== 飞牛影视启动 ===');
            log.info('应用版本:', app.getVersion());
            log.info('Electron版本:', process.versions.electron);
            log.info('Node.js版本:', process.versions.node);
            log.info('日志文件位置:', log.getLogFile());

            // 动态处理证书验证错误
            app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
                // 检查URL是否在信任列表中
                if (isTrusted(url)) {
                    // log.debug(`URL ${url} 在信任列表中，忽略证书验证错误: ${error}`);
                    event.preventDefault();
                    callback(true); // 信任证书
                } else {
                    log.warn(`证书验证错误: ${url}, 错误: ${error}`);
                    // 不在信任列表中，使用默认处理（不信任）
                    callback(false);
                }
            });

            // 启动代理服务器
            proxyProcess = await startProxyProcess();

            // 创建主窗口
            mainWindow = getMainWindow();

            // 注册所有插件
            registerAllPlugins();

            // 创建系统托盘
            createTray(mainWindow);

            // 设置窗口关闭事件
            setupWindowEvents(mainWindow);

            // 设置全屏切换
            winctrl.setupFullScreenToggle(mainWindow);

            // 禁用输入法自动切换
            winctrl.setupInputMethodDisable(mainWindow);

            // 设置窗口显示事件
            winctrl.setupWindowShowEvents(mainWindow);

            // 恢复 Cookie
            winctrl.setupCookieRestore(mainWindow);

            // 延迟3秒后进行自动更新检查，避免影响应用启动速度
            setTimeout(() => {
                getUpdateChecker().autoCheckForUpdates().catch((error: Error) => {
                    log.error('启动时自动检查更新失败:', error);
                });
            }, 3000);
        } catch (error) {
            log.error('应用启动失败:', error);
            app.quit();
        }
    });
}

// 设置窗口事件
function setupWindowEvents(mainWindow: BrowserWindow): void {
    if (mainWindow) {
        // 监听窗口关闭事件
        mainWindow.on('close', async (event) => {
            if (!(app as any).isQuiting) {
                if (process.platform === 'darwin') {
                    // macOS 上的特殊处理
                    const action = getMacCloseAction();
                    
                    if (action === 'ask') {
                        // 询问用户偏好
                        event.preventDefault();
                        
                        const result = await dialog.showMessageBox(mainWindow, {
                            type: 'question',
                            title: '关闭窗口',
                            message: '您希望如何处理窗口关闭？',
                            detail: '在 macOS 上，您可以选择隐藏到状态栏或完全退出应用。',
                            buttons: ['隐藏到状态栏', '退出应用', '取消'],
                            defaultId: 0,
                            cancelId: 2,
                            checkboxLabel: '记住我的选择',
                            checkboxChecked: false
                        });
                        
                        if (result.response === 0) {
                            // 隐藏到状态栏
                            if (result.checkboxChecked) {
                                setMacCloseAction('minimize');
                            }
                            mainWindow.hide();
                            app.dock?.hide();
                            showMacNotification();
                        } else if (result.response === 1) {
                            // 退出应用
                            if (result.checkboxChecked) {
                                setMacCloseAction('quit');
                            }
                            (app as any).isQuiting = true;
                            app.quit();
                        }
                        // 取消则什么都不做
                    } else if (action === 'minimize') {
                        // 直接隐藏到托盘
                        event.preventDefault();
                        mainWindow.hide();
                        app.dock?.hide();
                        showMacNotification();
                    } else if (action === 'quit') {
                        // 直接退出
                        (app as any).isQuiting = true;
                        app.quit();
                    }
                } else {
                    // Windows 和 Linux：阻止窗口关闭，改为隐藏到托盘
                    event.preventDefault();
                    mainWindow.hide();

                    // 显示托盘提示（仅在Windows上首次显示）
                    showTrayNotification();
                }
            }
        });
    }
}

// macOS 通知显示函数
function showMacNotification(): void {
    if (!getTrayNotificationShown()) {
        if (Notification.isSupported()) {
            const notification = new Notification({
                title: '飞牛影视',
                body: '应用已隐藏到状态栏，点击状态栏图标可以恢复窗口',
                silent: false
            });
            notification.show();
        }
        setTrayNotificationShown(true);
    }
}

// 应用退出事件处理
app.on('before-quit', async () => {
    (app as any).isQuiting = true;

    // 停止proxy进程
    if (proxyProcess) {
        log.info('应用退出前停止proxy进程');
        try {
            proxyProcess.kill('SIGTERM');
            // 等待进程退出，最多等待5秒
            setTimeout(() => {
                if (!proxyProcess?.killed) {
                    proxyProcess?.kill('SIGKILL');
                }
            }, 5000);
        } catch (error) {
            log.error('停止proxy进程失败:', error);
        }
    }

    // 销毁托盘图标
    destroyTray();
});

app.on('window-all-closed', () => {
    // 在 macOS 上，除非明确退出，否则应用程序及其菜单栏通常会保持活动状态
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // 在 macOS 上，当点击 dock 图标且没有其他窗口打开时，
    // 通常会重新创建一个窗口
    if (process.platform === 'darwin') {
        if (BrowserWindow.getAllWindows().length === 0) {
            mainWindow = getMainWindow();
            setupWindowEvents(mainWindow);
        } else if (mainWindow) {
            // 如果窗口存在但被隐藏，则显示它
            if (!mainWindow.isVisible()) {
                mainWindow.show();
            }
            mainWindow.focus();
        }
        
        // 确保 dock 图标显示
        app.dock?.show();
    }
});
