// preload/plugins/playMaskButton.ts
import { ipcRenderer } from 'electron';
import { registerHook } from '../core/hooks';
import logger from '../core/logger';
import { getCookie } from '../core/utils';
import type { PlayMovieData } from '../core/types';
import { HookType } from '../core/hooks';

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

// 调用MPV播放器的公共方法
async function playWithMpv(button: HTMLElement): Promise<void> {
    // 先尝试简化的 DOM 方法
    const domResult = sendPlayEventToMain(button);

    if (!domResult) {
        // DOM 方法失败，使用拦截方法作为 fallback
        logger.info('DOM method failed, trying original logic interception...');
        const itemGuid = await tryGetItemGuidFromOriginalLogic(button);

        if (itemGuid) {
            logger.info('Successfully obtained item_guid from original logic:', itemGuid);
            const token = getCookie('Trim-MC-token');
            if (token) {
                const playData: PlayMovieData = { id: itemGuid, token: token, sourceIndex: 0 };
                ipcRenderer.send('play-movie', playData);
            } else {
                logger.error('No token found');
            }
        } else {
            logger.error('All methods failed to get item_guid');
        }
    } else {
        logger.info('Successfully used DOM method to get item_guid');
    }
}

// 尝试通过执行原有逻辑获取 item_guid
function tryGetItemGuidFromOriginalLogic(button: HTMLElement): Promise<string | null> {
    return new Promise((resolve) => {
        try {
            // 创建一个临时的网络请求拦截器
            const originalFetch = window.fetch;
            const originalXHROpen = XMLHttpRequest.prototype.open;
            const originalXHRSend = XMLHttpRequest.prototype.send;

            let interceptedGuid: string | null = null;
            const timeout = setTimeout(() => {
                // 恢复原有方法
                window.fetch = originalFetch;
                XMLHttpRequest.prototype.open = originalXHROpen;
                XMLHttpRequest.prototype.send = originalXHRSend;
                resolve(null);
            }, 2000);

            // 拦截 fetch 请求
            window.fetch = function (url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
                logger.info('Intercepted fetch request:', url, options);
                if (typeof url === 'string' && url.includes('/api/v1/play/info') && options && options.body) {
                    try {
                        const body = JSON.parse(options.body as string);
                        if (body.item_guid) {
                            interceptedGuid = body.item_guid;
                            logger.info('Found item_guid in fetch request:', interceptedGuid);
                        }
                    } catch (e) {
                        logger.error('Error parsing fetch body:', e);
                    }
                }
                // 不执行实际的播放请求，直接返回一个假的 Promise
                if (typeof url === 'string' && url.includes('/api/v1/play/info')) {
                    return Promise.resolve({
                        ok: false,
                        status: 200,
                        json: () => Promise.resolve({ success: false, message: 'Intercepted for guid extraction' })
                    } as Response);
                }
                return originalFetch.apply(this, arguments as any);
            };

            // 拦截 XMLHttpRequest
            XMLHttpRequest.prototype.open = function (method: string, url: string | URL): void {
                (this as any)._url = url;
                return originalXHROpen.apply(this, arguments as any);
            };

            XMLHttpRequest.prototype.send = function (data?: Document | XMLHttpRequestBodyInit | null): void {
                const thisXHR = this as any;
                if (thisXHR._url && typeof thisXHR._url === 'string' && thisXHR._url.includes('/api/v1/play/info') && data) {
                    try {
                        const parsedData = JSON.parse(data as string);
                        if (parsedData.item_guid) {
                            interceptedGuid = parsedData.item_guid;
                            logger.info('Found item_guid in XHR request:', interceptedGuid);
                        }
                    } catch (e) {
                        logger.error('Error parsing XHR data:', e);
                    }
                    // 不发送实际请求，模拟一个错误响应
                    setTimeout(() => {
                        if (this.onreadystatechange) {
                            (this as any).readyState = 4;
                            (this as any).status = 404;
                            (this as any).responseText = JSON.stringify({ success: false, message: 'Intercepted for guid extraction' });
                            this.onreadystatechange(new Event('readystatechange'));
                        }
                    }, 100);
                    return;
                }
                return originalXHRSend.apply(this, arguments as any);
            };

            // 触发原有点击事件
            button.setAttribute('data-allow-original-play', 'true');
            setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                button.dispatchEvent(clickEvent);

                // 检查是否获取到了 guid
                setTimeout(() => {
                    clearTimeout(timeout);
                    // 恢复原有方法
                    window.fetch = originalFetch;
                    XMLHttpRequest.prototype.open = originalXHROpen;
                    XMLHttpRequest.prototype.send = originalXHRSend;
                    button.removeAttribute('data-allow-original-play');
                    resolve(interceptedGuid);
                }, 1000);
            }, 50);

        } catch (error) {
            logger.error('Error in tryGetItemGuidFromOriginalLogic:', error);
            resolve(null);
        }
    });
}

// 从DOM获取id
function getItemGuidFromDOM(button: HTMLElement): string | null {
    try {
        // 从播放按钮向上查找包含 data-id="details" 的容器
        let container: Element | null = button;
        while (container && container !== document.body) {
            if (container.getAttribute('data-id') === 'details') {
                // 在details容器中查找包含 /v/tv/episode/ 的A标签
                const aLinks = container.querySelectorAll('a[href*="/v/tv/episode/"]');
                if (aLinks.length > 0) {
                    const link = aLinks[0] as HTMLAnchorElement;
                    const guidMatch = link.href.match(/\/v\/tv\/episode\/([a-f0-9]{32})/i);
                    if (guidMatch && guidMatch[1]) {
                        logger.info('Found guid:', guidMatch[1]);
                        return guidMatch[1];
                    }
                }
                break;
            }
            container = container.parentElement;
        }

        // 如果找不到，从当前URL获取
        const url = window.location.href;
        const urlMatch = url.match(/\/v\/tv\/episode\/([a-f0-9]{32})/i);
        if (urlMatch && urlMatch[1]) {
            logger.info('Found guid from URL:', urlMatch[1]);
            return urlMatch[1];
        }

        return null;
    } catch (error) {
        logger.error('Error extracting guid from DOM:', error);
        return null;
    }
}

// 发送播放信息到主进程
function sendPlayEventToMain(button: HTMLElement | null = null): string | null {
    let id = '';

    // 尝试从DOM中获取guid
    if (button) {
        id = getItemGuidFromDOM(button) || '';
    }

    if (!id) {
        return null; // 返回 null 表示需要使用拦截方法
    }

    const token = getCookie('Trim-MC-token');

    if (id && token) {
        const playData: PlayMovieData = { id, token, sourceIndex: 0 };
        ipcRenderer.send('play-movie', playData);
        return id;
    } else {
        logger.error('Failed to extract ID or token. ID:', id, 'Token:', token);
        return null;
    }
}

// 创建播放器选择弹窗
function createPlayModal(originalButton: HTMLElement): void {
    // 如果弹窗已存在，先移除
    const existingModal = document.getElementById('play-choice-modal');
    if (existingModal) {
        existingModal.remove();
    }

    // 创建弹窗遮罩
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'play-choice-modal';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.3);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
    `;

    // 创建弹窗内容
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 32px;
        min-width: 380px;
        box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.2),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.18);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
    `;

    // 标题
    const title = document.createElement('h3');
    title.textContent = '选择播放方式';
    title.style.cssText = `
        margin: 0 0 24px 0;
        font-size: 20px;
        font-weight: 600;
        text-align: center;
        color: #ffffff;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        letter-spacing: 0.5px;
    `;

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 16px;
        justify-content: center;
        flex-wrap: wrap;
    `;

    // 原有播放按钮
    const originalPlayBtn = document.createElement('button');
    originalPlayBtn.textContent = '原有播放';
    originalPlayBtn.style.cssText = `
        padding: 12px 24px;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #ffffff;
        transition: all 0.3s ease;
        min-width: 100px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // MPV播放按钮
    const mpvPlayBtn = document.createElement('button');
    mpvPlayBtn.textContent = 'MPV播放';
    mpvPlayBtn.style.cssText = `
        padding: 12px 24px;
        background: rgba(102, 126, 234, 0.8);
        border: 1px solid rgba(102, 126, 234, 0.6);
        border-radius: 12px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.3s ease;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        min-width: 100px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    `;

    // 取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '取消';
    cancelBtn.style.cssText = `
        padding: 12px 24px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.8);
        transition: all 0.3s ease;
        min-width: 100px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    `;

    // 添加悬停效果
    const addHoverEffect = (btn: HTMLButtonElement, hoverStyle: Partial<CSSStyleDeclaration>, normalStyle: Partial<CSSStyleDeclaration>) => {
        btn.addEventListener('mouseenter', () => {
            Object.assign(btn.style, hoverStyle);
        });
        btn.addEventListener('mouseleave', () => {
            Object.assign(btn.style, normalStyle);
        });
    };

    addHoverEffect(originalPlayBtn, {
        background: 'rgba(255, 255, 255, 0.25)',
        borderColor: 'rgba(255, 255, 255, 0.5)',
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)'
    }, {
        background: 'rgba(255, 255, 255, 0.15)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
        transform: 'translateY(0)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
    });

    addHoverEffect(mpvPlayBtn, {
        background: 'rgba(102, 126, 234, 0.9)',
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 25px rgba(102, 126, 234, 0.6)'
    }, {
        background: 'rgba(102, 126, 234, 0.8)',
        transform: 'translateY(0)',
        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
    });

    addHoverEffect(cancelBtn, {
        background: 'rgba(255, 255, 255, 0.2)',
        borderColor: 'rgba(255, 255, 255, 0.4)',
        color: '#ffffff',
        transform: 'translateY(-3px)',
        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)'
    }, {
        background: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        color: 'rgba(255, 255, 255, 0.8)',
        transform: 'translateY(0)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
    });

    // 添加事件监听器
    originalPlayBtn.addEventListener('click', () => {
        modalOverlay.remove();
        logger.info('用户选择了原有播放');

        // 触发原有播放逻辑
        if (originalButton) {
            // 临时标记为允许原有播放
            originalButton.setAttribute('data-allow-original-play', 'true');

            // 立即触发原有点击事件
            setTimeout(() => {
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                originalButton.dispatchEvent(clickEvent);

                // 清除临时标记
                setTimeout(() => {
                    originalButton.removeAttribute('data-allow-original-play');
                }, 1000);
            }, 50);
        }
    });

    mpvPlayBtn.addEventListener('click', async () => {
        modalOverlay.remove();
        logger.info('用户选择了MPV播放');

        // 调用MPV播放器
        await playWithMpv(originalButton);
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.remove();
    });

    // 点击遮罩关闭弹窗
    modalOverlay.addEventListener('click', (e: MouseEvent) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });

    // ESC键关闭弹窗
    const escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            modalOverlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // 组装弹窗
    buttonContainer.appendChild(originalPlayBtn);
    buttonContainer.appendChild(mpvPlayBtn);
    buttonContainer.appendChild(cancelBtn);

    modalContent.appendChild(title);
    modalContent.appendChild(buttonContainer);
    modalOverlay.appendChild(modalContent);

    // 添加到页面
    document.body.appendChild(modalOverlay);
}

// 拦截遮罩按钮点击
function interceptMaskButton(): void {
    const playButtons = document.querySelectorAll('.play-mask__btn--play:not([data-mask-intercepted])');

    for (let i = 0; i < playButtons.length; i++) {
        const btn = playButtons[i] as HTMLElement;
        // 标记已处理
        btn.setAttribute('data-mask-intercepted', 'true');

        // 添加点击事件拦截器
        const clickHandler = async (e: Event) => {
            // 检查是否允许原有播放
            if (btn.getAttribute('data-allow-original-play') === 'true') {
                logger.info('Allowing original play logic to execute');
                return; // 不拦截，让原有逻辑执行
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // 获取配置
            const config = await getPlayButtonConfig();
            
            if (config.hideOriginalPlayButton) {
                // 如果隐藏原有播放按钮，直接调用MPV播放器
                logger.info('Play button click intercepted, directly playing with MPV');
                
                // 调用MPV播放器
                await playWithMpv(btn);
            } else {
                // 显示选择弹窗
                logger.info('Play button click intercepted, showing modal');
                await createPlayModal(btn);
            }
            
            return false;
        };

        // 在捕获阶段添加事件监听器，确保优先拦截
        // 只监听 click 事件，避免重复触发
        btn.addEventListener('click', clickHandler, true);
    }
}

// 注册hook
registerHook(HookType.OnReady, interceptMaskButton);
registerHook(HookType.OnDomChange, interceptMaskButton);

export {};
