import { session } from 'electron';
import log from '../logger';
import { ApiService } from '../fn_api/api';

/**
 * 从配置恢复 cookies
 * @param domain - 域名
 * @param token - 访问令牌
 * @param isLogin - 是否为登录过程
 * @returns 是否成功恢复cookies
 */
export async function restoreCookies(domain: string, token: string, isLogin: boolean = false): Promise<boolean> {
    if (!token) {
        log.info('没有已保存的登录信息，跳过恢复 cookies');
        return false;
    }

    if (!domain || typeof domain !== 'string' || !domain.startsWith('http')) {
        log.warn('无效的域名格式:', domain);
        return false;
    }

    // 验证token是否有效
    if (!isLogin) {
        const fnapi = new ApiService(domain, token);
        const response = await fnapi.getUserInfo(5000, 0);
        if (!response || !response.success) {
            log.warn('无效的token:', token);
            return false;
        }
        log.info('Token 验证通过, username:', response.data?.username || '无用户信息');
    }

    // 使用 token 设置 cookie
    log.info('从配置中恢复 cookies, domain:', domain, ' token:', token);

    const ses = session.fromPartition('persist:fntv');
    // 根据登录接口返回的 token 格式设置相应的 cookie
    try {
        const isHttps = domain.startsWith('https://');

        // 先清除可能存在的旧cookie
        await ses.cookies.remove(domain, 'Trim-MC-token')

        // 添加延迟以确保清除操作完成
        await new Promise<void>(resolve => setTimeout(resolve, 100));

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

        // 设置 mode=relay Cookie（FN Connect 外网访问必需）
        await ses.cookies.set({
            url: domain,
            name: 'mode',
            value: 'relay',
            path: '/',
            secure: isHttps,
            httpOnly: false,
            sameSite: isHttps ? 'no_restriction' : 'lax'
        });

        return true;
    } catch (error) {
        log.error('Cookie 设置失败:', error);
        return false;
    }
}

// CommonJS导出，确保与现有代码兼容
module.exports = {
    restoreCookies,
};
