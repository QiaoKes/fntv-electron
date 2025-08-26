const { session } = require('electron');
const log = require('../logger');

// 从配置恢复 cookies
async function restoreCookies(domain, token) {
    if (!token) {
        log.info('没有已保存的登录信息，跳过恢复 cookies');
        return false;
    }

    if (!domain || typeof domain !== 'string' || !domain.startsWith('http')) {
        log.warn('无效的域名格式:', domain);
        return false;
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
        
        // 验证cookie是否设置成功
        const cookies = await ses.cookies.get({
            url: domain,
            name: 'Trim-MC-token'
        });
        
        if (cookies && cookies.length > 0) {
            log.info('Cookie 恢复成功，验证通过:', cookies[0].name, '=', cookies[0].value);
            return true;
        } else {
            log.error('Cookie 恢复失败：验证未通过，未找到设置的cookie');
            return false;
        }
    } catch (error) {
        log.error('Cookie 设置失败:', error);
        return false;
    }
}

module.exports = {
    restoreCookies: restoreCookies
};