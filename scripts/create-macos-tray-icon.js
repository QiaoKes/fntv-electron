const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// 为 macOS 创建专门的状态栏图标
async function createMacOSTrayIcon() {
    const sourceIconPath = path.join(__dirname, '../build/icon.png');
    const outputPath = path.join(__dirname, '../build/icon-tray-macos.png');
    
    try {
        // 检查源文件是否存在
        if (!fs.existsSync(sourceIconPath)) {
            console.error('源图标文件不存在:', sourceIconPath);
            return;
        }

        // 读取原始图标并创建适合状态栏的版本
        await sharp(sourceIconPath)
            // 调整为 18x18 像素（macOS 状态栏推荐尺寸）
            .resize(18, 18, {
                fit: 'inside',
                withoutEnlargement: false
            })
            // 转换为灰度图（适合模板图像）
            .grayscale()
            // 增强对比度，确保在状态栏中清晰可见
            .normalise()
            // 保存为 PNG
            .png({
                compressionLevel: 6,
                progressive: false
            })
            .toFile(outputPath);

        console.log('✓ macOS 状态栏图标创建成功:', outputPath);
        
        // 验证生成的图标
        const metadata = await sharp(outputPath).metadata();
        console.log('图标信息:', {
            尺寸: `${metadata.width}x${metadata.height}`,
            格式: metadata.format,
            通道: metadata.channels,
            深度: metadata.depth
        });

        // 同时创建 2x 版本用于高分辨率屏幕
        const output2xPath = path.join(__dirname, '../build/icon-tray-macos@2x.png');
        await sharp(sourceIconPath)
            .resize(36, 36, {
                fit: 'inside',
                withoutEnlargement: false
            })
            .grayscale()
            .normalise()
            .png({
                compressionLevel: 6,
                progressive: false
            })
            .toFile(output2xPath);

        console.log('✓ macOS 状态栏图标 @2x 版本创建成功:', output2xPath);

    } catch (error) {
        console.error('创建 macOS 状态栏图标失败:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    createMacOSTrayIcon();
}

module.exports = { createMacOSTrayIcon };
