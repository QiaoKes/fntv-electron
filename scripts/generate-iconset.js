const fs = require('fs');
const path = require('path');

// macOS iconset 需要的所有尺寸
const iconSizes = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 }
];

async function generateIconSet() {
    const buildDir = path.join(__dirname, '..', 'build');
    const iconsetDir = path.join(buildDir, 'icon.iconset');
    const sourceIcon = path.join(buildDir, 'icon.png');

    // 检查源图标是否存在
    if (!fs.existsSync(sourceIcon)) {
        console.error('错误: build/icon.png 文件不存在');
        process.exit(1);
    }

    // 创建 iconset 目录
    if (!fs.existsSync(iconsetDir)) {
        fs.mkdirSync(iconsetDir, { recursive: true });
    }

    console.log('开始生成 macOS iconset...');
    console.log('提示: 由于在 Windows 环境下，需要手动使用图像处理工具生成不同尺寸的图标');
    console.log('');
    console.log('请按以下步骤操作:');
    console.log('1. 使用图像编辑软件(如 Photoshop, GIMP, 或在线工具)打开 build/icon.png');
    console.log('2. 将图标调整为以下尺寸并保存到 build/icon.iconset/ 目录:');
    console.log('');

    // 生成所需文件列表
    iconSizes.forEach(icon => {
        const targetPath = path.join(iconsetDir, icon.name);
        console.log(`   ${icon.name} (${icon.size}x${icon.size} 像素)`);
        
        // 创建占位文件，提醒用户需要创建
        if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, '# 待生成 - 请手动创建此文件\n');
        }
    });

    console.log('');
    console.log('3. 或者使用以下在线工具自动生成:');
    console.log('   - https://iconverticons.com/online/');
    console.log('   - https://www.img2icns.com/');
    console.log('   - https://cloudconvert.com/png-to-icns');
    console.log('');
    console.log('4. 如果使用在线工具生成了 .icns 文件，请将其重命名为 icon.icns 并放在 build/ 目录下');
    console.log('');
    console.log('iconset 目录已创建: build/icon.iconset/');
}

// 检查是否安装了 sharp 库 (可选的图像处理库)
function checkSharpAvailability() {
    try {
        require('sharp');
        return true;
    } catch (e) {
        return false;
    }
}

// 如果有 sharp 库，尝试自动生成
async function generateWithSharp() {
    const sharp = require('sharp');
    const buildDir = path.join(__dirname, '..', 'build');
    const iconsetDir = path.join(buildDir, 'icon.iconset');
    const sourceIcon = path.join(buildDir, 'icon.png');

    console.log('使用 Sharp 库自动生成图标...');

    for (const icon of iconSizes) {
        const targetPath = path.join(iconsetDir, icon.name);
        try {
            await sharp(sourceIcon)
                .resize(icon.size, icon.size, {
                    kernel: sharp.kernel.lanczos3,
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toFile(targetPath);
            console.log(`✓ 生成 ${icon.name}`);
        } catch (error) {
            console.error(`✗ 生成 ${icon.name} 失败:`, error.message);
        }
    }
}

async function main() {
    if (checkSharpAvailability()) {
        const buildDir = path.join(__dirname, '..', 'build');
        const iconsetDir = path.join(buildDir, 'icon.iconset');
        
        // 创建 iconset 目录
        if (!fs.existsSync(iconsetDir)) {
            fs.mkdirSync(iconsetDir, { recursive: true });
        }
        
        await generateWithSharp();
        console.log('');
        console.log('✅ iconset 生成完成!');
        console.log('如果需要在 macOS 上生成 .icns 文件，请运行:');
        console.log('iconutil -c icns build/icon.iconset/');
    } else {
        await generateIconSet();
        console.log('');
        console.log('💡 提示: 安装 sharp 库可以自动生成图标:');
        console.log('npm install --save-dev sharp');
        console.log('然后重新运行此脚本');
    }
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { generateIconSet, generateWithSharp };
