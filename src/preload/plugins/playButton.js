// preload/plugins/playButton.js
const { ipcRenderer } = require('electron');
const { registerHook } = require('../core/hooks');
const { evaluateXPath, checkMovieUrl, getCookie } = require('../core/utils');

function sendPlayEventToMain() {
    const url = window.location.href;
    const itemGuid = url.split('/').pop();
    const token = getCookie('Trim-MC-token');
    ipcRenderer.send('play-movie', { itemGuid, token });
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

// 注册到 hook
registerHook('onReady', injectCustomPlayBtn);
registerHook('onDomChange', injectCustomPlayBtn);

module.exports = {};