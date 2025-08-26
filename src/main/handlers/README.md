# Handler 插件化架构

## 架构概述

本目录采用插件化设计，将原本臃肿的 `eventHandlers.js` 重构为多个功能独立的插件模块，提高代码的可维护性和可扩展性。

## 目录结构

```
handlers/
├── core/                   # 核心管理模块
│   ├── registry.js        # IPC处理器注册管理
│   └── hooks.js           # 应用生命周期钩子管理
├── plugins/               # 功能插件
│   ├── auth.js           # 用户认证插件
│   ├── config.js         # 系统配置插件
│   ├── logger.js         # 日志管理插件
│   ├── media.js          # 媒体播放插件
│   ├── update.js         # 更新管理插件
│   └── windowControl.js  # 窗口控制插件
└── index.js              # 主入口文件
```

## 核心模块

### registry.js
- 统一管理所有 IPC 处理器的注册
- 提供注册、移除、查询处理器的接口
- 支持普通事件监听 (`ipcMain.on`) 和双向通信 (`ipcMain.handle`)

### hooks.js
- 管理应用生命周期钩子
- 支持 `beforeQuit`、`ready`、`windowAllClosed`、`activate` 等钩子
- 自动绑定应用事件并执行注册的回调函数

## 插件模块

每个插件都是独立的功能模块，负责特定的业务逻辑：

- **auth.js**: 处理用户登录、配置管理、历史记录等认证相关功能
- **config.js**: 处理系统配置，如下载代理设置
- **logger.js**: 处理渲染进程的日志消息转发
- **media.js**: 处理视频播放相关功能，包括播放器管理和生命周期
- **update.js**: 处理应用更新检查功能
- **windowControl.js**: 处理窗口的最小化、最大化、关闭等操作

## 使用方式

### 创建新插件

1. 在 `plugins/` 目录下创建新的 JS 文件
2. 实现初始化函数（函数名以 `init` 开头）
3. 在初始化函数中注册所需的 IPC 处理器

示例：
```javascript
const { registerHandler } = require('../core/registry');

function handleMyFeature(event, data) {
    // 处理逻辑
}

function initMyFeatureHandlers() {
    registerHandler('my-feature', handleMyFeature);
}

module.exports = {
    initMyFeatureHandlers
};
```

### 注册应用钩子

如果插件需要监听应用生命周期事件：

```javascript
const { registerAppHook } = require('../core/hooks');

function handleAppReady() {
    // 应用就绪时的处理逻辑
}

function initMyPlugin() {
    registerAppHook('ready', handleAppReady);
}
```

## 优势

1. **模块化**: 每个功能独立成插件，职责单一
2. **可扩展**: 新增功能只需添加新插件，无需修改现有代码
3. **可维护**: 代码结构清晰，便于定位和修改问题
4. **自动加载**: 插件自动发现和加载，无需手动引入
5. **类型安全**: 统一的注册接口，减少错误
6. **生命周期管理**: 统一的应用钩子管理，便于资源清理

## 向后兼容

新架构保持了与原有代码的兼容性，主要导出接口保持不变：
- `registerIpcHandlers()`: 注册所有处理器
- `updateChecker`: 更新检查器实例
