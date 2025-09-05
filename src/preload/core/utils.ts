// preload/core/utils.ts
import type { Utils } from './types';

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

function getCookie(name: string): string | null {
    const cookies = document.cookie.split(';');
    const nameEQ = name + '=';

    for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(nameEQ)) {
            return trimmed.substring(nameEQ.length);
        }
    }
    return null;
}

const utils: Utils = {
    getCookie,
};

export { getCookie, checkFinalPageUrl, checkSeasonPageUrl, checkTVPageUrl };
export default utils;
