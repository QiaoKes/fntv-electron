

// 检查当前页面是否为资源库页面
export function checkLibraryPageUrl(url: string) {
    if (!url) return false;
    return url.includes('/v/library/') || url.includes('/v/favorite') || url.includes('/v/list/');
}