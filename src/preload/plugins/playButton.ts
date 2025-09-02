// preload/plugins/playButton.ts
import { ipcRenderer } from 'electron';
import { registerHook } from '../core/hooks';
import { HookType } from '../core/hooks';
import logger from '../core/logger';
import { getCookie } from '../core/utils';
import type { PlayMovieData } from '../core/types';

// 发送播放信息到主进程
function sendPlayEventToMain(): void {
    const url = window.location.href;
    const id = url.split('/').pop();
    const token = getCookie('Trim-MC-token');
    
    if (id && token) {
        const playData: PlayMovieData = { id, token };
        ipcRenderer.send('play-movie', playData);
    }
}

// 基于共同DOM特征搜索播放按钮
function findReferenceButton(context: Document | Element = document): HTMLButtonElement | null {
    // 主要特征：特定播放图标路径
    const PLAY_ICON_PATH = "M5.984 18.819V5.18c0-1.739 1.939-2.776 3.386-1.812l10.228 6.82a2.177 2.177 0 010 3.623L9.37 20.63c-1.447.964-3.386-.073-3.386-1.812z";
    
    // 查找包含特定播放图标的按钮
    const buttonsWithPlayIcon = context.querySelectorAll('button');
    for (let i = 0; i < buttonsWithPlayIcon.length; i++) {
        const button = buttonsWithPlayIcon[i];
        // 检测特定播放图标
        const icon = button.querySelector('svg > path[d^="M5.984"]') as SVGPathElement;
        if (icon && icon.getAttribute('d')?.startsWith(PLAY_ICON_PATH.substring(0, 10))) {
            return button as HTMLButtonElement;
        }
        
        // 备用检测：按钮类名组合
        const classes = button.getAttribute('class') || '';
        if (classes.includes('semi-button') && 
            classes.includes('semi-button-primary') && 
            classes.includes('!min-w-[150px]')) {
            return button as HTMLButtonElement;
        }
    }
    
    return null;
}

function clonePlayBtnAndInject(callback: () => void, btnText: string): void {
    const referenceButton = findReferenceButton();
    if (!referenceButton || referenceButton.hasAttribute('data-mpv-btn')) return;

    logger.info('Detected inject page, injecting play button...');
    
    // 标记原始按钮
    referenceButton.setAttribute('data-mpv-btn', 'processed');
    
    // 克隆并修改按钮
    const newButton = referenceButton.cloneNode(true) as HTMLButtonElement;
    newButton.removeAttribute('data-mpv-btn');
    
    // 更新按钮文本（保留图标）
    const textSpans = newButton.querySelector('span > span > span') as HTMLSpanElement;
    if (textSpans) textSpans.textContent = btnText;
    
    // 添加唯一标识
    newButton.setAttribute('data-custom-play', 'true');
    
    // 添加点击事件
    newButton.addEventListener('click', callback);
    
    // 插入到参考按钮旁边
    const parentNode = referenceButton.parentNode;
    if (parentNode) {
        parentNode.insertBefore(newButton, referenceButton.nextSibling);
    }
}

function injectCustomPlayBtn(): void {
    clonePlayBtnAndInject(sendPlayEventToMain, 'MPV播放');
}

// 注册hook
registerHook(HookType.OnReady, injectCustomPlayBtn);
registerHook(HookType.OnDomChange, injectCustomPlayBtn);

export {};
