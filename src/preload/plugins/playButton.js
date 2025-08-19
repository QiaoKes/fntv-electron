// preload/plugins/playButton.js
const { ipcRenderer } = require('electron');
const { registerHook } = require('../core/hooks');
const { getCookie } = require('../core/utils');

// 检查是否最后一级页面(单集&电影&其他)
function checkFinalPageUrl() {
    const url = window.location.href;
    return url.includes('/v/movie/') || url.includes('/v/tv/episode/') || url.includes('/v/other/');
}

// 检查是否是季度页面
function checkSeasonPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/season/');
}

// 检查是否是TV页面
function checkTVPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/');
}

// 发送播放信息到主进程
function sendPlayEventToMain() {
    const url = window.location.href;
    const id = url.split('/').pop();
    const token = getCookie('Trim-MC-token');
    ipcRenderer.send('play-movie', { id, token });
}

// 基于共同DOM特征搜索播放按钮
function findReferenceButton(context = document) {
    // 主要特征：特定播放图标路径
    const PLAY_ICON_PATH = "M5.984 18.819V5.18c0-1.739 1.939-2.776 3.386-1.812l10.228 6.82a2.177 2.177 0 010 3.623L9.37 20.63c-1.447.964-3.386-.073-3.386-1.812z";
    
    // 查找包含特定播放图标的按钮
    const buttonsWithPlayIcon = context.querySelectorAll('button');
    for (const button of buttonsWithPlayIcon) {
        // 检测特定播放图标
        const icon = button.querySelector('svg > path[d^="M5.984"]');
        if (icon && icon.getAttribute('d').startsWith(PLAY_ICON_PATH.substring(0, 10))) {
            return button;
        }
        
        // 备用检测：按钮类名组合
        const classes = button.getAttribute('class') || '';
        if (classes.includes('semi-button') && 
            classes.includes('semi-button-primary') && 
            classes.includes('!min-w-[150px]')) {
            return button;
        }
    }
    
    return null;
}

function clonePlayBtnAndInject(callback, btnText) {
    const referenceButton = findReferenceButton();
    if (!referenceButton || referenceButton.hasAttribute('data-mpv-btn')) return;

    console.log('Detected inject page, injecting play button...');
    
    // 标记原始按钮
    referenceButton.setAttribute('data-mpv-btn', 'processed');
    
    // 克隆并修改按钮
    const newButton = referenceButton.cloneNode(true);
    newButton.removeAttribute('data-mpv-btn');
    
    // 更新按钮文本（保留图标）
    const textSpans = newButton.querySelector('span > span > span');
    if (textSpans) textSpans.textContent = btnText;
    
    // 添加唯一标识
    newButton.setAttribute('data-custom-play', 'true');
    
    // 添加点击事件
    newButton.addEventListener('click', callback);
    
    // 插入到参考按钮旁边
    referenceButton.parentNode.insertBefore(newButton, referenceButton.nextSibling);
}

function injectCustomPlayBtn() {
    clonePlayBtnAndInject(sendPlayEventToMain, 'MPV播放');
}

// 注册hook
registerHook('onReady', injectCustomPlayBtn);
registerHook('onDomChange', injectCustomPlayBtn);

module.exports = {};