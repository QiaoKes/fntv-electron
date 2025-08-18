const { getMainWindow } = require('./windowManager');

function setHalfScreen() {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    mainWindow.setSize(1200, 800);
    mainWindow.center();
    mainWindow.unmaximize();
}

function setFullScreen() {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.maximize();
}

function setupFullScreenToggle(mainWindow) {
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
}

module.exports = {
    setHalfScreen,
    setFullScreen,
    setupFullScreenToggle
};