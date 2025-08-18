const { session } = require('electron');
const { saveTokens } = require('../modules/fn_token/token');
const { SITE_URL } = require('../public/constants');

module.exports = {
    setupCookieEvents: function (mainWindow) {
        if (!mainWindow) return;

        const ses = session.fromPartition('persist:fntv');
        const saveCookies = () => {
            ses.cookies.get({ url: SITE_URL }).then(saveTokens).catch(console.error);
        };

        mainWindow.webContents.on('did-navigate', saveCookies);
        mainWindow.webContents.on('did-navigate-in-page', saveCookies);
        mainWindow.webContents.on('did-finish-load', saveCookies);
    }
};