// preload/plugins/playButton.ts
import { ipcRenderer } from 'electron';
import { registerHook } from '../core/hooks';
import { HookType } from '../core/hooks';
import logger from '../core/logger';
import { getCookie } from '../core/utils';
import type { PlayMovieData } from '../core/types';

// 获取配置的辅助函数
async function getPlayButtonConfig(): Promise<{ hideOriginalPlayButton: boolean }> {
    return new Promise((resolve) => {
        // 发送请求获取配置
        ipcRenderer.send('get-play-button-config');

        // 监听回复
        const handler = (event: any, data: any) => {
            ipcRenderer.off('play-button-config-info', handler);
            resolve(data || { hideOriginalPlayButton: true }); // 默认隐藏
        };

        ipcRenderer.once('play-button-config-info', handler);

        // 2秒后超时，使用默认值
        setTimeout(() => {
            ipcRenderer.off('play-button-config-info', handler);
            resolve({ hideOriginalPlayButton: true });
        }, 2000);
    });
}

// 发送播放信息到主进程
function sendPlayEventToMain(button: HTMLElement | null = null): string | null {
    const url = window.location.href;
    const id = url.split('/').pop();

    if (!id) {
        logger.error('Failed to extract ID from DOM or URL');
        return null;
    }

    const token = getCookie('Trim-MC-token');

    if (id && token) {
        const playData: PlayMovieData = { id, token };
        ipcRenderer.send('play-movie', playData);
        return id;
    } else {
        logger.error('Failed to extract ID or token. ID:', id, 'Token:', token);
        return null;
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

function clonePlayBtnAndInject(callback: (button: HTMLElement) => void, btnText: string): void {
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

    // 添加点击事件，传入原始按钮作为参数
    newButton.addEventListener('click', () => callback(referenceButton));

    // 插入到参考按钮旁边
    const parentNode = referenceButton.parentNode;
    if (parentNode) {
        parentNode.insertBefore(newButton, referenceButton.nextSibling);
    }
}

// 拦截原有播放按钮，直接用MPV播放
function interceptOriginalButton(): void {
    const referenceButton = findReferenceButton();
    if (!referenceButton || referenceButton.hasAttribute('data-mpv-intercepted')) return;

    logger.info('Detected page, intercepting original play button...');

    // 标记已拦截
    referenceButton.setAttribute('data-mpv-intercepted', 'true');

    // 添加点击事件拦截器
    const clickHandler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        logger.info('Original play button intercepted, playing with MPV');
        sendPlayEventToMain(referenceButton);

        return false;
    };

    // 在捕获阶段添加事件监听器，确保优先拦截
    referenceButton.addEventListener('click', clickHandler, true);
}

async function injectCustomPlayBtn(): Promise<void> {
    // 获取配置
    const config = await getPlayButtonConfig();

    if (config.hideOriginalPlayButton) {
        // 如果隐藏原有播放按钮，直接拦截原按钮
        interceptOriginalButton();
    } else {
        // 否则添加额外的MPV播放按钮
        clonePlayBtnAndInject((button) => sendPlayEventToMain(button), 'MPV播放');
    }
}

// 包装函数来处理异步调用
function handlePlayButtonInjection(): void {
    injectCustomPlayBtn().catch(error => {
        logger.error('Error in injectCustomPlayBtn:', error);
    });
}

// 注册hook
registerHook(HookType.OnReady, handlePlayButtonInjection);
registerHook(HookType.OnDomChange, handlePlayButtonInjection);

export { };
