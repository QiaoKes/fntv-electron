const { session } = require('electron');
const log = require('../logger');
const fn = require('../fn_api/api');

// 从配置恢复 cookies
async function restoreCookies(domain, token, isLogin = false) {
    if (!token) {
        log.info('没有已保存的登录信息，跳过恢复 cookies');
        return false;
    }

    if (!domain || typeof domain !== 'string' || !domain.startsWith('http')) {
        log.warn('无效的域名格式:', domain);
        return false;
    }

    if (!isLogin) {
        // 验证token是否有效
        const fnapi = new fn.apiService(domain, token);
        const response = await fnapi.getUserInfo();
        if (!response || !response.success) {
            log.warn('无效的token:', token);
            return false;
        }
        log.info('Token 验证通过, username:', response.data.username || '无用户信息');
    }

    // 使用 token 设置 cookie
    log.info('从配置中恢复 cookies, domain:', domain, ' token:', token);

    const ses = session.fromPartition('persist:fntv');
    // 根据登录接口返回的 token 格式设置相应的 cookie
    try {
        const isHttps = domain.startsWith('https://');
        // 先清除可能存在的旧cookie
        await ses.cookies.remove(domain, 'Trim-MC-token');

        // 添加延迟以确保清除操作完成
        await new Promise(resolve => setTimeout(resolve, 100));

        // 设置新cookie
        await ses.cookies.set({
            url: domain,
            name: 'Trim-MC-token',
            value: token,
            path: '/',
            secure: isHttps,          // HTTPS 才设置 secure
            httpOnly: false,
            sameSite: isHttps ? 'no_restriction' : 'lax'  // HTTP 下用 lax
        });
        return true;
    } catch (error) {
        log.error('Cookie 设置失败:', error);
        return false;
    }
}

module.exports = {
    restoreCookies: restoreCookies
};