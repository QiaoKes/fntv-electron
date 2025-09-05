const fs = require('fs');
const path = require('path');
const { nativeImage } = require('electron');

// 从 ICO 文件创建 PNG 图标用于 macOS 托盘
function createTrayIcon() {
    const iconPath = path.join(__dirname, '../build/icon.ico');
    const outputPath = path.join(__dirname, '../build/icon.png');
    
    try {
        // 读取 ICO 文件
        const icon = nativeImage.createFromPath(iconPath);
        
        if (icon.isEmpty()) {
            console.error('ICO 图标文件为空或不存在');
            return;
        }
        
        // 调整尺寸为 16x16（适合托盘）
        const resizedIcon = icon.resize({ width: 16, height: 16 });
        
        // 保存为 PNG
        const pngBuffer = resizedIcon.toPNG();
        fs.writeFileSync(outputPath, pngBuffer);
        
        console.log('PNG 托盘图标创建成功:', outputPath);
    } catch (error) {
        console.error('创建 PNG 图标失败:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    createTrayIcon();
}

module.exports = { createTrayIcon };
