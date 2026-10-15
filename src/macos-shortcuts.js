//Handle native shortcuts before YouTube can consume the keyboard event.
function setup(webContents, app) {
    webContents.on('before-input-event', (event, input) => {
        const commandOnly = input.meta && !input.control && !input.alt;
        const key = input.key?.toLowerCase();
        //Copy is resolved in the renderer, including normal selected-text copying.
        webContents.setIgnoreMenuShortcuts(commandOnly && key === 'c');

        if (input.type === 'keyDown' && commandOnly && !input.shift && key === 'q') {
            event.preventDefault();
            if (!input.isAutoRepeat) app.quit();
        }
    });
    webContents.on('blur', () => webContents.setIgnoreMenuShortcuts(false));
}

module.exports = { setup };
