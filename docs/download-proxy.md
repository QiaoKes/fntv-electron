# 下载代理功能说明

## 功能概述
为更新检查的文件下载添加了可配置的代理功能，采用小巧美观的UI设计，用于解决GitHub下载速度慢的问题。

## 功能特点
- ✅ 仅用于文件下载，不影响API请求
- ✅ 美观的齿轮按钮设计，位于右上角
- ✅ 弹出式设置面板，简洁易用
- ✅ 支持启用/禁用代理切换开关
- ✅ 代理URL可配置，支持多种代理服务
- ✅ 默认开启代理，开箱即用
- ✅ 配置持久化保存
- ✅ 点击外部自动关闭面板

## 使用方法

### 1. 打开代理设置
1. 点击登录页面右上角的齿轮图标⚙️
2. 弹出代理设置面板

### 2. 配置代理
1. **启用开关**：控制是否使用代理（默认开启）
2. **代理地址**：输入代理URL（默认：`https://ghfast.top`）
3. 点击"保存"按钮确认设置

### 3. 支持的代理服务
- **ghfast.top** - `https://ghfast.top` （推荐，默认）
- **gh.api.99988866.xyz** - `https://gh.api.99988866.xyz`
- **github.moeyy.xyz** - `https://github.moeyy.xyz`
- **hub.fastgit.xyz** - `https://hub.fastgit.xyz`
- 或其他GitHub代理服务

## UI设计特点

### 齿轮按钮
- 位置：登录页面右上角
- 样式：半透明圆形按钮，毛玻璃效果
- 交互：悬停时旋转90度，优雅动画

### 设置面板
- 位置：齿轮按钮下方
- 样式：现代化卡片设计，毛玻璃背景
- 动画：淡入淡出 + 滑动效果
- 功能：点击外部自动关闭

### 开关控件
- 类型：iOS风格滑动开关
- 状态：蓝色激活，灰色禁用
- 默认：开启状态

## 配置存储

### 数据结构
```json
{
  "downloadProxyEnabled": true,
  "downloadProxy": "https://ghfast.top",
  "account": "...",
  "domain": "...",
  ...
}
```

### 默认值
- `downloadProxyEnabled`: `true` （默认开启）
- `downloadProxy`: `"https://ghfast.top"`

## 技术实现

### 前端界面
- **CSS**：现代化设计，毛玻璃效果，平滑动画
- **JavaScript**：面板切换，事件处理，IPC通信
- **交互**：点击外部关闭，键盘友好

### 后端逻辑
- **配置管理**：支持enabled和proxyUrl两个字段
- **代理应用**：只在enabled=true时应用代理
- **错误处理**：配置失败时自动回退

### API接口
```javascript
// 获取配置
getDownloadProxyConfig() // 返回 {enabled, proxyUrl}

// 设置配置  
setDownloadProxyConfig({enabled, proxyUrl})

// IPC事件
'get-download-proxy' -> 'download-proxy-info'
'set-download-proxy' -> 'download-proxy-set'
```

## 代理工作原理

### 启用代理时
```
原始: https://github.com/owner/repo/releases/download/v1.0.0/app.exe
代理: https://ghfast.top/https://github.com/owner/repo/releases/download/v1.0.0/app.exe
```

### 禁用代理时
```
使用原始链接，不经过代理
```

## 日志输出

### 启用代理
```
使用代理下载链接: https://ghfast.top/https://github.com/...
```

### 禁用代理  
```
使用原始下载链接: https://github.com/...
```

### 配置变更
```
代理设置保存成功
```

## 注意事项

1. **默认开启**：首次使用会自动启用代理
2. **GitHub专用**：只对GitHub域名应用代理
3. **网络要求**：需要代理服务正常工作
4. **配置验证**：URL格式需要正确
5. **向后兼容**：保持旧版本配置兼容性

## 故障排除

### 代理不生效
1. 检查开关是否开启
2. 验证代理URL格式
3. 尝试其他代理服务
4. 查看控制台日志

### 面板显示异常
1. 刷新页面重试
2. 检查浏览器兼容性
3. 清除缓存重启应用

### 保存失败
1. 检查配置文件权限
2. 确认磁盘空间充足
3. 查看错误日志详情
