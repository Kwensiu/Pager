import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { app, BrowserWindow, shell } from 'electron'

interface WindowState {
  width: number
  height: number
  x: number | null
  y: number | null
  maximized: boolean
}

/**
 * 获取窗口状态文件路径
 */
function getWindowStateFilePath(): string {
  const userDataPath = app.getPath('userData')
  return join(userDataPath, 'window-state.json')
}

/**
 * 获取保存的窗口状态
 */
function getSavedWindowState(): WindowState | null {
  try {
    const filePath = getWindowStateFilePath()
    if (existsSync(filePath)) {
      const savedState = readFileSync(filePath, 'utf-8')
      return JSON.parse(savedState)
    }
  } catch (error) {
    console.error('Failed to load window state:', error)
  }
  return null
}

/**
 * 保存窗口状态
 */
function saveWindowState(window: BrowserWindow): void {
  try {
    const bounds = window.getBounds()
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: window.isMaximized()
    }

    const filePath = getWindowStateFilePath()
    const userDataPath = app.getPath('userData')

    // 确保目录存在
    if (!existsSync(userDataPath)) {
      mkdirSync(userDataPath, { recursive: true })
    }

    writeFileSync(filePath, JSON.stringify(state), 'utf-8')
  } catch (error) {
    console.error('Failed to save window state:', error)
  }
}

function getIconPath(): string | undefined {
  // 将 app.getAppPath() 移到函数内部，避免在模块加载时访问 app
  const appPath = app.getAppPath()
  const iconPath = join(appPath, 'resources', 'icon.ico')
  if (existsSync(iconPath)) {
    console.log('Icon found at', iconPath)
    return iconPath
  }
  // 回退到开发资源路径
  const devPath = join(__dirname, '../../../resources/icon.ico')
  if (existsSync(devPath)) {
    console.log('Icon found at dev path', devPath)
    return devPath
  }
  console.warn('Icon not found at', iconPath, 'or', devPath)
  return undefined
}

export async function createWindow(): Promise<Electron.BrowserWindow> {
  const icon = getIconPath()
  console.log('Creating window with icon:', icon)

  // 获取保存的窗口状态
  const savedState = getSavedWindowState()

  // 使用 app.getAppPath() 获取更可靠的 preload 路径
  const appPath = app.getAppPath()
  const preloadPath =
    process.env.NODE_ENV === 'development'
      ? join(appPath, 'out/preload/index.js')
      : join(appPath, 'out/preload/index.js')

  console.log('Preload path:', preloadPath)

  const mainWindow = new BrowserWindow({
    width: savedState?.width || 900,
    height: savedState?.height || 670,
    x: savedState?.x ?? undefined,
    y: savedState?.y ?? undefined,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      // 启用网络相关功能
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  })

  // 如果之前是最大化状态，恢复最大化
  if (savedState?.maximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('resize', () => {
    // 通知渲染进程窗口大小变化
    mainWindow.webContents.send('window-resized')
    // 保存窗口状态
    saveWindowState(mainWindow)
  })

  mainWindow.on('move', () => {
    // 保存窗口状态
    saveWindowState(mainWindow)
  })

  mainWindow.on('maximize', () => {
    // 保存窗口状态
    saveWindowState(mainWindow)
  })

  mainWindow.on('unmaximize', () => {
    // 保存窗口状态
    saveWindowState(mainWindow)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 开发模式检测
  const isDev = process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL

  // 开发模式下打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// 处理证书错误
export function registerCertificateErrorHandler(): void {
  app.on(
    'certificate-error',
    (
      event: Electron.Event,
      _webContents: Electron.WebContents,
      _url: string,
      _error: string,
      _certificate: Electron.Certificate,
      callback: (isTrusted: boolean) => void
    ) => {
      // 忽略证书错误，继续加载
      event.preventDefault()
      callback(true) // 信任证书，允许继续加载
    }
  )
}

/**
 * 注册渲染进程崩溃处理器
 */
export function registerRenderProcessGoneHandler(): void {
  app.on('render-process-gone', (_event, webContents, details) => {
    if (details.reason === 'crashed') {
      console.error('渲染进程崩溃:', details)
      // 自动重新加载页面
      if (!webContents.isDestroyed()) {
        webContents.reload()
      }
    }
  })
}
