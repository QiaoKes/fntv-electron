# fntv-electron 桌面客户端

![Electron](https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=Electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)

飞牛影视桌面客户端，基于Electron构建，提供更好的桌面体验和增强功能。

<img src="resource/simple.png" width="50%">

## ✨ 主要功能

- **原生桌面体验** - 将飞牛影视Web版封装为原生应用
- **自动登录** - 支持cookie保存，避免重复登录
- **硬解播放** - 支持H264 / HEVC / VP9 / AV1，具体支持查看下面感谢项目

## 🙏 特别感谢

本项目使用以下开源项目实现HEVC硬解码功能：

- [enable-chromium-hevc-hardware-decoding](https://github.com/StaZhu/enable-chromium-hevc-hardware-decoding) - Chromium HEVC硬解码支持
- [electron-media-patch](https://github.com/5rahim/electron-media-patch) - Electron硬解码补丁

## 📦 安装方法

### 从源码构建

1. 克隆仓库：

```bash
git clone https://github.com/QiaoKes/fntv-electron.git
cd fntv-electron
```

2. 安装依赖：

```bash
npm i
```

3. 运行开发模式：

```bash
# 修改define.js下的SITE_URL为你的服务器地址
npm start
```

4. 构建安装包：

```bash
# Windows
# 进入到C:\Users\{your_user_name}\AppData\Local\electron\Cache
# 创建文件夹b3ef7c180a968a1775be99205920d296f99e12cd36db5a1b9a5a2a3bb292f8ae
# 将third_party下的electron-v36.2.1-patch-win32-x64.zip拷贝到文件夹内
npm run build
```

## 🛠️ 开发指南

### 项目结构

```
fntv-electron/
├── third_party/          # 三方依赖
├── build/                # 构建输出目录
├── main.js               # web页面封装
├── preload.js            # 标题栏美化
├── token.js              # 登录信息持久化
├── define.js             # 常量定义，服务器地址信息等
└── package.json
```

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)

---

**温馨提示**：本项目为第三方客户端，与飞牛影视官方无关。使用前请确保遵守相关服务条款。
