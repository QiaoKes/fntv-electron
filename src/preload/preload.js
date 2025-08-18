const { ipcRenderer } = require('electron');

function injectTitleBar() {
    console.log('Injecting custom title bar...');
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
    ['min-btn', 'max-btn', 'close-btn'].forEach(id => {
        const btn = document.getElementById(id);
        // 平滑的悬停效果
        btn.addEventListener('mouseenter', () => {
            if (id === 'close-btn') {
                btn.style.background = 'rgba(232, 17, 35, 0.2)';
                btn.querySelector('path').style.stroke = '#fff';
            } else {
                btn.style.background = 'rgba(0, 0, 0, 0.06)';
                btn.querySelector('path, rect').style.stroke = '#fff';
            }
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'transparent';
            const svgElement = btn.querySelector('path, rect');
            if (svgElement) svgElement.style.stroke = '#888';
        });
    });

    // 窗口控制功能
    document.getElementById('min-btn').addEventListener('click', () => {
        ipcRenderer.send('window-minimize');
    });

    document.getElementById('max-btn').addEventListener('click', () => {
        ipcRenderer.send('window-maximize');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.send('window-close');
    });
}

function checkMovieUrl() {
    const url = window.location.href;
    return url.includes('/v/movie/') || url.includes('/v/tv/episode/');
}

function evaluateXPath(xpath, contextNode = document) {
    const result = [];
    const query = document.evaluate(
        xpath,
        contextNode,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
    );

    for (let i = 0, length = query.snapshotLength; i < length; ++i) {
        result.push(query.snapshotItem(i));
    }

    return result;
}

function injectCustomPlayBtn() {
    console.log('Injecting custom play button...');
    if (!checkMovieUrl()) {
        return;
    }

    console.log('Detected movie or TV episode page, injecting play button...');

    const BUTTON_XPATH = '//*[@id="root"]/div/div[3]/div/div/div[2]/div/div[2]/div[1]/div[2]/div/div[1]/button';
    const buttons = evaluateXPath(BUTTON_XPATH);
    if (!buttons.length) return;

    const referenceButton = buttons[0];
    if (referenceButton.hasAttribute('data-js-injected')) return;

    // 标记原始按钮已处理
    referenceButton.setAttribute('data-js-injected', 'true');

    // 克隆按钮
    const newButton = referenceButton.cloneNode(true);

    // 更新按钮文本
    const buttonText = newButton.querySelector('span > span > span');
    if (buttonText) buttonText.textContent = 'MPV播放';

    // 添加点击事件
    newButton.addEventListener('click', sendPlayEventToMain);

    // 插入按钮
    referenceButton.parentNode.insertBefore(newButton, referenceButton.nextSibling);
}

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

function sendPlayEventToMain() {
    const url = window.location.href;
    const itemGuid = url.split('/').pop();
    const token = getCookie('Trim-MC-token')

    console.log('Sending play event to main process:', url);
    ipcRenderer.send('play-movie', {
        itemGuid: itemGuid,
        token: token,
    });

    console.log('Play event sent successfully, itemGuid:', itemGuid, 'token:', token);
}


function initInjectr() {
    if (document.readyState !== 'loading') {
        injectTitleBar();
        injectCustomPlayBtn();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            injectTitleBar();
            injectCustomPlayBtn();
            // 优化DOM检测方式
            const observer = new MutationObserver(injectCustomPlayBtn);
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false
            });
        });
    }
}

initInjectr();