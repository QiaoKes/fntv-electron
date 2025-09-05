#!/bin/bash

# macOS iconset 转换为 icns 文件的脚本
# 此脚本需要在 macOS 系统上运行

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$(dirname "$SCRIPT_DIR")/build"
ICONSET_DIR="$BUILD_DIR/icon.iconset"
ICNS_FILE="$BUILD_DIR/icon.icns"

echo "开始生成 macOS ICNS 文件..."

# 检查 iconset 目录是否存在
if [ ! -d "$ICONSET_DIR" ]; then
    echo "错误: icon.iconset 目录不存在"
    echo "请先运行: npm run generate-iconset"
    exit 1
fi

# 检查是否有必要的图标文件
required_files=(
    "icon_16x16.png"
    "icon_16x16@2x.png"
    "icon_32x32.png"
    "icon_32x32@2x.png"
    "icon_128x128.png"
    "icon_128x128@2x.png"
    "icon_256x256.png"
    "icon_256x256@2x.png"
    "icon_512x512.png"
    "icon_512x512@2x.png"
)

missing_files=()
for file in "${required_files[@]}"; do
    if [ ! -f "$ICONSET_DIR/$file" ]; then
        missing_files+=("$file")
    fi
done

if [ ${#missing_files[@]} -gt 0 ]; then
    echo "错误: 缺少以下图标文件:"
    for file in "${missing_files[@]}"; do
        echo "  - $file"
    done
    echo "请先运行: npm run generate-iconset"
    exit 1
fi

# 使用 iconutil 生成 icns 文件
echo "使用 iconutil 生成 ICNS 文件..."
iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"

if [ $? -eq 0 ]; then
    echo "✅ ICNS 文件生成成功: $ICNS_FILE"
    echo ""
    echo "文件信息:"
    ls -lh "$ICNS_FILE"
    echo ""
    echo "现在可以使用这个 ICNS 文件进行 macOS 构建了!"
else
    echo "❌ ICNS 文件生成失败"
    exit 1
fi
