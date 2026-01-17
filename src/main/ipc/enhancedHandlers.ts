import { ipcMain, Notification, clipboard, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import { fingerprintService } from '../services/fingerprint'
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
import { shortcutService } from '../services/shortcut'
import { versionChecker } from '../services/versionChecker'
import type { ExtensionInfo } from '../extensions/types'
import type { Shortcut } from '../../shared/types/store'

// 动态导入storeService以避免循环依赖
const getStoreService = async (): Promise<typeof import('../services/store').storeService> => {
  const { storeService } = await import('../services/store')
  return storeService
}

/**
 * 创建快捷键回调函数
 * @param shortcutId 快捷键ID
 * @param mainWindow 主窗口实例
 */
export function createShortcutCallback(
  shortcutId: string,
  mainWindow: Electron.BrowserWindow
): () => void {
  return () => {
    try {
      switch (shortcutId) {
        case 'toggle-window':
          // 隐藏/显示软件窗口
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
          break

        case 'toggle-sidebar':
          // 隐藏/显示侧边导航 - 通过IPC通知渲染进程
          mainWindow.webContents.send('shortcut:toggle-sidebar')
          break

        case 'open-settings':
          // 打开设置 - 通过IPC通知渲染进程
          mainWindow.webContents.send('shortcut:open-settings')
          break

        case 'switch-website':
          // 切换站点 - 通过IPC通知渲染进程
          mainWindow.webContents.send('shortcut:switch-website')
          break

        case 'toggle-always-on-top':
          // 取消/设置窗口置顶
          windowManager.toggleAlwaysOnTop()
          break

        case 'refresh-page':
          // 刷新当前页面 - 通过IPC通知渲染进程
          console.log('主进程收到刷新快捷键请求')
          mainWindow.webContents.send('shortcut:refresh-page')
          break

        case 'copy-url':
          // 获取当前页URL - 通过IPC通知渲染进程
          mainWindow.webContents.send('shortcut:copy-url')
          break

        case 'minimize-window':
          // 最小化窗口
          windowManager.minimizeWindow()
          break

        case 'maximize-window':
          // 最大化窗口
          windowManager.maximizeWindow()
          break

        case 'left-mini-window':
          // 屏幕左边小窗功能已移除
          break

        case 'right-mini-window':
          // 屏幕右边小窗功能已移除
          break

        case 'exit-app':
          // 退出软件
          mainWindow.close()
          break

        default:
          console.warn(`未知的快捷键ID: ${shortcutId}`)
      }
    } catch (error) {
      console.error(`执行快捷键 ${shortcutId} 时出错:`, error)
    }
  }
}

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
  ipcMain.handle('shortcut:register', async (_, shortcut: Shortcut) => {
    try {
      // 注册新的快捷键
      const callback = createShortcutCallback(shortcut.id, mainWindow)
      const success = shortcutService.register(shortcut, callback)

      if (success) {
        // 保存到持久化存储
        const storeService = await getStoreService()
        await storeService.updateShortcut(shortcut)
      }

      return { success, message: success ? '快捷键注册成功' : '快捷键注册失败' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:unregister', async (_, cmd: string) => {
    try {
      const success = shortcutService.unregister(cmd)

      if (success) {
        // 从持久化存储中删除
        const storeService = await getStoreService()
        const shortcuts = await storeService.getShortcuts()
        const shortcutToRemove = shortcuts.find((s) => s.cmd === cmd)
        if (shortcutToRemove) {
          await storeService.removeShortcut(shortcutToRemove.id)
        }
      }

      return { success, message: success ? '快捷键注销成功' : '快捷键注销失败' }
    } catch (error) {
      console.error('注销快捷键失败:', error)
      return { success: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:get-all', async () => {
    try {
      // 直接返回用户保存的快捷键配置
      const storeService = await getStoreService()
      const storedShortcuts = await storeService.getShortcuts()

      // 如果没有保存过配置，则返回默认配置
      if (storedShortcuts.length === 0) {
        return shortcutService.getDefaultShortcuts()
      }

      return storedShortcuts
    } catch (error) {
      console.error('获取快捷键列表失败:', error)
      return []
    }
  })

  ipcMain.handle('shortcut:enable-all', async () => {
    try {
      const defaults = shortcutService.getDefaultShortcuts()
      let successCount = 0

      for (const shortcut of defaults) {
        const callback = createShortcutCallback(shortcut.id, mainWindow)
        if (shortcutService.register(shortcut, callback)) {
          successCount++
        }
      }

      return {
        success: successCount > 0,
        message: `成功注册 ${successCount}/${defaults.length} 个快捷键`,
        successCount,
        totalCount: defaults.length
      }
    } catch (error) {
      console.error('启用所有快捷键失败:', error)
      return { success: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:disable-all', async () => {
    try {
      shortcutService.unregisterAll()
      return { success: true, message: '所有快捷键已注销' }
    } catch (error) {
      console.error('禁用所有快捷键失败:', error)
      return { success: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:update', async (_, shortcut: Shortcut) => {
    try {
      // 使用新的更新逻辑
      const success = shortcutService.update(shortcut)

      if (success) {
        // 保存到持久化存储
        const storeService = await getStoreService()
        await storeService.updateShortcut(shortcut)
        return { success: true, message: '快捷键更新成功' }
      } else {
        return { success: false, message: '快捷键更新失败' }
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:validate', async (_, cmd: string) => {
    try {
      const isValid = shortcutService.validateCommand(cmd)
      return { valid: isValid, message: isValid ? '快捷键格式正确' : '快捷键格式不正确' }
    } catch (error) {
      console.error('验证快捷键失败:', error)
      return { valid: false, message: error instanceof Error ? error.message : '未知错误' }
    }
  })

  ipcMain.handle('shortcut:get-defaults', async () => {
    try {
      return shortcutService.getDefaultShortcuts()
    } catch (error) {
      console.error('获取默认快捷键失败:', error)
      return []
    }
  })

  ipcMain.handle('shortcut:check-conflict', async (_, cmd: string, excludeId?: string) => {
    try {
      const conflict = shortcutService.checkConflict(cmd, excludeId)
      return {
        hasConflict: !!conflict,
        conflict: conflict || null
      }
    } catch (error) {
      console.error('检查快捷键冲突失败:', error)
      return { hasConflict: false, conflict: null }
    }
  })

  ipcMain.handle('shortcut:get-all-conflicts', async (_, shortcuts: Shortcut[]) => {
    try {
      const conflicts = shortcutService.getAllConflicts(shortcuts)
      return {
        hasConflicts: conflicts.length > 0,
        conflicts
      }
    } catch (error) {
      console.error('获取所有快捷键冲突失败:', error)
      return { hasConflicts: false, conflicts: [] }
    }
  })

  // ===== 系统托盘 =====
  ipcMain.handle('tray:create', async () => {
    const { trayService } = await import('../services/tray')
    trayService.createTray(mainWindow)
  })

  ipcMain.handle('tray:destroy', async () => {
    const { trayService } = await import('../services/tray')
    return trayService.destroyTray()
  })

  ipcMain.handle('tray:set-tooltip', async (_, tooltip: string) => {
    const { trayService } = await import('../services/tray')
    return trayService.setToolTip(tooltip)
  })

  ipcMain.handle('tray:set-context-menu', async () => {
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

  ipcMain.handle('window-manager:get-always-on-top-state', async () => {
    return windowManager.getAlwaysOnTopState()
  })

  ipcMain.handle('window-manager:toggle-mini-mode', async () => {
    return windowManager.toggleMiniMode()
  })

  ipcMain.handle('window-manager:toggle-window', async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })

  ipcMain.handle('window-manager:get-state', async () => {
    return windowManager.getWindowState()
  })

  ipcMain.handle('window-manager:minimize-window', async () => {
    windowManager.minimizeWindow()
  })

  ipcMain.handle('window-manager:maximize-window', async () => {
    windowManager.maximizeWindow()
  })

  ipcMain.handle('window-manager:exit-app', async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (mainWindow) {
      mainWindow.close()
    }
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
    return versionChecker.checkForAppUpdate(force)
  })

  ipcMain.handle('version-checker:download-update', async () => {
    return versionChecker.downloadUpdate()
  })

  ipcMain.handle('version-checker:install-update', async () => {
    return versionChecker.installUpdate()
  })

  ipcMain.handle('version-checker:get-version-info', async () => {
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

  // ===== 进程崩溃处理 =====
  ipcMain.handle('crash:simulate', async () => {
    try {
      const result = await crashHandler.simulateCrash()
      return result
    } catch (error) {
      console.error('模拟崩溃失败:', error)
      throw error
    }
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
      memoryOptimizer: memoryOptimizerService.startCleanup(),
      autoLaunch: autoLaunchService.enable()
    }
  })

  ipcMain.handle('enhanced:disable-all', async () => {
    return {
      memoryOptimizer: memoryOptimizerService.stopCleanup(),
      autoLaunch: autoLaunchService.disable()
    }
  })

  // 通知处理器
  ipcMain.handle(
    'window-manager:show-notification',
    async (_, { title, body }: { title: string; body: string }) => {
      const mainWindow = windowManager.getMainWindow()
      if (mainWindow) {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title,
            body,
            silent: true
          })
          notification.show()
          return true
        }
      }
      return false
    }
  )

  // 复制到剪贴板处理器
  ipcMain.handle('window-manager:copy-to-clipboard', async (_, text: string) => {
    try {
      clipboard.writeText(text)
      return true
    } catch (error) {
      console.error('复制到剪贴板失败:', error)
      throw error
    }
  })

  console.log('Enhanced IPC handlers registered')
}
