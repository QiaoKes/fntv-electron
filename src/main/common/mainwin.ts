import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';

const mainwinConfig: BrowserWindowConstructorOptions = {
    width: 1400,
    height: 800,
    minWidth: 800,
    minHeight: 800,
    autoHideMenuBar: true,
    show: false,
    icon: path.join(__dirname, '../../../build/icon.ico'),
    frame: false,
    // transparent: true,
    webPreferences: {
        webgl: true,
        partition: 'persist:fntv',
        preload: path.join(__dirname, '../../preload/index.js'),
        nodeIntegration: true,   // 开启 Node.js 支持
        contextIsolation: false,  // 如果 preload 里要直接改 DOM，通常要关掉
        spellcheck: false,  // 禁用拼写检查，避免输入法干扰
    }
};

let mainwin: BrowserWindow | null = null;

/**
 * 获取主窗口实例
 * @returns {BrowserWindow}
 */
export function getMainWindow(): BrowserWindow {
    if (!mainwin) {
        mainwin = new BrowserWindow(mainwinConfig);
    }
    return mainwin;
}
