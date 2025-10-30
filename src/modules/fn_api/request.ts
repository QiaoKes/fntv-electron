import * as crypto from 'crypto';
import axios, { AxiosResponse } from 'axios';
import { setTimeout } from 'timers/promises';
import https from 'https';
import log from '../logger';
import { isTrusted, showCertificateTrustDialog, isCertificateError, addTrustedHost } from '../cert_trust';

// 全局配置
const api_key = 'NDzZTVxnRKP8Z0jXg1VAMonaG8akvh';
const api_secret = '16CCEB3D-AB42-077D-36A1-F355324E4237';

// 类型定义
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    certificateError?: boolean; // 标识是否为证书错误
}

export interface FnApiResponseData<T = any> {
    code: number;
    msg: string;
    data: T;
}

export enum HttpMethod {
    GET = 'get',
    POST = 'post',
    PUT = 'put',
    DELETE = 'delete'
}

// MD5哈希计算
export function getMd5(text: string): string {
    return crypto.createHash('md5').update(text, 'utf8').digest('hex');
}

// 生成随机数字字符串
export function generateRandomDigits(start: number = 100000, end: number = 1000000): string {
    return Math.floor(Math.random() * (end - start) + start).toString();
}

// 生成授权签名
export function genFnAuthx(url: string, data?: any): string {
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
export const DEFAULT_TIMEOUT = 10000;

// API请求函数
export async function request<T = any>(
    baseUrl: string, 
    url: string, 
    method: HttpMethod, 
    token: string, 
    data?: any,
    extraHeaders?: Record<string, string>,
    timeout: number = DEFAULT_TIMEOUT, 
    tryTimes: number = 5,
): Promise<ApiResponse<T>> {
    const fullUrl = baseUrl + url;
    if (method === HttpMethod.POST || method === HttpMethod.PUT) {
        data = data || {};
        data["nonce"] = generateRandomDigits(); // POST/PUT请求添加随机数防重放
    }

    const authx = genFnAuthx(url, data);

    const headers = {
        "Content-Type": "application/json",
        "Authorization": token,
        "Authx": authx,
        ...extraHeaders
    };

    // 根据URL是否已被信任来决定是否验证证书
    const shouldIgnoreCert = isTrusted(baseUrl);
    
    // 设置请求配置，包含超时时间和动态SSL证书验证
    const config = {
        headers,
        timeout: timeout,
        httpsAgent: new https.Agent({
            rejectUnauthorized: !shouldIgnoreCert, // 根据信任状态决定是否验证证书
            keepAlive: true, // 启用keep-alive
            timeout: timeout, // 设置连接超时
            maxSockets: 10, // 限制最大并发连接数
        })
    };

    // 使用循环实现重试逻辑
    for (let attempt = 0; attempt <= tryTimes; attempt++) {
        try {
            let response: AxiosResponse<FnApiResponseData<T>>;

            switch (method) {
                case HttpMethod.GET:
                    response = await axios.get(fullUrl, config);
                    break;
                case HttpMethod.POST:
                    response = await axios.post(fullUrl, data, config);
                    break;
                case HttpMethod.PUT:
                    response = await axios.put(fullUrl, data, config);
                    break;
                case HttpMethod.DELETE:
                    response = await axios.delete(fullUrl, config);
                    break;
                default:
                    throw new Error(`Unsupported method: ${method}`);
            }

            const res = response.data;

            // 处理签名错误的重试逻辑
            if (res.code === 5000 && res.msg === 'invalid sign') {
                if (attempt >= tryTimes) {
                    return {
                        success: false,
                        message: `尝试次数过多 try_times = ${attempt + 1}`
                    };
                }

                log.warn(`fn_api 请求时签名错误，重试中 attempt = ${attempt + 1}, url: ${fullUrl}`);
                await setTimeout(100); // 等待100ms
                continue; // 继续下一次循环
            }

            // 处理业务错误
            if (res.code !== 0) {
                log.error(`fn_api 请求失败 url:${fullUrl}`, ' header:', headers, ' req:', data || 'null', ' resp:', res);
                return {
                    success: false,
                    message: res.msg
                };
            }

            return {
                success: true,
                data: res.data
            };

        } catch (error: any) {
            const errorCode = error.code || ''
            const errorMessage = error.response?.data || error.message || '未知错误';
            log.info(`检测到错误: code: ${errorCode}, msg: ${errorMessage}, URL: ${fullUrl}`);
            // 检查是否为证书验证错误且URL未被信任
            if (isCertificateError(error) && !isTrusted(baseUrl)) {
                log.warn(`检测到证书验证错误: code: ${errorCode}, msg: ${errorMessage}, URL: ${fullUrl}`);
                
                // 返回特殊的证书错误响应，让上层处理
                return {
                    success: false,
                    message: errorMessage,
                    // 添加一个特殊标识表示这是证书错误
                    certificateError: true
                } as ApiResponse<T> & { certificateError?: boolean };
            }
            
            // 如果是最后一次尝试，返回错误
            if (attempt >= tryTimes) {
                log.error(`axios 请求失败 - `, errorMessage);
                return {
                    success: false,
                    message: errorMessage
                };
            }

            // 等待后重试
            log.warn(`请求失败，重试中 attempt = ${attempt + 1}, error: ${errorMessage}`);
            await setTimeout(100);
        }
    }

    // 这行代码理论上不会执行到，但为了类型安全加上
    return {
        success: false,
        message: '重试逻辑异常'
    };
}
