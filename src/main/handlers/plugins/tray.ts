import { app } from 'electron';
import { registerAppHook } from '../core/appHook';
import { destroyTray } from '../../common/tray';

declare global {
    namespace NodeJS {
        interface Global {
            app: {
                isQuiting?: boolean;
            };
        }
    }
}

// 注册 window-all-closed 事件
function handleWindowAllClosed(): void {
    if (process.platform !== 'darwin') {
        // 在非 macOS 平台上，如果没有明确退出，则不退出应用
        if (!(app as any).isQuiting) {
            return;
        }
        app.quit();
    } else {
        // macOS 上的特殊处理：
        // 如果所有窗口都关闭了，但应用没有明确退出，保持应用运行
        // 这符合 macOS 应用的标准行为
        if (!(app as any).isQuiting) {
            return;
        }
        app.quit();
    }
}

// 注册 before-quit 事件
function handleBeforeQuit(): void {
    (app as any).isQuiting = true;
    destroyTray();
}

// 注册更新相关处理器
function init(): void {
    registerAppHook('windowAllClosed', handleWindowAllClosed);
    registerAppHook('beforeQuit', handleBeforeQuit);
}

export {
    init
};
