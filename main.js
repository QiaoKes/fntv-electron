// Modules to control application life and create native browser window
const { app, BrowserWindow, session, screen, ipcMain } = require('electron');
const path = require('node:path');
const { saveTokens, restoreCookie, SITE_URL } = require('./token');
const { fnApi } = require('./fn_api');
const playWithMpv = require('./mpv');
const fs = require('fs');
const axios = require('axios'); // 引入 axios 库

let mainWindow;

function setHalfScreen() {
    // 设置窗口为初始大小并居中
    mainWindow.setSize(1200, 800);
    mainWindow.center();
    mainWindow.unmaximize(); // 确保不是最大化状态
}

function setFullScreen() {
    mainWindow.maximize();
}

async function createWindow() {
    // 预先恢复 Cookie
    const ses = session.fromPartition('persist:fntv');
    restoreCookie(ses).catch(console.error);


    mainWindow = new BrowserWindow({
        width: 1400,
        height: 800,
        minWidth: 800,
        minHeight: 800,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'icon.ico'),
        frame: false, // 隐藏原生标题栏
        transparent: true, // 窗口背景透明
        webPreferences: {
            webgl: true,
            partition: 'persist:fntv',
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // 添加 IPC 监听
    ipcMain.on('window-minimize', () => mainWindow.minimize());
    ipcMain.on('window-maximize', () => {
        mainWindow.isMaximized() ? setHalfScreen() : setFullScreen();
    });
    ipcMain.on('window-close', () => mainWindow.close());
    ipcMain.on('play-movie', playMovie);

    // 加载 URL
    mainWindow.loadURL(`${SITE_URL}/v`);

    // 页面加载完成时，保存 token
    const saveCookies = () => {
        ses.cookies.get({ url: SITE_URL }).then(saveTokens).catch(console.error);
    };
    mainWindow.webContents.on('did-navigate', saveCookies);
    mainWindow.webContents.on('did-navigate-in-page', saveCookies);
    mainWindow.webContents.on('did-finish-load', saveCookies);

    // F11切换全屏/半屏
    let isFullScreen = false;
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            if (isFullScreen) {
                setHalfScreen();
            } else {
                setFullScreen();
            }
            isFullScreen = !isFullScreen;
            event.preventDefault();
        }
    });

    // 禁止自由缩放窗口
    // mainWindow.on('will-resize', (e) => {
    //     e.preventDefault();
    // });

    // mainWindow.webContents.openDevTools()

    // app.getGPUInfo('complete').then(info => {
    //     console.log(JSON.stringify(info, null, 2));
    // });
}

// 获取字幕文件列表
async function getSubtitle(itemGuid, token) {
    return fnApi(SITE_URL, '/v/api/v1/stream/list/' + itemGuid, token, null).then(response => {
        if (response.success) {
            const streams = response.data.subtitle_streams;
            // 数组每个元素是一个object，获取数组元素中字段名称为guid的值和format的值
            const subtitles = streams.map(stream => ({
                id: stream.guid,
                format: stream.format
            }));
        
            if (subtitles.length > 0) {
                console.log('获取到字幕文件:', subtitles);
                return subtitles; // 返回第一个字幕文件的 URL
            } else {
                console.warn('没有找到字幕文件');
                return [];
            }
        } else {
            console.error('获取字幕列表失败:', response.message);
            return [];
        }
    }).catch(error => {
        console.error('获取字幕列表时发生错误:', error);
        return [];
    });
}

// 下载字幕文件
async function downloadSubtitle(subs) {
    const tempDir = app.getPath('temp') + '/fntv_subtitles';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    } else {
        // 清空目录
        fs.readdirSync(tempDir).forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
    }
    
    // 创建 Axios 实例（可配置公共参数）
    const api = axios.create({
        baseURL: SITE_URL,
        timeout: 10000, // 10秒超时
        responseType: 'text', // 字幕文件是文本格式
    });

    // 为每个ID创建下载任务
    const downloadTasks = subs.map(sub => {
        const id = sub.id
        const format = sub.format || 'srt'; // 默认格式为 srt
        const filePath = path.join(tempDir, `${id}.${format}`);
        const url = `/v/api/v1/subtitle/dl/${id}`;
        
        return api.get(url)
            .then(response => {
                // 检查 HTTP 状态码
                if (response.status >= 200 && response.status < 300) {
                    return fs.promises.writeFile(filePath, response.data)
                        .then(() => {
                            console.log(`✅ 字幕文件已下载到: ${filePath}`);
                            return { id, filePath, success: true };
                        });
                } else {
                    console.error(`❌ 服务端错误: ${response.status} ${response.statusText} (ID: ${id})`);
                    return { id, filePath, success: false, error: `HTTP ${response.status}` };
                }
            })
            .catch(error => {
                // 处理不同类型的错误
                let errorMsg = '未知错误';
                
                if (error.response) {
                    // API 返回错误状态码 (4xx/5xx)
                    errorMsg = `服务端错误: ${error.response.status} ${error.response.statusText}`;
                } else if (error.request) {
                    // 请求已发出但无响应
                    errorMsg = '网络错误: 无响应';
                } else {
                    // 其他错误 (如配置错误)
                    errorMsg = `请求错误: ${error.message}`;
                }
                
                console.error(`❌ ID ${id} 下载失败:`, errorMsg);
                return { id, filePath, success: false, error: errorMsg };
            });
    });

    // 等待所有任务完成
    const results = await Promise.allSettled(downloadTasks);
    
    // 分析结果
    const successfulDownloads = results
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => result.value);
    
    const failedDownloads = results
        .filter(result => result.status === 'fulfilled' && !result.value.success)
        .map(result => result.value);
    
    console.log('========================================');
    console.log('字幕下载摘要:');
    console.log(`🔹 总数: ${subs.length}`);
    console.log(`✅ 成功: ${successfulDownloads.length}`);
    console.log(`❌ 失败: ${failedDownloads.length}`);
    console.log('========================================');
    
    // 返回格式化的下载结果
    result = successfulDownloads.map(d => d.filePath);
    console.log('成功下载的字幕文件:', result);
    return result;
}

// 处理播放事件
async function playMovie(event, { itemGuid, token }) {
    console.log('Play movie event received:', itemGuid, token);

    subFiles = getSubtitle(itemGuid, token).then(downloadSubtitle).catch(error => {
        console.error('获取字幕文件失败:', error);
        return [];
    });

    // 获取播放信息
    fnApi(SITE_URL, '/v/api/v1/play/info', token, {
        item_guid: itemGuid,
    }).then(async response => {
        if (response.success) {
            // 等待字幕文件
            subs = await subFiles
            console.log('字幕文件已准备好:', subs);
            // 拼接字幕参数
            subArgs = '';
            if (subs.length > 0) {
                subArgs = subs.map(sub => `--sub-file=${sub}`).join(' ');
            }

            // console.log('Play event sent successfully:', response.data);
            // 配置播放参数（使用自定义路径和额外参数）
            playUrl = SITE_URL + '/v/api/v1/media/range/' + response.data.media_guid;
            last = response.data.ts;
            total = response.data.item.duration;
            console.log('Play URL:', playUrl, 'Last:', last, 'Total:', total);
            // 转为字符串+%
            p = last / total * 100 + '%';
            playWithMpv({
                url: playUrl,
                mpvPath: 'third_party\\mpv\\mpvnet.exe',
                headers: {
                    Authorization: token,
                },
                extraArgs: [
                    '--ontop',
                    '--start=' + p,
                    subArgs,
                ],
                debug: true,
                onData: (data) => console.log('MPV output:', data),
                onError: (err) => console.error('MPV error:', err),
                onExit: (code) => console.log('MPV exited with code:', code)
            });
        } else {
            console.error('Failed to send play event:', response.message);
        }
    }).catch(error => {
        console.error('Error sending play event:', error);
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});