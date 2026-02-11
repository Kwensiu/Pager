import { app, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { globalProxyService } from './services/proxyService'
import { windowManager } from './services/windowManager'
import { registerIpcHandlers } from './ipc/handlers'
import { createWindow } from './core/window/index'
import { versionChecker } from './services/versionChecker'
import { ExtensionManager } from './extensions/extensionManager'
import { sessionIsolationService } from './services/sessionIsolation'
import { extensionIsolationManager } from './services/extensionIsolation'
import { extensionPermissionManager } from './services/extensionPermissionManager'

let mainWindow: BrowserWindow | null = null

// 动态导入storeService以避免循环依赖
const getStoreService = async (): Promise<typeof import('./services/store').storeService> => {
  const { storeService } = await import('./services/store')
  return storeService
}

// 设置自定义用户数据路径，基于安装目录
if (process.platform === 'win32') {
  const exePath = app.getPath('exe')
  const appDir = join(exePath, '..')
  app.setPath('userData', join(appDir, 'UserData'))
}

app.whenReady().then(async () => {
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
  app.on('browser-window-created', (_, _window) => {
    // 使用渲染进程的键盘监听器处理所有快捷键
  })

  // 初始化代理服务
  await globalProxyService.initialize()

  // 创建窗口
  mainWindow = await createWindow()
  await registerIpcHandlers(mainWindow)

  // 初始化快捷键服务
  try {
    windowManager.setMainWindow(mainWindow)

    // 设置内存优化器的主窗口引用
    const { memoryOptimizerService } = await import('./services')
    memoryOptimizerService.setMainWindow(mainWindow)
  } catch (error) {
    console.error('初始化快捷键服务失败:', error)
  }

  // 初始化自动启动状态同步
  try {
    const storeService = await getStoreService()
    const settings = await storeService.getSettings()

    // 动态导入自动启动服务
    const { autoLaunchService } = await import('./services/autoLaunch')

    // 检查系统自动启动状态与应用设置是否一致
    const isActuallyEnabled = autoLaunchService.isEnabled()
    if (isActuallyEnabled !== settings.isAutoLaunch) {
      console.log('Syncing auto-launch setting on startup:', isActuallyEnabled)
      await storeService.updateSettings({ isAutoLaunch: isActuallyEnabled })
    }
  } catch (error) {
    console.error('Failed to sync auto-launch status on startup:', error)
  }

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
    const storeService = await getStoreService()
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

    // 初始化内存优化服务
    if (settings.memoryOptimizerEnabled) {
      try {
        const { memoryOptimizerService } = await import('./services')

        // 应用用户配置
        if (settings.memoryCleanInterval && settings.memoryCleanInterval >= 1) {
          memoryOptimizerService.setCleanupInterval(settings.memoryCleanInterval)
        }
        if (settings.maxInactiveTime && settings.maxInactiveTime >= 10) {
          memoryOptimizerService.setInactiveThreshold(settings.maxInactiveTime)
        }

        // 启动内存优化
        memoryOptimizerService.enable()
        console.log('Memory optimizer service started with config:', {
          cleanupInterval: settings.memoryCleanInterval || 5,
          inactiveThreshold: settings.maxInactiveTime || 10
        })
      } catch (error) {
        console.error('Failed to initialize memory optimizer:', error)
      }
    }
  } catch (error) {
    console.error('Failed to initialize auto update check or memory optimizer:', error)
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

  // 清理内存优化服务
  try {
    import('./services/memoryOptimizer').then(({ memoryOptimizerService }) => {
      memoryOptimizerService.stopCleanup()
    })
  } catch {
    // Silent fail
  }
})

// 应用退出时清理资源
app.on('before-quit', async () => {
  try {
    // 获取当前设置
    const storeService = await getStoreService()
    const settings = await storeService.getSettings()

    // 如果启用了保存会话，保存当前会话状态
    if (settings.saveSession) {
      // 会话数据已经通过 sessionManager 自动保存
      console.log('Session data saved on exit')
    }

    // 如果启用了退出时清除缓存，清除所有缓存
    if (settings.clearCacheOnExit) {
      try {
        const options = settings.clearCacheOptions || {}

        // 清除所有会话的缓存（根据配置）
        if (
          options.clearSessionCache !== false ||
          options.clearStorageData !== false ||
          options.clearAuthCache !== false
        ) {
          await sessionIsolationService.clearAllSessions(options)
        }

        // 清除默认会话缓存（根据配置）
        if (options.clearDefaultSession !== false) {
          const defaultSession = session.defaultSession
          if (options.clearSessionCache !== false) {
            await defaultSession.clearCache()
          }
          if (options.clearStorageData !== false) {
            await defaultSession.clearStorageData()
          }
        }

        console.log('Cache cleared on exit with options:', options)
      } catch (error) {
        console.error('Failed to clear cache on exit:', error)
      }
    }

    // 销毁扩展隔离管理器
    try {
      extensionIsolationManager.destroy()
    } catch (error) {
      console.error('Failed to destroy extension isolation manager:', error)
    }
  } catch (error) {
    console.error('Error during app shutdown:', error)
  }
})
