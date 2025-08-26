# EventHandlers 重构迁移指南

## 重构概述

原始的 `eventHandlers.js` 文件包含了所有的 IPC 处理逻辑，代码臃肿，难以维护。新的插件化架构将功能按职责分解到不同的插件中。

## 文件映射关系

### 原始文件结构
```
src/main/
└── eventHandlers.js  (单一文件，300+ 行代码)
```

### 新的文件结构
```
src/main/handlers/
├── core/
│   ├── registry.js     # IPC处理器注册管理
│   └── hooks.js        # 应用生命周期钩子管理
├── plugins/
│   ├── auth.js         # 登录、配置、历史记录
│   ├── config.js       # 系统配置（代理等）
│   ├── logger.js       # 日志管理
│   ├── media.js        # 媒体播放
│   ├── update.js       # 更新管理
│   └── windowControl.js # 窗口控制
└── index.js            # 主入口
```

## 功能分解对照表

| 原始功能 | 新插件位置 | 说明 |
|---------|-----------|------|
| `handleLogin()` | `auth.js` | 用户登录处理 |
| `handleGetConfig()` | `auth.js` | 获取配置信息 |
| `handleClearHistory()` | `auth.js` | 清除历史记录 |
| `handleDeleteHistoryItem()` | `auth.js` | 删除历史记录项 |
| `handleMinimize()` | `windowControl.js` | 窗口最小化 |
| `handleMaximize()` | `windowControl.js` | 窗口最大化 |
| `handleClose()` | `windowControl.js` | 窗口关闭 |
| `playMovie()` | `media.js` | 视频播放处理 |
| `refreshWindow()` | `media.js` | 刷新窗口 |
| `handleCheckUpdate()` | `update.js` | 手动检查更新 |
| `handleAutoCheckUpdate()` | `update.js` | 自动检查更新 |
| `handleGetVersion()` | `update.js` | 获取版本信息 |
| `handleDownloadProxy()` | `config.js` | 下载代理设置 |
| `handleLogMessage()` | `logger.js` | 日志消息处理 |
| `app.on('before-quit')` | `hooks.js` + `media.js` | 应用退出钩子 |

## 主要改进

### 1. 模块化设计
- **旧**: 所有功能混合在一个文件中
- **新**: 按职责分解为独立插件

### 2. 统一注册机制
- **旧**: 直接调用 `ipcMain.on/handle`
- **新**: 通过 `registerHandler()` 统一注册

### 3. 生命周期管理
- **旧**: 直接监听应用事件
- **新**: 通过钩子系统统一管理

### 4. 自动发现加载
- **旧**: 手动调用各个处理函数
- **新**: 自动扫描并加载所有插件

## 使用变化

### 在 main.js 中的使用
```javascript
// 旧方式
const { registerIpcHandlers } = require('./eventHandlers');

// 新方式 (无变化)
const { registerIpcHandlers } = require('./handlers');
```

### 添加新功能
```javascript
// 旧方式：需要在 eventHandlers.js 中添加函数，然后在 registerIpcHandlers 中调用

// 新方式：创建新插件文件
// plugins/newFeature.js
const { registerHandler } = require('../core/registry');

function handleNewFeature(event, data) {
    // 处理逻辑
}

function initNewFeatureHandlers() {
    registerHandler('new-feature', handleNewFeature);
}

module.exports = { initNewFeatureHandlers };
```

## 兼容性说明

1. **API 兼容**: 所有原有的 IPC 通道名称和行为保持不变
2. **导出兼容**: `index.js` 导出的接口与原 `eventHandlers.js` 保持一致
3. **功能兼容**: 所有原有功能都已迁移到对应插件中

## 开发建议

1. **单一职责**: 每个插件只负责特定的功能领域
2. **命名规范**: 插件文件名应该清晰表达其职责
3. **初始化函数**: 所有初始化函数以 `init` 开头，便于自动发现
4. **错误处理**: 在插件中做好错误处理，避免影响其他插件
5. **文档更新**: 新增插件时更新相应的文档

这种重构不仅提高了代码的可维护性，还为未来的功能扩展提供了良好的架构基础。
