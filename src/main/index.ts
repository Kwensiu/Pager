import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import {
  createWindow,
  registerCertificateErrorHandler,
  registerRenderProcessGoneHandler
} from './core/window'
import { registerIpcHandlers } from './ipc'
import { ExtensionManager } from './extensions/extensionManager'
import { extensionIsolationManager } from './services/extensionIsolation'
import { extensionPermissionManager } from './services/extensionPermissionManager'
import { sessionIsolationService } from './services/sessionIsolation'
import { globalProxyService } from './services/proxyService'

let mainWindow: BrowserWindow | null = null

// 设置自定义用户数据路径，避免重名冲突
if (process.platform === 'win32') {
  app.setPath('userData', join(app.getPath('appData'), 'com.pager.ks'))
}

app.whenReady().then(async () => {
  // 动态导入服务以避免循环依赖
  const { storeService } = await import('./services/store')
  const { versionChecker } = await import('./services/versionChecker')

  // 注册全局错误处理器
  registerCertificateErrorHandler()
  registerRenderProcessGoneHandler()

  // ===== 命令行安全配置 =====
  // 禁用软件光栅化器
  app.commandLine.appendSwitch('disable-software-rasterizer')
  // 忽略证书错误
  app.commandLine.appendSwitch('ignore-certificate-errors')
  // 允许运行不安全内容
  app.commandLine.appendSwitch('allow-running-insecure-content')
  // 禁用 WebRTC 隐藏本地 IP
  app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns')
  // 强制 WebRTC IP 处理策略
  app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'disable_non_proxied_udp')
  // 设置语言
  app.commandLine.appendSwitch('lang', 'zh-CN')
  // 禁用自动化控制特征
  app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled')
  // 禁用站点隔离
  app.commandLine.appendSwitch('disable-features', 'IsolateOrigins,site-per-process')
  // 设置 App User Model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.pager.ks')
  }

  // 监听窗口创建事件，设置快捷键优化
  app.on('browser-window-created', (_, window) => {
    // 为新窗口设置快捷键优化
    // 这里简化处理，实际可以添加更多优化
    window.webContents.on('before-input-event', () => {
      // 可以在这里添加快捷键处理逻辑
    })
  })

  // 初始化代理服务
  await globalProxyService.initialize()

  // 创建窗口
  mainWindow = await createWindow()
  await registerIpcHandlers(mainWindow)

  // 初始化扩展管理器并加载所有已启用的扩展
  const extensionManager = ExtensionManager.getInstance()
  extensionManager.initialize(app.getPath('userData'))

  // 初始化扩展服务
  extensionIsolationManager.initializeSessionPool()
  extensionPermissionManager.loadUserSettings()

  extensionManager.loadAllExtensions().catch((error) => {
    console.error('Failed to load extensions:', error)
  })

  // 初始化自动检查更新
  try {
    const settings = await storeService.getSettings()

    if (settings.autoCheckUpdates) {
      console.log('Auto-check for updates enabled, checking...')
      // 延迟5秒后检查更新，避免影响应用启动速度
      setTimeout(async () => {
        try {
          const updateInfo = await versionChecker.checkForAppUpdate(false)
          if (updateInfo.available) {
            console.log(`Update available: ${updateInfo.latestVersion}`)
            // 这里可以显示通知
          }
        } catch (error) {
          console.error('Failed to check for updates:', error)
        }
      }, 5000)
    }
  } catch (error) {
    console.error('Failed to initialize auto update check:', error)
  }

  app.on('activate', async function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = await createWindow()
    }
    mainWindow?.show()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 应用退出时清理资源
app.on('will-quit', () => {
  globalProxyService.destroy()
})

// 应用退出时清理资源
app.on('before-quit', async () => {
  try {
    // 动态导入storeService以避免循环依赖
    const { storeService } = await import('./services/store')

    // 获取当前设置
    const settings = await storeService.getSettings()

    // 如果启用了保存会话，保存当前会话状态
    if (settings.saveSession) {
      // 会话数据已经通过 sessionManager 自动保存
      console.log('Session data saved on exit')
    }

    // 如果启用了退出时清除缓存，清除所有缓存
    if (settings.clearCacheOnExit) {
      try {
        // 清除所有会话的缓存
        await sessionIsolationService.clearAllSessions()

        // 清除默认会话缓存
        const defaultSession = session.defaultSession
        await defaultSession.clearCache()
        await defaultSession.clearStorageData()

        console.log('Cache cleared on exit')
      } catch (error) {
        console.error('Failed to clear cache on exit:', error)
      }
    }

    // 销毁扩展隔离管理器
    extensionIsolationManager.destroy()
  } catch (error) {
    console.error('Error during app shutdown:', error)
  }
})
