import { Tray, Menu, nativeImage, BrowserWindow, app, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { getInstance as getUpdateChecker } from '../../modules/updater/updateChecker';
import { setMacCloseAction, getTrayNotificationShown, setTrayNotificationShown } from './preferences';
import * as log from '../../modules/logger';
import * as fnConfig from '../../modules/fn_config/config';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null; // 主窗口引用

/**
 * 创建设置子菜单
 */
async function createSettingsSubmenu(mainWindow: BrowserWindow | null): Promise<Electron.MenuItemConstructorOptions[]> {
    // 获取当前配置
    const proxyConfig = fnConfig.getDownloadProxyConfig();
    const hideOriginalPlayButton = fnConfig.getHideOriginalPlayButton();
    const nasProxyEnabled = fnConfig.getNasProxyEnabled();
    const currentMpvPath = fnConfig.getMpvPlayerPath();

    const submenu: Electron.MenuItemConstructorOptions[] = [
        {
            label: `下载代理: ${proxyConfig.enabled ? '开启' : '关闭'}`,
            type: 'checkbox',
            checked: proxyConfig.enabled,
            click: () => {
                const newEnabled = !proxyConfig.enabled;
                fnConfig.setDownloadProxyConfig({ enabled: newEnabled, proxyUrl: proxyConfig.proxyUrl });
                // 更新托盘菜单以刷新状态
                updateTrayMenu();
            }
        },
        {
            type: 'separator'
        },
        {
            label: `隐藏原始播放按钮`,
            type: 'checkbox',
            checked: hideOriginalPlayButton,
            click: () => {
                const newHide = !hideOriginalPlayButton;
                fnConfig.setHideOriginalPlayButton(newHide);
                // 更新托盘菜单以刷新状态
                updateTrayMenu();
            }
        },
        {
            type: 'separator'
        },
        {
            label: `NAS本地网盘代理: ${nasProxyEnabled ? '开启' : '关闭'}`,
            type: 'checkbox',
            checked: nasProxyEnabled,
            click: () => {
                const newEnabled = !nasProxyEnabled;
                fnConfig.setNasProxyEnabled(newEnabled);
                // 更新托盘菜单以刷新状态
                updateTrayMenu();
            }
        },
        {
            type: 'separator'
        },
        {
            label: `设置MPV播放器路径${currentMpvPath ? ` (${currentMpvPath})` : ''}`,
            click: async () => {
                if (mainWindow) {
                    const result = await dialog.showOpenDialog(mainWindow, {
                        title: '选择MPV播放器',
                        properties: ['openFile'],
                        filters: [
                            { name: '可执行文件', extensions: process.platform === 'win32' ? ['exe'] : [] },
                            { name: '所有文件', extensions: ['*'] }
                        ]
                    });

                    if (!result.canceled && result.filePaths.length > 0) {
                        const selectedPath = result.filePaths[0];
                        fnConfig.setMpvPlayerPath(selectedPath);

                        // 导入media模块并刷新MPV路径
                        try {
                            const media = await import('../handlers/plugins/media.js');
                            media.setMpvPlayerPath(selectedPath);
                            log.info(`MPV播放器路径已设置为: ${selectedPath}`);
                        } catch (error) {
                            log.error('刷新MPV播放器路径失败:', error);
                        }

                        // 更新托盘菜单以显示新路径
                        updateTrayMenu();
                    }
                }
            }
        },
        {
            label: '清空MPV播放器路径',
            enabled: !!currentMpvPath, // 只有当有设置路径时才启用
            click: async () => {
                fnConfig.setMpvPlayerPath(''); // 清空配置中的路径

                // 导入media模块并重置MPV路径
                try {
                    const media = await import('../handlers/plugins/media.js');
                    media.setMpvPlayerPath(null); // 传入null来清除缓存
                    log.info('MPV播放器路径已清空，将使用自动检测');
                } catch (error) {
                    log.error('清空MPV播放器路径失败:', error);
                }

                // 更新托盘菜单以刷新状态
                updateTrayMenu();
            }
        }
    ];

    return submenu;
}

/**
 * 更新托盘菜单
 */
async function updateTrayMenu(): Promise<void> {
    if (!tray) return;

    // 创建托盘菜单
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
        {
            label: '设置',
            submenu: await createSettingsSubmenu(mainWindow)
        },
        {
            type: 'separator'
        },
        {
            label: process.platform === 'darwin' ? '显示窗口' : '显示主窗口',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    if (!mainWindow.isVisible()) mainWindow.show();
                    mainWindow.focus();

                    // macOS 特有：确保应用在 dock 中显示
                    if (process.platform === 'darwin') {
                        app.dock?.show();
                    }
                }
            }
        },
        {
            type: 'separator'
        },
        {
            label: '检查更新',
            click: () => {
                getUpdateChecker().manualCheckForUpdates().catch(error => {
                    log.error('手动检查更新失败:', error);
                });
            }
        }
    ];

    // 在 macOS 上添加偏好设置选项
    if (process.platform === 'darwin') {
        menuTemplate.push(
            {
                type: 'separator'
            },
            {
                label: '关闭行为设置',
                click: async () => {
                    if (mainWindow) {
                        const result = await dialog.showMessageBox(mainWindow, {
                            type: 'question',
                            title: '关闭行为设置',
                            message: '设置点击关闭按钮时的行为',
                            detail: '您可以选择关闭窗口时的默认行为。',
                            buttons: ['隐藏到状态栏', '退出应用', '每次询问', '取消'],
                            defaultId: 2,
                            cancelId: 3
                        });

                        switch (result.response) {
                            case 0:
                                setMacCloseAction('minimize');
                                break;
                            case 1:
                                setMacCloseAction('quit');
                                break;
                            case 2:
                                setMacCloseAction('ask');
                                break;
                        }
                    }
                }
            }
        );
    } else {
        // Windows 和 Linux 上添加退出模式设置
        menuTemplate.push(
            {
                type: 'separator'
            },
            {
                label: '退出行为设置',
                click: async () => {
                    if (mainWindow) {
                        const result = await dialog.showMessageBox(mainWindow, {
                            type: 'question',
                            title: '退出行为设置',
                            message: '设置点击退出时的行为',
                            detail: '您可以选择单击退出时的默认行为。',
                            buttons: ['直接退出', '最小化到托盘', '每次询问', '取消'],
                            defaultId: 2,
                            cancelId: 3
                        });

                        switch (result.response) {
                            case 0:
                                fnConfig.setExitMode('direct');
                                break;
                            case 1:
                                fnConfig.setExitMode('minimize');
                                break;
                            case 2:
                                fnConfig.setExitMode('ask');
                                break;
                        }
                    }
                }
            }
        );
    }

    menuTemplate.push(
        {
            type: 'separator'
        },
        {
            label: process.platform === 'darwin' ? '退出飞牛影视' : '退出',
            click: () => {
                // 托盘菜单中的退出按钮直接退出应用
                (app as any).isQuiting = true;
                app.quit();
            }
        }
    );

    const contextMenu = Menu.buildFromTemplate(menuTemplate);

    // 更新托盘菜单
    tray.setContextMenu(contextMenu);
}

/**
 * 创建系统托盘
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
export async function createTray(mainWindowInstance: BrowserWindow): Promise<void> {
    // 保存窗口引用
    mainWindow = mainWindowInstance;

    // 根据平台选择合适的图标
    let iconPath: string;
    let icon: Electron.NativeImage;

    if (process.platform === 'darwin') {
        // macOS 推荐用 template 图标
        iconPath = path.join(__dirname, '../../../build/iconTemplate2.png');
        icon = nativeImage.createFromPath(iconPath);

        if (icon.isEmpty()) {
            // fallback: 用通用图标
            iconPath = path.join(__dirname, '../../../build/icon.png');
            icon = nativeImage.createFromPath(iconPath);

            if (!icon.isEmpty()) {
                // 尺寸适配状态栏（通常 16x16 即可，Retina 自动缩放）
                icon = icon.resize({ width: 16, height: 16 });
            }
        }

        if (!icon.isEmpty()) {
            icon.setTemplateImage(true); // 关键：启用 macOS 自动浅色/深色模式适配
        }
    } else if (process.platform === 'win32') {
        // Windows 使用 ICO 格式
        iconPath = path.join(__dirname, '../../../build/icon.ico');
        icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
            icon = icon.resize({ width: 16, height: 16 });
        }
    } else {
        // Linux 使用 PNG 格式
        iconPath = path.join(__dirname, '../../../build/icon.png');
        icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
            icon = icon.resize({ width: 16, height: 16 });
        }
    }

    // 如果图标仍然为空，记录错误但继续创建托盘
    if (icon.isEmpty()) {
        log.warn('托盘图标加载失败，使用默认图标');
        // 创建一个简单的默认图标
        icon = nativeImage.createEmpty();
    }

    tray = new Tray(icon);

    // 设置托盘提示文字
    tray.setToolTip('飞牛影视');

    // 初始创建菜单
    await updateTrayMenu();

    // 根据平台设置不同的点击行为
    if (process.platform === 'darwin') {
        // macOS 上单击托盘图标恢复窗口
        tray.on('click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                if (!mainWindow.isVisible()) mainWindow.show();
                mainWindow.focus();
                app.dock?.show();
            }
        });
    } else if (process.platform === 'win32') {
        // Windows上双击托盘图标恢复窗口
        tray.on('double-click', () => {
            if (mainWindow) {
                if (mainWindow.isMinimized()) mainWindow.restore();
                if (!mainWindow.isVisible()) mainWindow.show();
                mainWindow.focus();
            }
        });
    }

    log.info('系统托盘创建成功');
}

/**
 * 显示托盘通知（仅在Windows上首次显示）
 */
export function showTrayNotification(): void {
    if (process.platform === 'win32' && !getTrayNotificationShown() && tray) {
        tray.displayBalloon({
            iconType: 'info',
            title: '飞牛影视',
            content: '应用已最小化到托盘，双击托盘图标或右键菜单可以恢复窗口'
        });
        setTrayNotificationShown(true); // 标记已显示过提示
    }
}

/**
 * 销毁托盘
 */
export function destroyTray(): void {
    if (tray) {
        tray.destroy();
        tray = null;
        log.info('系统托盘已销毁');
    }
}

/**
 * 获取托盘实例
 * @returns {Tray|null} 托盘实例
 */
export function getTray(): Tray | null {
    return tray;
}
