import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import * as path from 'path';
import { getInstance as getUpdateChecker } from '../../modules/updater/updateChecker';
import * as log from '../../modules/logger';

let tray: Tray | null = null;
let trayNotificationShown = false; // 托盘提示是否已显示过
let mainWindow: BrowserWindow | null = null; // 主窗口引用

/**
 * 创建系统托盘
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
export function createTray(mainWindowInstance: BrowserWindow): void {
    // 保存窗口引用
    mainWindow = mainWindowInstance;
    
    // 创建托盘图标
    const iconPath = path.join(__dirname, '../../../build/icon.ico');
    const icon = nativeImage.createFromPath(iconPath);
    
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    // 设置托盘提示文字
    tray.setToolTip('飞牛影视');
    
    // 创建托盘菜单
    const contextMenu = Menu.buildFromTemplate([
        {
            label: '显示主窗口',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    if (!mainWindow.isVisible()) mainWindow.show();
                    mainWindow.focus();
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
        },
        {
            type: 'separator'
        },
        {
            label: '退出',
            click: () => {
                // 真正退出应用
                (app as any).isQuiting = true;
                app.quit();
            }
        }
    ]);
    
    // 设置托盘菜单
    tray.setContextMenu(contextMenu);
    
    // 双击托盘图标恢复窗口
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    log.info('系统托盘创建成功');
}

/**
 * 显示托盘通知（仅在Windows上首次显示）
 */
export function showTrayNotification(): void {
    if (process.platform === 'win32' && !trayNotificationShown && tray) {
        tray.displayBalloon({
            iconType: 'info',
            title: '飞牛影视',
            content: '应用已最小化到托盘，双击托盘图标或右键菜单可以恢复窗口'
        });
        trayNotificationShown = true; // 标记已显示过提示
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
