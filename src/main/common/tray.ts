import { Tray, Menu, nativeImage, BrowserWindow, app, dialog } from 'electron';
import * as path from 'path';
import { getInstance as getUpdateChecker } from '../../modules/updater/updateChecker';
import { setMacCloseAction, getTrayNotificationShown, setTrayNotificationShown } from './preferences';
import * as log from '../../modules/logger';

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null; // 主窗口引用

/**
 * 创建系统托盘
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
export function createTray(mainWindowInstance: BrowserWindow): void {
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
    } else {
        // Windows 和 Linux 使用 ICO 格式
        iconPath = path.join(__dirname, '../../../build/icon.ico');
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
    
    // 创建托盘菜单
    const menuTemplate: Electron.MenuItemConstructorOptions[] = [
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
    }
    
    menuTemplate.push(
        {
            type: 'separator'
        },
        {
            label: process.platform === 'darwin' ? '退出飞牛影视' : '退出',
            click: () => {
                // 真正退出应用
                (app as any).isQuiting = true;
                app.quit();
            }
        }
    );
    
    const contextMenu = Menu.buildFromTemplate(menuTemplate);
    
    // 设置托盘菜单
    tray.setContextMenu(contextMenu);
    
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
    } else {
        // Windows 和 Linux 上双击托盘图标恢复窗口
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
