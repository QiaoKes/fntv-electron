const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const USER_DATA_PATH = path.join(app.getPath('home'), '.fntv');

module.exports = {
    USER_DATA_PATH
};