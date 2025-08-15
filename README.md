# fntv-electron 桌面客户端

![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=Electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)

飞牛影视的跨平台桌面客户端，基于Electron构建，提供更好的桌面体验和增强功能。

## ✨ 主要功能

- **原生桌面体验** - 将飞牛影视Web版封装为原生应用
- **自动登录** - 支持cookie保存，避免重复登录
- **高清播放** - 优化视频播放性能
- **多平台支持** - Windows/macOS/Linux全平台兼容

## 🚀 未来计划

1. **界面美化**

   - 自定义主题支持
   - 暗黑/亮色模式切换
   - 更符合桌面应用的UI设计
2. **登录体验优化**

   - 持久化保存用户凭证
   - 自动登录功能
   - 多账户支持
3. **播放器增强**

   - 支持调用第三方播放器（如VLC, MPV等）
   - 硬件加速解码
   - HDR/4K支持优化

## 📦 安装方法

### 预编译版本

前往 [Releases页面](https://github.com/yourusername/fntv-electron/releases) 下载最新版本：

- Windows: `fntv-electron-Setup-x.x.x.exe`
- macOS: `fntv-electron-x.x.x.dmg`
- Linux: `fntv-electron-x.x.x.AppImage`

### 从源码构建

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/fntv-electron.git
cd fntv-electron
```

2. 安装依赖：

```bash
npm install
```

3. 运行开发模式：

```bash
npm run dev
```

4. 构建安装包：

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 🛠️ 开发指南

### 项目结构

```
fntv-electron/
├── src/                  # 主进程源代码
├── renderer/             # 渲染进程代码
├── assets/               # 静态资源
├── build/                # 构建配置
├── dist/                 # 构建输出目录
└── package.json
```

### 常用命令

```bash
# 开发模式 (热重载)
npm run dev

# 打包应用
npm run build

# 代码检查
npm run lint

# 清理构建文件
npm run clean
```

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

---

**温馨提示**：本项目为第三方客户端，与飞牛影视官方无关。使用前请确保遵守相关服务条款。
