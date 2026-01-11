import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

// 设置忽略SSL错误
app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('allow-running-insecure-content')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pager.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  mainWindow = createWindow()
  registerIpcHandlers()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
    mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
