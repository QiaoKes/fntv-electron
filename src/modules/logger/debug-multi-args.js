/**
 * 调试多参数日志脱敏
 */

const { maskLogArguments } = require('./masking');

// 模拟实际的日志调用
const args = [
    '恢复登录状态，跳转到主页面, domain:', 
    'http://10.0.0.120:5666', 
    ' token:', 
    'ac8f1e9617a648ae81319eca40e8e7d1'
];

console.log('=== 多参数脱敏测试 ===');
console.log('原始参数:', args);

const masked = maskLogArguments(...args);
console.log('脱敏后参数:', masked);

// 模拟formatMessage的处理过程
const [maskedMessage, ...restMaskedArgs] = masked;
const formattedArgs = restMaskedArgs.length > 0 ? ' ' + restMaskedArgs.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
).join(' ') : '';

const finalMessage = `${maskedMessage}${formattedArgs}`;
console.log('最终消息:', finalMessage);
