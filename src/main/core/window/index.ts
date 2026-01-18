import { join } from 'path'
import { existsSync, readFileSync, mkdirSync, promises as fs } from 'fs'
import { app, BrowserWindow, shell } from 'electron'

// 动态导入服务以避免循环依赖
const getStoreService = async (): Promise<typeof import('../../services/store').storeService> => {
  const { storeService } = await import('../../services/store')
  return storeService
}

const getTrayService = async (): Promise<typeof import('../../services/tray').trayService> => {
  const { trayService } = await import('../../services/tray')
  return trayService
}

interface WindowState {
  width: number
  height: number
  x: number | null
  y: number | null
  maximized: boolean
}

/**
 * 从本地存储获取弹窗设置
 * @returns 是否允许弹窗，默认为 true
 */
function getAllowPopupsSetting(): boolean {
  try {
    const userDataPath = app.getPath('userData')
    const storePath = join(userDataPath, 'pager-store.json')

    if (existsSync(storePath)) {
      const storeData = JSON.parse(readFileSync(storePath, 'utf-8'))
      return storeData.settings?.allowPopups ?? true
    }
  } catch (error) {
    console.error('读取弹窗设置失败:', error)
  }
  return true // 默认允许
}

/**
 * 处理新窗口请求的通用逻辑
 * @param details 新窗口详情
 * @param webContents 目标 webContents
 * @param windowType 窗口类型（主窗口或 WebView）
 * @returns 新窗口处理动作
 */
function handleNewWindow(
  details: Electron.HandlerDetails,
  webContents: Electron.WebContents,
  windowType: 'main' | 'webview'
): { action: 'allow' | 'deny' } {
  const allowPopups = getAllowPopupsSetting()

  if (allowPopups) {
    console.log(`${windowType} 允许弹窗，在应用内打开:`, details.url)
    return { action: 'allow' }
  } else {
    console.log(`${windowType} 禁止弹窗，在当前窗口导航:`, details.url)
    // 在当前窗口中导航到新页面
    webContents.loadURL(details.url)
    return { action: 'deny' }
  }
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
async function saveWindowState(window: BrowserWindow): Promise<void> {
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

    // 使用异步写入避免阻塞
    await fs.writeFile(filePath, JSON.stringify(state), 'utf-8')
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
    movable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    frame: true,
    transparent: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      // 启用网络相关功能
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      // 性能优化配置
      backgroundThrottling: false // 防止后台节流
    }
  })

  // 如果之前是最大化状态，恢复最大化
  if (savedState?.maximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 简化的防抖函数
  let saveTimeout: NodeJS.Timeout | null = null
  let resizeNotifyTimeout: NodeJS.Timeout | null = null

  const debouncedSaveWindowState = (window: BrowserWindow, delay: number = 500): void => {
    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }
    saveTimeout = setTimeout(async () => {
      await saveWindowState(window)
    }, delay)
  }

  const debouncedNotifyResize = (window: BrowserWindow, delay: number = 200): void => {
    if (resizeNotifyTimeout) {
      clearTimeout(resizeNotifyTimeout)
    }
    resizeNotifyTimeout = setTimeout(() => {
      window.webContents.send('window-resized')
    }, delay)
  }

  mainWindow.on('resize', () => {
    // 防抖通知渲染进程窗口大小变化
    debouncedNotifyResize(mainWindow)
    // 防抖保存窗口状态，延迟更长以减少频率
    debouncedSaveWindowState(mainWindow)
  })

  mainWindow.on('move', () => {
    // 移动事件不保存状态，避免拖动卡顿
    // 只在窗口关闭时保存最终位置
  })

  mainWindow.on('maximize', async () => {
    // 立即保存窗口状态（最大化变化不频繁）
    await saveWindowState(mainWindow)
  })

  mainWindow.on('unmaximize', async () => {
    // 立即保存窗口状态
    await saveWindowState(mainWindow)
  })

  // 最小化事件处理
  mainWindow.on('minimize', async () => {
    try {
      const storeService = await getStoreService()
      const settings = await storeService.getSettings()

      // 如果启用最小化到托盘，则隐藏到托盘而不是最小化到任务栏
      if (settings.minimizeToTray) {
        mainWindow.hide()

        // 如果托盘服务可用，确保托盘已创建
        const trayService = await getTrayService()
        if (!trayService.getWindowVisibility?.()) {
          // 托盘未创建时创建托盘
          trayService.createTray(mainWindow)
        }

        // Window minimized to tray
      }
    } catch (error) {
      console.error('Failed to handle minimize event:', error)
    }
  })

  // 关闭事件处理
  mainWindow.on('close', async (event: Electron.Event) => {
    try {
      // 保存最终窗口状态
      await saveWindowState(mainWindow)

      const storeService = await getStoreService()
      const settings = await storeService.getSettings()

      // 如果启用最小化到托盘，则隐藏到托盘而不是关闭应用
      if (settings.minimizeToTray) {
        event.preventDefault()
        mainWindow.hide()

        // 确保托盘已创建
        const trayService = await getTrayService()
        if (!trayService.getWindowVisibility?.()) {
          trayService.createTray(mainWindow)
        }

        // Window hidden to tray on close
      }
    } catch (error) {
      console.error('Failed to handle close event:', error)
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      return handleNewWindow(details, mainWindow.webContents, 'main')
    } catch (error) {
      console.error('Main window open handler error:', error)
      // 出错时保持原有行为：外部浏览器打开
      shell.openExternal(details.url)
      return { action: 'deny' }
    }
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
