// preload/plugins/playMaskButton.js
const { ipcRenderer } = require('electron');
const { registerHook } = require('../core/hooks');
const log = require('../logger');
const { getCookie } = require('../core/utils');

// 发送播放信息到主进程
function sendPlayEventToMain() {
    const url = window.location.href;
    log.info('Current URL:', url);

    // 更好的ID提取逻辑
    let id = '';

    // 尝试从URL路径中提取ID
    if (url.includes('/play/')) {
        // 提取 /play/ 后面的部分
        const match = url.match(/\/play\/([^\/\?#]+)/);
        if (match && match[1]) {
            id = match[1];
        }
    }

    // 如果还是没有找到ID，尝试其他模式
    if (!id) {
        // 尝试从URL的最后一段提取（排除查询参数）
        const urlPath = url.split('?')[0]; // 移除查询参数
        const pathSegments = urlPath.split('/').filter(segment => segment.length > 0);
        if (pathSegments.length > 0) {
            id = pathSegments[pathSegments.length - 1];
        }
    }

    const token = getCookie('Trim-MC-token');

    log.info('Extracted ID:', id, 'Token:', token);

    if (id && token) {
        ipcRenderer.send('play-movie', { id, token });
    } else {
        log.error('Failed to extract ID or token. ID:', id, 'Token:', token);
    }
}

// 创建播放器选择弹窗
function createPlayModal(originalButton) {
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
    originalPlayBtn.addEventListener('mouseenter', () => {
        originalPlayBtn.style.background = 'rgba(255, 255, 255, 0.25)';
        originalPlayBtn.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        originalPlayBtn.style.transform = 'translateY(-3px)';
        originalPlayBtn.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';
    });
    originalPlayBtn.addEventListener('mouseleave', () => {
        originalPlayBtn.style.background = 'rgba(255, 255, 255, 0.15)';
        originalPlayBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        originalPlayBtn.style.transform = 'translateY(0)';
        originalPlayBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    mpvPlayBtn.addEventListener('mouseenter', () => {
        mpvPlayBtn.style.background = 'rgba(102, 126, 234, 0.9)';
        mpvPlayBtn.style.transform = 'translateY(-3px)';
        mpvPlayBtn.style.boxShadow = '0 8px 25px rgba(102, 126, 234, 0.6)';
    });
    mpvPlayBtn.addEventListener('mouseleave', () => {
        mpvPlayBtn.style.background = 'rgba(102, 126, 234, 0.8)';
        mpvPlayBtn.style.transform = 'translateY(0)';
        mpvPlayBtn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        cancelBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
        cancelBtn.style.color = '#ffffff';
        cancelBtn.style.transform = 'translateY(-3px)';
        cancelBtn.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        cancelBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        cancelBtn.style.color = 'rgba(255, 255, 255, 0.8)';
        cancelBtn.style.transform = 'translateY(0)';
        cancelBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    });

    // 添加事件监听器
    originalPlayBtn.addEventListener('click', () => {
        modalOverlay.remove();
        log.info('用户选择了原有播放');
        
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

    mpvPlayBtn.addEventListener('click', () => {
        modalOverlay.remove();
        sendPlayEventToMain();
        log.info('用户选择了MPV播放');
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.remove();
    });

    // 点击遮罩关闭弹窗
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    });

    // ESC键关闭弹窗
    const escHandler = (e) => {
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
function interceptMaskButton() {
    const playButtons = document.querySelectorAll('.play-mask__btn--play:not([data-mask-intercepted])');
    
    playButtons.forEach(btn => {
        // 标记已处理
        btn.setAttribute('data-mask-intercepted', 'true');
        
        // 添加点击事件拦截器
        const clickHandler = (e) => {
            // 检查是否允许原有播放
            if (btn.getAttribute('data-allow-original-play') === 'true') {
                log.info('Allowing original play logic to execute');
                return; // 不拦截，让原有逻辑执行
            }
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            log.info('Play button click intercepted, showing modal');
            createPlayModal(btn);
            return false;
        };

        // 在捕获阶段添加事件监听器，确保优先拦截
        btn.addEventListener('click', clickHandler, true);
        btn.addEventListener('mousedown', clickHandler, true);
    });
}

// 注册hook
registerHook('onReady', interceptMaskButton);
registerHook('onDomChange', interceptMaskButton);

module.exports = {};