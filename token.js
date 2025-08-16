const fs = require('fs');
const path = require('node:path');
const { app } = require('electron');
const { SITE_URL, USER_DATA_PATH } = require('./define');

app.setPath('userData', USER_DATA_PATH);

function getTokenPath() {
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return path.join(dir, 'tokens.json');
}

function saveTokens(cookies) {
    const trimMcToken = cookies.find(c => c.name === 'Trim-MC-token');
    if (trimMcToken) {
        fs.writeFileSync(getTokenPath(), JSON.stringify({
            trimMcToken: trimMcToken.value
        }, null, 2));
    }
}

function readTokens() {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
        try {
            return JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        } catch {
            return null;
        }
    }
    return null;
}

async function restoreCookie(ses) {
    const tokens = readTokens();
    const isHttps = SITE_URL.startsWith('https://');
    if (tokens && tokens.trimMcToken) {
        await ses.cookies.set({
            url: SITE_URL,
            name: 'Trim-MC-token',
            value: tokens.trimMcToken,
            path: '/',
            secure: isHttps,                   // HTTPS 才设置 secure
            httpOnly: false,
            sameSite: isHttps ? 'no_restriction' : 'lax'  // HTTP 下用 lax
        });
    }
}

module.exports = {
    saveTokens,
    restoreCookie,
    SITE_URL
};