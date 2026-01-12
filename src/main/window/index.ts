import { app, BrowserWindow, shell, WebContents, Certificate } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { existsSync } from 'fs'

function getIconPath(): string | undefined {
  const appPath = app.getAppPath()
  const iconPath = join(appPath, 'resources', 'icon.ico')
  if (existsSync(iconPath)) {
    console.log('Icon found at', iconPath)
    return iconPath
  }
  // 回退到开发资源路径
  const devPath = join(__dirname, '../../resources/icon.ico')
  if (existsSync(devPath)) {
    console.log('Icon found at dev path', devPath)
    return devPath
  }
  console.warn('Icon not found at', iconPath, 'or', devPath)
  return undefined
}

const icon: string | undefined = getIconPath()

export function createWindow(): BrowserWindow {
  console.log('Creating window with icon:', icon)
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      // 启用网络相关功能
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('resize', () => {
    // 通知渲染进程窗口大小变化
    mainWindow.webContents.send('window-resized')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式下打开开发者工具
  if (is.dev) {
    mainWindow.webContents.openDevTools()
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// 处理证书错误
app.on(
  'certificate-error',
  (
    event: Electron.Event,
    _webContents: WebContents,
    _url: string,
    _error: string,
    _certificate: Certificate,
    callback: (isTrusted: boolean) => void
  ) => {
    // 忽略证书错误，继续加载
    event.preventDefault()
    callback(true) // 信任证书，允许继续加载
  }
)
