const { app, BrowserWindow, screen, } = require('electron')
require('@electron/remote/main').initialize()
const path = require('node:path')
const url = require('url')

let mainWindow
const backendHost = process.env.MOESR_HOST || '127.0.0.1'
const backendPort = process.env.MOESR_PORT || '10721'

function createWindow() {
    const { scaleFactor } = screen.getPrimaryDisplay();
    console.log(scaleFactor)
    // console.log(path.join(__dirname, 'preload.js'))
    mainWindow = new BrowserWindow(
        {
            width: 1280, height: 720,
            title: 'Moe SR',
            icon: path.join(__dirname, 'icon.png'),
            autoHideMenuBar: true,
            webPreferences: {
                nodeIntegration: true,
                enableRemoteModule: true,
                contextIsolation: false,
                webSecurity: false,
                enableRemoteModule: true,
                preload: path.join(__dirname, 'preload.js')
            }
        }
    )
    require('@electron/remote/main').enable(mainWindow.webContents)
    mainWindow.loadURL(`http://${backendHost}:${backendPort}/`);
    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

app.whenReady().then(() => {
    createWindow()
})
