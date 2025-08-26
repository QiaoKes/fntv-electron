# 日志系统使用说明

## 概述

本项目已集成了完善的日志系统，用于替换原有的 `console` 操作，提供更好的日志管理和排障能力。

## 特性

- ✅ **自动日志轮转**: 当日志文件超过 10MB 时自动创建新文件
- ✅ **自动清理**: 最多保留 3 个日志文件，自动删除旧文件
- ✅ **多级日志**: 支持 DEBUG、INFO、WARN、ERROR 四个级别
- ✅ **环境适配**: 开发环境显示 DEBUG 级别，生产环境显示 INFO 级别
- ✅ **安装目录日志**: 日志文件保存在应用安装目录的 `log` 文件夹中
- ✅ **渲染进程支持**: 支持主进程和渲染进程的统一日志管理

## 日志文件位置

### 开发环境
```
项目根目录/log/app.log
```

### 生产环境（打包后）
```
应用安装目录/log/app.log
应用安装目录/log/app-[timestamp].log  # 轮转后的历史文件
```

## 使用方法

### 主进程中使用

```javascript
const log = require('./modules/logger');

// 不同级别的日志
log.debug('调试信息', someData);
log.info('一般信息', { user: 'test' });
log.warn('警告信息', warning);
log.error('错误信息', error);

// 也可以使用 log.log()，等同于 log.info()
log.log('这是一条信息');
```

### 渲染进程中使用

#### 在 preload 脚本中
```javascript
const log = require('./logger');  // 使用 preload 专用的日志模块

log.info('渲染进程信息');
log.error('渲染进程错误', error);
```

#### 在 HTML 页面中
已在 `login.html` 中内置了日志工具：

```javascript
// 直接使用内置的 log 对象
log.info('用户登录', loginData);
log.error('登录失败', error);
```

## 日志级别

| 级别  | 数值 | 用途 | 环境 |
|-------|------|------|------|
| DEBUG | 0    | 调试信息，详细的程序执行过程 | 开发环境 |
| INFO  | 1    | 一般信息，正常的程序执行流程 | 所有环境 |
| WARN  | 2    | 警告信息，可能的问题但不影响运行 | 所有环境 |
| ERROR | 3    | 错误信息，程序异常或失败 | 所有环境 |

## 配置

日志配置位于 `src/modules/logger/config.js`：

```javascript
const logConfig = {
    // 最大文件大小 (10MB)
    maxFileSize: 10 * 1024 * 1024,
    
    // 最大文件数量
    maxFiles: 3,
    
    // 开发环境日志级别
    developmentLevel: LogLevel.DEBUG,
    
    // 生产环境日志级别
    productionLevel: LogLevel.INFO,
    
    // 是否在控制台也输出日志（开发环境）
    consoleOutput: true
};
```

## 日志格式

```
[2025-08-26T10:30:45.123Z] [INFO] 应用启动成功
[2025-08-26T10:30:46.456Z] [ERROR] 登录失败: 用户名或密码错误
[2025-08-26T10:30:47.789Z] [Renderer] [INFO] 用户点击登录按钮
```

格式说明：
- `[时间戳]`: ISO 8601 格式的时间戳
- `[级别]`: 日志级别（DEBUG/INFO/WARN/ERROR）
- `[Renderer]`: 渲染进程日志会有此标识
- `消息内容`: 实际的日志信息

## 文件结构

```
src/modules/logger/
├── logger.js      # 主日志模块
├── config.js      # 日志配置
└── index.js       # 简化的导出接口

src/preload/
└── logger.js      # 渲染进程日志接口
```

## 迁移指南

原有的 `console` 调用已经全部替换为新的日志系统：

```javascript
// 旧方式
console.log('信息');
console.error('错误', error);
console.warn('警告');

// 新方式
log.info('信息');
log.error('错误', error);
log.warn('警告');
```

## 获取日志文件路径

```javascript
const log = require('./modules/logger');

// 获取当前日志文件路径
const currentLogFile = log.getLogFile();

// 获取日志目录路径
const logDir = log.getLogDir();
```

## 注意事项

1. **生产环境**: 只会记录 INFO 及以上级别的日志
2. **开发环境**: 会记录所有级别的日志，并同时在控制台输出
3. **自动轮转**: 当日志文件超过 10MB 时会自动创建新文件
4. **自动清理**: 只保留最新的 3 个日志文件
5. **渲染进程**: 通过 IPC 将日志发送到主进程统一处理

## 排障建议

1. 查看最新的日志文件：`应用安装目录/log/app.log`
2. 如果需要历史日志，查看带时间戳的文件
3. 开发环境下，日志同时在控制台和文件中输出
4. 生产环境下，只在文件中输出日志，方便用户反馈问题时提供日志文件
