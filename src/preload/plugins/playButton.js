// preload/plugins/playButton.js
const { ipcRenderer } = require('electron');
const { registerHook } = require('../core/hooks');
const { evaluateXPath, getCookie } = require('../core/utils');

// 检查当前页面是否最后一层(电影或剧集页面或者其他页面)
function checkFinalPageUrl() {
    const url = window.location.href;
    return url.includes('/v/movie/') || url.includes('/v/tv/episode/') || url.includes('/v/other/');
}

// 检查当前页面是否为季页面
function checkSeasonPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/season/');
}

// 检查当前页面是否为剧集页面
function checkTVPageUrl() {
    const url = window.location.href;
    return url.includes('/v/tv/');
}

function sendPlayEventToMain() {
    const url = window.location.href;
    const itemGuid = url.split('/').pop();
    const token = getCookie('Trim-MC-token');
    ipcRenderer.send('play-movie', { itemGuid, token });
}

function cloneBtnAndInject(xpath, callback) {
    const buttons = evaluateXPath(xpath);
    if (!buttons.length) return;

    const referenceButton = buttons[0];
    if (referenceButton.hasAttribute('mpv-btn')) return;

    // 标记原始按钮已处理
    referenceButton.setAttribute('mpv-btn', 'true');

    // 克隆按钮
    const newButton = referenceButton.cloneNode(true);

    // 更新按钮文本
    const buttonText = newButton.querySelector('span > span > span');
    if (buttonText) buttonText.textContent = 'MPV播放';

    // 添加点击事件
    newButton.addEventListener('click', callback);

    // 插入按钮
    referenceButton.parentNode.insertBefore(newButton, referenceButton.nextSibling);
}

// 注入自定义播放按钮到最后一级页面
function injectFinalPageCustomPlayBtn() {
    if (!checkFinalPageUrl()) {
        return;
    }

    console.log('Detected movie or TV episode page, injecting play button...');

    const BUTTON_XPATH = '//*[@id="root"]/div/div[3]/div/div/div[2]/div/div[2]/div[1]/div[2]/div/div[1]/button';
    cloneBtnAndInject(BUTTON_XPATH, sendPlayEventToMain);
}

// 注入自定义播放按钮到季页面
function injectSeasonPageCustomPlayBtn() {
    if (!checkSeasonPageUrl()) {
        return;
    }

    console.log('Detected season page, injecting play button...');
    const BUTTON_XPATH = '//*[@id="root"]/div/div[3]/div/div/div[2]/div/div[2]/div[1]/div[2]/div[2]/div[1]/div[3]/div[1]/button';
    cloneBtnAndInject(BUTTON_XPATH, sendPlayEventToMain);
}

// 注入自定义播放按钮到剧集页面
function injectTVPageCustomPlayBtn() {
    if (!checkTVPageUrl()) {
        return;
    }

    console.log('Detected TV page, injecting play button...');
    const BUTTON_XPATH = '//*[@id="root"]/div/div[3]/div/div/div[2]/div/div[2]/div[1]/div[2]/div/div[1]/button';
    cloneBtnAndInject(BUTTON_XPATH, sendPlayEventToMain);
}

// 注册到 hook
registerHook('onReady', injectFinalPageCustomPlayBtn);
registerHook('onReady', injectSeasonPageCustomPlayBtn);
registerHook('onReady', injectTVPageCustomPlayBtn);

registerHook('onDomChange', injectFinalPageCustomPlayBtn);
registerHook('onDomChange', injectSeasonPageCustomPlayBtn);
registerHook('onDomChange', injectTVPageCustomPlayBtn);

module.exports = {};