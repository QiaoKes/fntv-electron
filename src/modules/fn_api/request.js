const crypto = require('crypto');
const axios = require('axios');
const { setTimeout } = require('timers/promises');

// 全局配置
const api_key = 'NDzZTVxnRKP8Z0jXg1VAMonaG8akvh';
const api_secret = '16CCEB3D-AB42-077D-36A1-F355324E4237';

// MD5哈希计算
function getMd5(text) {
    return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

// 生成随机数字字符串
function generateRandomDigits(length = 6) {
    return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

// 生成授权签名
function genFnAuthx(url, data) {
    const nonce = generateRandomDigits();
    const timestamp = Date.now();
    const dataJson = data ? JSON.stringify(data) : '';
    const dataJsonMd5 = getMd5(dataJson);

    const signArray = [
        api_key,
        url,
        nonce,
        timestamp.toString(),
        dataJsonMd5,
        api_secret
    ];

    const signStr = signArray.join('_');
    return `nonce=${nonce}&timestamp=${timestamp}&sign=${getMd5(signStr)}`;
}

// 默认超时时间（毫秒）
const DEFAULT_TIMEOUT = 10000;

// API请求函数
async function request(baseUrl, url, method, token, data, tryTimes = 0, timeout = DEFAULT_TIMEOUT) {
    const fullUrl = baseUrl + url;
    const authx = genFnAuthx(url, data);

    const headers = {
        "Content-Type": "application/json",
        "Authorization": token,
        "Authx": authx
    };
    
    // 设置请求配置，包含超时时间
    const config = {
        headers,
        timeout: timeout
    };

    try {
        switch (method.toLowerCase()) {
            case 'get':
                response = await axios.get(fullUrl, config);
                 break;
            case 'post':
                response = await axios.post(fullUrl, data, config);
                 break;
            case 'put':
                response = await axios.put(fullUrl, data, config);
                break;
            case 'delete':
                response = await axios.delete(fullUrl, config);
                break;
            default:
                throw new Error(`Unsupported method: ${method}`);
        }

        const res = response.data;

        // 处理签名错误的重试逻辑
        if (res.code === 5000 && res.msg === 'invalid sign') {
            if (tryTimes > 2) {
                return {
                    success: false,
                    message: `尝试次数过多 try_times = ${tryTimes}`
                };
            }

            console.log(`fn_api 请求时签名错误，重试中 tryTimes = ${tryTimes}, url: ${fullUrl}`);
            await setTimeout(300); // 等待300ms
            return request(baseUrl, url, method, token, data, tryTimes + 1, timeout);
        }

        // 处理业务错误
        if (res.code !== 0) {
            return {
                success: false,
                message: res.msg
            };
        }

        return {
            success: true,
            data: res.data
        };

    } catch (error) {
        // 处理网络错误
        console.error(`fn_api 请求失败 - `, error.response?.data || error.message);
        return {
            success: false,
            message: error.response?.data || error.message
        };
    }
}

module.exports = {
    getMd5,
    generateRandomDigits,
    genFnAuthx,
    request,
    DEFAULT_TIMEOUT
};