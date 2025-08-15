const path = require('node:path');
const { app } = require('electron');

const SITE_URL = 'https://yoursite.com';
const USER_DATA_PATH = path.join(app.getPath('home'), '.fntv');

module.exports = {
  SITE_URL,
  USER_DATA_PATH
};