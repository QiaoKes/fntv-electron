/**
 * 调试token脱敏问题
 */

const { maskStringByPatterns } = require('./masking');

// 测试实际的token字符串
const testStrings = [
    'token* ac8f1e9617a648ae81319eca40e8e7d1',
    'token: ac8f1e9617a648ae81319eca40e8e7d1',
    'token ac8f1e9617a648ae81319eca40e8e7d1',
    '"token": "ac8f1e9617a648ae81319eca40e8e7d1"',
    'domain: http://10.0.0.120:5666  token* ac8f1e9617a648ae81319eca40e8e7d1'
];

console.log('=== Token脱敏调试测试 ===\n');

testStrings.forEach((str, index) => {
    console.log(`测试 ${index + 1}:`);
    console.log(`原文: ${str}`);
    console.log(`脱敏: ${maskStringByPatterns(str)}`);
    console.log('---');
});

// 测试正则表达式匹配
console.log('\n=== 正则表达式测试 ===');
const tokenPatterns = [
    /token['":\s]*['"]*([^'",\s}]+)['"]*?/gi,
    /token[:*\s]*([a-zA-Z0-9]+)/gi,  // 新的模式，支持 token* 格式
];

const testString = 'domain: http://10.0.0.120:5666  token* ac8f1e9617a648ae81319eca40e8e7d1';

tokenPatterns.forEach((pattern, index) => {
    console.log(`模式 ${index + 1}: ${pattern}`);
    const matches = [...testString.matchAll(pattern)];
    console.log('匹配结果:', matches);
    console.log('---');
});
