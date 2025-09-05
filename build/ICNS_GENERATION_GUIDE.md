# macOS 图标 (ICNS) 生成说明

## 方法一: 使用项目脚本 (推荐)

### 生成 iconset (适用于所有平台):
```bash
npm run generate-iconset
```
这会自动从 `build/icon.png` 生成所有需要的尺寸到 `build/icon.iconset/` 目录。

### 生成 ICNS (仅限 macOS):
```bash
npm run generate-icns
```
这会在 macOS 上使用 `iconutil` 工具将 iconset 转换为 `icon.icns` 文件。

## 方法二: 使用在线工具
1. 访问 https://iconverticons.com/online/
2. 上传 build/icon.ico 或 build/icon.png
3. 选择输出格式为 ICNS
4. 下载并重命名为 icon.icns
5. 放置到 build/ 目录下

## 方法三: 手动使用 macOS 系统工具
1. 确保 `build/icon.iconset/` 目录包含所有必需的 PNG 文件
2. 在 macOS 终端中运行: `iconutil -c icns build/icon.iconset/`

## iconset 所需文件清单
- icon_16x16.png (16x16 像素)
- icon_16x16@2x.png (32x32 像素)
- icon_32x32.png (32x32 像素)
- icon_32x32@2x.png (64x64 像素)
- icon_128x128.png (128x128 像素)
- icon_128x128@2x.png (256x256 像素)
- icon_256x256.png (256x256 像素)
- icon_256x256@2x.png (512x512 像素)
- icon_512x512.png (512x512 像素)
- icon_512x512@2x.png (1024x1024 像素)

## 注意事项
- 使用 `npm run generate-iconset` 会自动生成所有需要的尺寸
- 在 Windows/Linux 上只能生成 iconset，需要在 macOS 上才能生成最终的 .icns 文件
- electron-builder 在 macOS 上构建时会自动使用 iconset 或现有的 .icns 文件
