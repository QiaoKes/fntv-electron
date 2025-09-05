const fs = require('fs');
const path = require('path');

/**
 * 图标转换脚本
 * 为不同平台生成所需格式的图标文件
 */

function createIconsForAllPlatforms() {
    const buildDir = path.join(__dirname, '../build');
    const iconIcoPath = path.join(buildDir, 'icon.ico');
    const iconPngPath = path.join(buildDir, 'icon.png');
    const iconIcnsPath = path.join(buildDir, 'icon.icns');
    
    console.log('检查图标文件...');
    
    // 检查是否存在基础 ICO 文件
    if (!fs.existsSync(iconIcoPath)) {
        console.error('错误: 找不到基础图标文件 icon.ico');
        process.exit(1);
    }
    
    console.log('✓ 找到 Windows 图标文件: icon.ico');
    
    // 检查 PNG 文件
    if (fs.existsSync(iconPngPath)) {
        console.log('✓ 找到 Linux 图标文件: icon.png');
    } else {
        console.log('⚠️ 未找到 Linux 图标文件: icon.png');
        console.log('提示: 可以从 ICO 文件转换生成 PNG 文件');
    }
    
    // 检查 ICNS 文件 (macOS)
    if (fs.existsSync(iconIcnsPath)) {
        console.log('✓ 找到 macOS 图标文件: icon.icns');
    } else {
        console.log('⚠️ 未找到 macOS 图标文件: icon.icns');
        console.log('提示: 需要为 macOS 打包创建 .icns 文件');
        console.log('建议使用在线工具或 macOS 系统工具转换:');
        console.log('- 在线转换: https://iconverticons.com/online/');
        console.log('- macOS 命令: iconutil -c icns icon.iconset/');
        
        // 创建一个临时的 ICNS 占位符配置说明
        const icnsInstructions = `# macOS 图标 (ICNS) 生成说明

## 方法一: 使用在线工具
1. 访问 https://iconverticons.com/online/
2. 上传 build/icon.ico 或 build/icon.png
3. 选择输出格式为 ICNS
4. 下载并重命名为 icon.icns
5. 放置到 build/ 目录下

## 方法二: 使用 macOS 系统工具
1. 创建 icon.iconset 文件夹
2. 准备不同尺寸的 PNG 文件:
   - icon_16x16.png
   - icon_16x16@2x.png
   - icon_32x32.png
   - icon_32x32@2x.png
   - icon_128x128.png
   - icon_128x128@2x.png
   - icon_256x256.png
   - icon_256x256@2x.png
   - icon_512x512.png
   - icon_512x512@2x.png
3. 运行命令: iconutil -c icns icon.iconset/

## 方法三: 使用 electron-builder 自动转换
如果只有 PNG 文件，electron-builder 在 macOS 上构建时会尝试自动生成 ICNS。
`;
        
        fs.writeFileSync(path.join(buildDir, 'ICNS_GENERATION_GUIDE.md'), icnsInstructions);
        console.log('✓ 已创建 ICNS 生成指南: build/ICNS_GENERATION_GUIDE.md');
    }
    
    console.log('\n图标文件检查完成!');
    console.log('当前支持的平台构建:');
    console.log('- Windows: ✓ (icon.ico)');
    console.log('- Linux: ' + (fs.existsSync(iconPngPath) ? '✓' : '⚠️') + ' (icon.png)');
    console.log('- macOS: ' + (fs.existsSync(iconIcnsPath) ? '✓' : '⚠️') + ' (icon.icns)');
}

// 如果直接运行此脚本
if (require.main === module) {
    createIconsForAllPlatforms();
}

module.exports = { createIconsForAllPlatforms };
