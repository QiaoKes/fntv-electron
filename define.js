const fs = require('node:fs');
const path = require('node:path');
const { app, dialog } = require('electron');

let SITE_URL;

// 尝试读取 config.json
try {
  const configPath = path.join('./config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json 不存在');
  }

  const content = fs.readFileSync(configPath, 'utf-8');
  const config = JSON.parse(content);

  if (!config.server) {
    throw new Error('config.json 中缺少 server 字段');
  }

  SITE_URL = config.server;

} catch (err) {
  // 弹窗告警并退出
  dialog.showErrorBox('配置错误', '无法读取服务器地址，请重新安装程序。\n' + err.message);
  app.quit();
}

const USER_DATA_PATH = path.join(app.getPath('home'), '.fntv');

module.exports = {
  SITE_URL,
  USER_DATA_PATH
};