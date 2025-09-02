// preload/plugins/titlebar.ts
import { ipcRenderer } from 'electron';
import { registerHook } from '../core/hooks';
import { HookType } from '../core/hooks';
import logger from '../core/logger';

function injectTitleBar(): void {
    logger.info('Injecting custom title bar...');
    if (document.getElementById('custom-titlebar')) return;

    const bar = document.createElement('div');
    bar.id = 'custom-titlebar';
    bar.style.cssText = `
        height:32px;
        width:100vw;
        background:rgba(255,255,255,0)!important;
        backdrop-filter: blur(12px)!important;
        -webkit-app-region:drag;
        position:fixed;
        top:0;
        left:0;
        z-index:99999;
        display:flex;
        justify-content:flex-end;
        align-items:center;
        transition: background 0.3s ease;
    `;

    bar.innerHTML = `
        <div id="titlebar-btns" style="-webkit-app-region:no-drag; display:flex; gap:2px; padding-right:4px;">
            <button id="min-btn" style="
                background:transparent; 
                border:none; 
                width:34px;
                height:32px;
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
                border-radius:4px;
                transition:all 0.2s ease;
            ">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M2 8H14" stroke="#888" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
            <button id="max-btn" style="
                background:transparent; 
                border:none; 
                width:34px;
                height:32px;
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
                border-radius:4px;
                transition:all 0.2s ease;
            ">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="#888" stroke-width="1.5"/>
                </svg>
            </button>
            <button id="close-btn" style="
                background:transparent; 
                border:none; 
                width:34px;
                height:32px;
                display:flex;
                align-items:center;
                justify-content:center;
                cursor:pointer;
                border-radius:4px;
                transition:all 0.2s ease;
            ">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="#888" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </button>
        </div>
    `;

    // 添加body顶部内边距
    document.body.style.paddingTop = '10px';
    // 防止出现双重滚动条
    document.documentElement.style.overflowY = 'hidden';
    document.body.appendChild(bar);

    // 按钮交互效果
    const buttonIds: string[] = ['min-btn', 'max-btn', 'close-btn'];
    buttonIds.forEach((id: string) => {
        const btn = document.getElementById(id) as HTMLButtonElement;
        if (!btn) return;
        
        // 平滑的悬停效果
        btn.addEventListener('mouseenter', () => {
            if (id === 'close-btn') {
                btn.style.background = 'rgba(232, 17, 35, 0.2)';
                const pathElement = btn.querySelector('path') as SVGPathElement;
                if (pathElement) pathElement.style.stroke = '#fff';
            } else {
                btn.style.background = 'rgba(0, 0, 0, 0.06)';
                const svgElement = btn.querySelector('path, rect') as SVGElement;
                if (svgElement) svgElement.style.stroke = '#fff';
            }
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            const svgElement = btn.querySelector('path, rect') as SVGElement;
            if (svgElement) svgElement.style.stroke = '#888';
        });
    });

    // 窗口控制功能
    const minBtn = document.getElementById('min-btn');
    const maxBtn = document.getElementById('max-btn');
    const closeBtn = document.getElementById('close-btn');

    if (minBtn) {
        minBtn.addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });
    }

    if (maxBtn) {
        maxBtn.addEventListener('click', () => {
            ipcRenderer.send('window-maximize');
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });
    }
}

// 注册到 hook
registerHook(HookType.OnReady, injectTitleBar);

export {};
