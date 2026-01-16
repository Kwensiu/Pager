import { ipcMain } from 'electron'
import fs from 'fs/promises'
import { fingerprintService } from '../services/fingerprint'
import { trayService } from '../services/tray'
import { windowAdsorptionService } from '../services/windowAdsorption'
import { memoryOptimizerService } from '../services/memoryOptimizer'
import { dataSyncService } from '../services/dataSync'
import { autoLaunchService } from '../services/autoLaunch'
import { jsInjectorService } from '../services/jsInjector'
import { websiteProxyService } from '../services/proxy'
import { themeService } from '../services/theme'
import { windowManager } from '../services/windowManager'
import { extensionEnhancer } from '../services/extensionEnhancer'
import { sessionIsolationService } from '../services/sessionIsolation'
import { crashHandler } from '../services/crashHandler'
import { sessionManager } from '../services/sessionManager'
import type { ExtensionInfo } from '../extensions/types'

/**
 * 注册增强功能的 IPC 处理器
 */
export function registerEnhancedIpcHandlers(mainWindow: Electron.BrowserWindow): void {
  // ===== 浏览器指纹伪装 =====
  ipcMain.handle('fingerprint:generate', async (_, options?: Record<string, unknown>) => {
    return fingerprintService.generateFingerprint(options)
  })

  ipcMain.handle('fingerprint:apply-to-website', async () => {
    // 这个方法需要传入 webContents，这里暂时返回空
    return { success: false, message: '需要 webContents 参数' }
  })

  ipcMain.handle('fingerprint:clear', async () => {
    // 这个方法不存在，暂时返回空
    return { success: false, message: '方法未实现' }
  })

  ipcMain.handle('fingerprint:refresh', async (_, options?: Record<string, unknown>) => {
    fingerprintService.refreshFingerprint(options)
    return { success: true }
  })

  ipcMain.handle('fingerprint:clear-cache', async () => {
    fingerprintService.clearAllCache()
    return { success: true }
  })

  ipcMain.handle('fingerprint:get-cache-stats', async () => {
    return fingerprintService.getCacheStats()
  })

  // ===== 全局快捷键 =====
  ipcMain.handle('shortcut:register', async () => {
    // 这个方法需要实现，暂时返回空
    return { success: false, message: '方法未实现' }
  })

  ipcMain.handle('shortcut:unregister', async () => {
    return { success: false, message: '方法未实现' }
  })

  ipcMain.handle('shortcut:get-all', async () => {
    return []
  })

  ipcMain.handle('shortcut:enable-all', async () => {
    return { success: false, message: '方法未实现' }
  })

  ipcMain.handle('shortcut:disable-all', async () => {
    return { success: false, message: '方法未实现' }
  })

  // ===== 系统托盘 =====
  ipcMain.handle('tray:create', async () => {
    trayService.createTray(mainWindow)
  })

  ipcMain.handle('tray:destroy', async () => {
    return trayService.destroyTray()
  })

  ipcMain.handle('tray:set-tooltip', async (_, tooltip: string) => {
    return trayService.setToolTip(tooltip)
  })

  ipcMain.handle('tray:set-context-menu', async () => {
    // 这个方法不存在，暂时返回空
    return { success: false, message: '方法未实现' }
  })

  // ===== 窗口边缘吸附 =====
  ipcMain.handle('window-adsorption:enable', async () => {
    return windowAdsorptionService.enable()
  })

  ipcMain.handle('window-adsorption:disable', async () => {
    return windowAdsorptionService.disable()
  })

  ipcMain.handle('window-adsorption:is-enabled', async () => {
    return windowAdsorptionService.isEnabled()
  })

  ipcMain.handle('window-adsorption:set-sensitivity', async () => {
    // 这个方法不存在，暂时返回空
    return { success: false, message: '方法未实现' }
  })

  // ===== 内存优化 =====
  ipcMain.handle('memory-optimizer:start', async () => {
    return memoryOptimizerService.startCleanup()
  })

  ipcMain.handle('memory-optimizer:stop', async () => {
    return memoryOptimizerService.stopCleanup()
  })

  ipcMain.handle('memory-optimizer:clean-inactive', async () => {
    return memoryOptimizerService.forceCleanup()
  })

  ipcMain.handle('memory-optimizer:get-stats', async () => {
    return memoryOptimizerService.getMemoryStats()
  })

  // ===== 数据同步 =====
  ipcMain.handle('data-sync:export-config', async (_, data?: Record<string, unknown>) => {
    return dataSyncService.exportConfig(data || {})
  })

  ipcMain.handle('data-sync:export-data', async (_, data?: Record<string, unknown>) => {
    return dataSyncService.exportDataToString(data || {})
  })

  ipcMain.handle('data-sync:import-config', async () => {
    return dataSyncService.importConfig()
  })

  ipcMain.handle('fs:read-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('data-sync:export-cookies', async (_, websiteId: string, partition: string) => {
    return dataSyncService.exportCookies(websiteId, partition)
  })

  ipcMain.handle(
    'data-sync:import-cookies',
    async (_, websiteId: string, partition: string, cookies: Record<string, unknown>[]) => {
      return dataSyncService.importCookies(websiteId, partition, cookies)
    }
  )

  // ===== 自动启动 =====
  ipcMain.handle('auto-launch:enable', async (_, args?: string[]) => {
    return autoLaunchService.enable(args)
  })

  ipcMain.handle('auto-launch:disable', async () => {
    return autoLaunchService.disable()
  })

  ipcMain.handle('auto-launch:is-enabled', async () => {
    return autoLaunchService.isEnabled()
  })

  ipcMain.handle('auto-launch:toggle', async () => {
    return autoLaunchService.toggle()
  })

  ipcMain.handle('auto-launch:get-settings', async () => {
    return autoLaunchService.getSettings()
  })

  ipcMain.handle('auto-launch:set-hidden', async (_, hidden: boolean) => {
    return autoLaunchService.setLaunchHidden(hidden)
  })

  ipcMain.handle('auto-launch:set-args', async (_, args: string[]) => {
    return autoLaunchService.setLaunchArgs(args)
  })

  ipcMain.handle('auto-launch:was-launched-at-login', async () => {
    return autoLaunchService.wasLaunchedAtLogin()
  })

  ipcMain.handle('auto-launch:was-launched-as-hidden', async () => {
    return autoLaunchService.wasLaunchedAsHidden()
  })

  ipcMain.handle('auto-launch:get-supported-settings', async () => {
    return autoLaunchService.getSupportedSettings()
  })

  ipcMain.handle('auto-launch:validate-args', async (_, args: string[]) => {
    return autoLaunchService.validateLaunchArgs(args)
  })

  ipcMain.handle('auto-launch:get-default-args', async () => {
    return autoLaunchService.getDefaultLaunchArgs()
  })

  ipcMain.handle('auto-launch:get-status-report', async () => {
    return autoLaunchService.getStatusReport()
  })

  ipcMain.handle('auto-launch:get-environment-info', async () => {
    return autoLaunchService.getEnvironmentInfo()
  })

  // ===== JS 代码注入 =====
  ipcMain.handle('js-injector:inject', async () => {
    // 这个方法需要 webContents 参数，暂时返回空
    return { success: false, message: '需要 webContents 参数' }
  })

  ipcMain.handle('js-injector:remove', async (_, websiteId: string) => {
    return jsInjectorService.removeInjectedCode(websiteId)
  })

  ipcMain.handle('js-injector:get-all', async (_, websiteId: string) => {
    return jsInjectorService.getWebsiteJsCode(websiteId) || []
  })

  // ===== 代理支持 =====
  ipcMain.handle(
    'proxy:set-for-website',
    async (
      _: Electron.IpcMainInvokeEvent,
      _websiteId: string,
      partition: string,
      proxyRules: string
    ) => {
      return websiteProxyService.setProxyForPartition(partition, proxyRules)
    }
  )

  ipcMain.handle(
    'proxy:clear-for-website',
    async (_: Electron.IpcMainInvokeEvent, _websiteId: string, partition: string) => {
      return websiteProxyService.clearProxyForPartition(partition)
    }
  )

  ipcMain.handle('proxy:test-connection', async (_, proxyRules: string) => {
    return websiteProxyService.testProxyConnection(proxyRules)
  })

  // ===== 系统主题切换 =====
  ipcMain.handle('theme:set', async (_, theme: 'light' | 'dark') => {
    console.log('[IPC] theme:set called with:', theme)
    themeService.setTheme(theme)
    return undefined
  })

  ipcMain.handle('theme:get-current', async () => {
    const current = themeService.getCurrentTheme()
    console.log('[IPC] theme:get-current returning:', current)
    return current
  })

  ipcMain.handle('theme:toggle', async () => {
    console.log('[IPC] theme:toggle called')
    const result = themeService.toggleTheme()
    console.log('[IPC] theme:toggle result:', result)
    return result
  })

  // ===== 窗口管理 =====
  ipcMain.handle('window-manager:toggle-always-on-top', async () => {
    return windowManager.toggleAlwaysOnTop()
  })

  ipcMain.handle('window-manager:toggle-mini-mode', async () => {
    return windowManager.toggleMiniMode()
  })

  ipcMain.handle(
    'window-manager:snap-to-edge',
    async (_, edge: 'left' | 'right' | 'top' | 'bottom') => {
      return windowManager.snapToEdge(edge)
    }
  )

  ipcMain.handle('window-manager:get-state', async () => {
    return windowManager.getWindowState()
  })

  // ===== 扩展增强 =====
  ipcMain.handle('extension-enhancer:register', async (_, extension: ExtensionInfo) => {
    return extensionEnhancer.registerExtension(extension)
  })

  ipcMain.handle('extension-enhancer:enable', async (_, extensionId: string) => {
    return extensionEnhancer.enableExtension(extensionId)
  })

  ipcMain.handle('extension-enhancer:disable', async (_, extensionId: string) => {
    return extensionEnhancer.disableExtension(extensionId)
  })

  ipcMain.handle('extension-enhancer:get-stats', async () => {
    return extensionEnhancer.getExtensionStats()
  })

  // ===== 版本检查 =====
  ipcMain.handle('version-checker:check-update', async (_, force?: boolean) => {
    const { versionChecker } = await import('../services/versionChecker')
    return versionChecker.checkForAppUpdate(force)
  })

  ipcMain.handle('version-checker:download-update', async () => {
    const { versionChecker } = await import('../services/versionChecker')
    return versionChecker.downloadUpdate()
  })

  ipcMain.handle('version-checker:install-update', async () => {
    const { versionChecker } = await import('../services/versionChecker')
    return versionChecker.installUpdate()
  })

  ipcMain.handle('version-checker:get-version-info', async () => {
    const { versionChecker } = await import('../services/versionChecker')
    return versionChecker.getVersionInfo()
  })

  // ===== Session 隔离 =====
  ipcMain.handle('session-isolation:create', async (_, websiteId: string) => {
    return sessionIsolationService.createIsolatedSession({ id: websiteId, name: '', url: '' })
  })

  ipcMain.handle('session-isolation:clear', async (_, websiteId: string) => {
    return sessionIsolationService.clearWebsiteSession(websiteId)
  })

  ipcMain.handle('session-isolation:export-cookies', async (_, websiteId: string) => {
    return sessionIsolationService.exportWebsiteCookies(websiteId)
  })

  ipcMain.handle(
    'session-isolation:import-cookies',
    async (_, websiteId: string, cookies: Electron.Cookie[]) => {
      return sessionIsolationService.importWebsiteCookies(websiteId, cookies)
    }
  )

  // ===== 进程崩溃处理 =====
  ipcMain.handle('crash-handler:get-stats', async () => {
    return crashHandler.getCrashStats()
  })

  ipcMain.handle('crash-handler:clear-reports', async () => {
    return crashHandler.clearCrashReports()
  })

  ipcMain.handle('crash-handler:send-report', async (_, reportId: string) => {
    return crashHandler.sendCrashReport(reportId)
  })

  // ===== 会话管理 =====
  ipcMain.handle('session:add-update', async (_, websiteId: string, url: string, title: string) => {
    return sessionManager.addOrUpdateSession(websiteId, url, title)
  })

  ipcMain.handle('session:remove', async (_, websiteId: string) => {
    return sessionManager.removeSession(websiteId)
  })

  ipcMain.handle('session:get-all', async () => {
    return sessionManager.getAllSessions()
  })

  ipcMain.handle('session:get', async (_, websiteId: string) => {
    return sessionManager.getSession(websiteId)
  })

  ipcMain.handle('session:clear-all', async () => {
    return sessionManager.clearAllSessions()
  })

  ipcMain.handle('session:get-stats', async () => {
    return sessionManager.getSessionStats()
  })

  // ===== 通用功能 =====
  ipcMain.handle('services:get-stats', async () => {
    const { versionChecker } = await import('../services/versionChecker')
    return {
      theme: themeService.getCurrentTheme(),
      windowManager: windowManager.getWindowState(),
      extensionEnhancer: extensionEnhancer.getExtensionStats(),
      versionChecker: versionChecker.getUpdateStats(),
      sessionIsolation: (await sessionIsolationService.getAllIsolatedWebsites()).length > 0,
      sessionManager: sessionManager.getSessionStats()
    }
  })

  ipcMain.handle('enhanced:enable-all', async () => {
    return {
      windowAdsorption: windowAdsorptionService.enable(),
      memoryOptimizer: memoryOptimizerService.startCleanup(),
      autoLaunch: autoLaunchService.enable()
    }
  })

  ipcMain.handle('enhanced:disable-all', async () => {
    return {
      windowAdsorption: windowAdsorptionService.disable(),
      memoryOptimizer: memoryOptimizerService.stopCleanup(),
      autoLaunch: autoLaunchService.disable()
    }
  })

  console.log('Enhanced IPC handlers registered')
}
