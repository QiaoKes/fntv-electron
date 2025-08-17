const { spawn } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * 使用mpv播放器播放指定的媒体流
 * @param {Object} options - 播放配置
 * @param {string} options.url - 媒体流的URL
 * @param {string} [options.mpvPath] - mpv可执行文件的路径(可选)
 * @param {Object} options.headers - 请求头信息
 * @param {boolean} [options.debug=false] - 是否显示调试信息
 * @param {Array<string>} [options.extraArgs] - 额外传递给mpv的参数
 * @param {Function} [options.onData] - 处理输出数据的回调
 * @param {Function} [options.onError] - 处理错误输出的回调
 * @param {Function} [options.onExit] - 处理进程退出的回调
 * 
 * @returns {ChildProcess} mpv进程对象
 */
function playWithMpv({
  url,
  mpvPath,
  headers,
  debug = false,
  extraArgs = [],
  onData = () => {},
  onError = () => {},
  onExit = () => {}
}) {
  // 跨平台处理：默认使用系统PATH中的mpv
  let executable = mpvPath;
  
  // 构建命令行参数
  const args = [];
  
  // 添加解决花屏问题的参数（针对Windows）
  if (os.platform() === 'win32') {
    args.push(
      '--vd-lavc-threads=4',
      '--vd-lavc-assume-old-x264=yes',
      '--vd-lavc-fast',
      '--video-sync=display-resample',
    );
  }
  
  // 添加请求头
  const headerArgs = [];
  for (const [key, value] of Object.entries(headers)) {
    headerArgs.push(`${key}: ${value}`);
  }
  if (headerArgs.length > 0) {
    args.push(`--http-header-fields=${headerArgs.join(',')}`);
  }
  
  // 添加其他参数
  args.push(
    '--title=Media Stream',
    ...extraArgs,
    url
  );
  
  if (debug) {
    console.log('MPV 命令:', `"${executable}" ${args.join(' ')}`);
  }
  
  // 启动播放器进程
  const player = spawn(executable, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    detached: true
  });
  
  // 处理输出
  player.stdout.on('data', (data) => {
    if (debug) {
      const output = data.toString().trim();
      if (output) {
        console.log(`[MPV] ${output}`);
      }
    }
    onData(data.toString());
  });
  
  // 处理错误输出
  player.stderr.on('data', (data) => {
    const errorMessage = data.toString().trim();
    if (errorMessage) {
      console.error(`[MPV Error] ${errorMessage}`);
      onError(errorMessage);
    }
  });
  
  // 处理退出
  player.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`播放异常结束 (code ${code})`);
    } else if (debug) {
      console.log('播放器正常退出');
    }
    onExit(code);
  });
  
  player.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.error('错误: 找不到 mpv 播放器。请确保已安装 mpv。');
      console.error('在 macOS/Linux 上: brew install mpv');
      console.error('在 Windows 上: 从 https://mpv.io/installation/ 下载');
      console.error('或使用 --mpvPath 参数指定 mpv 的完整路径');
    } else {
      console.error(`播放失败: ${err.message}`);
    }
    onError(err.message);
  });
  
  return player;
}

module.exports = playWithMpv;