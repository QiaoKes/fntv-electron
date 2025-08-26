/**
 * 日志脱敏功能测试
 * 用于验证数据脱敏功能是否正常工作
 */

const log = require('./index');

// 测试基本的脱敏功能
function testBasicMasking() {
    console.log('\n=== 基本脱敏功能测试 ===');
    
    // 测试包含敏感信息的对象
    const userData = {
        username: 'admin',
        password: 'secretPassword123',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        email: 'admin@example.com',
        phone: '13812345678',
        id_card: '123456789012345678',
        bank_card: '6225680123456789',
        address: '北京市朝阳区xxx路xxx号'
    };
    
    log.info('用户信息:', userData);
    log.debug('详细用户数据:', userData);
}

// 测试字符串脱敏
function testStringMasking() {
    console.log('\n=== 字符串脱敏测试 ===');
    
    log.info('登录信息: username=admin, password=mySecretPassword');
    log.warn('API请求: https://api.example.com/login?token=abc123def456&secret=mysecret');
    log.error('认证失败，token无效: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
}

// 测试错误对象脱敏
function testErrorMasking() {
    console.log('\n=== 错误对象脱敏测试 ===');
    
    try {
        // 模拟一个包含敏感信息的错误
        const error = new Error('登录失败: 用户名admin，密码错误，token=abc123def');
        error.userData = {
            password: 'wrongPassword',
            token: 'invalidToken123'
        };
        throw error;
    } catch (err) {
        log.error('捕获到错误:', err);
    }
}

// 测试嵌套对象脱敏
function testNestedObjectMasking() {
    console.log('\n=== 嵌套对象脱敏测试 ===');
    
    const complexData = {
        user: {
            profile: {
                username: 'testuser',
                credentials: {
                    password: 'nestedPassword',
                    api_key: 'sk-1234567890abcdef',
                    tokens: [
                        'token1_abc123',
                        'token2_def456'
                    ]
                }
            },
            contacts: [
                { phone: '13812345678', email: 'user1@test.com' },
                { phone: '13987654321', email: 'user2@test.com' }
            ]
        },
        config: {
            database: {
                password: 'dbPassword123',
                connection_string: 'mongodb://admin:secret@localhost:27017/db'
            }
        }
    };
    
    log.info('复杂嵌套数据:', complexData);
}

// 测试数组脱敏
function testArrayMasking() {
    console.log('\n=== 数组脱敏测试 ===');
    
    const users = [
        { username: 'user1', password: 'pass1', token: 'token1' },
        { username: 'user2', password: 'pass2', token: 'token2' },
        { username: 'user3', password: 'pass3', token: 'token3' }
    ];
    
    log.info('用户列表:', users);
}

// 测试URL参数脱敏
function testUrlMasking() {
    console.log('\n=== URL参数脱敏测试 ===');
    
    const urls = [
        'https://api.example.com/login?token=abc123&password=secret',
        'https://oauth.example.com/callback?code=auth_code_123&state=random_state',
        'https://api.example.com/user?api_key=sk-1234567890&secret=mysecret'
    ];
    
    urls.forEach((url, index) => {
        log.info(`URL ${index + 1}:`, url);
    });
}

// 运行所有测试
function runTests() {
    console.log('开始运行日志脱敏功能测试...');
    console.log('注意：检查日志文件以验证敏感信息是否被正确脱敏');
    
    testBasicMasking();
    testStringMasking();
    testErrorMasking();
    testNestedObjectMasking();
    testArrayMasking();
    testUrlMasking();
    
    console.log('\n=== 测试完成 ===');
    console.log('请检查日志文件:', log.getLogFile());
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    runTests();
}

module.exports = {
    runTests,
    testBasicMasking,
    testStringMasking,
    testErrorMasking,
    testNestedObjectMasking,
    testArrayMasking,
    testUrlMasking
};
