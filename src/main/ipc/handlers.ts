import { ipcMain } from 'electron'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../types/store'
import { registerEnhancedIpcHandlers } from './enhancedHandlers'
import { extensionEnhancedHandlers } from './extensionEnhancedHandlers'
import { ExtensionManager } from '../extensions/extensionManager'
import { ExtensionIsolationLevel } from '../../shared/types/store'

const extensionManager = ExtensionManager.getInstance()

export async function registerIpcHandlers(mainWindow: Electron.BrowserWindow): Promise<void> {
  const { storeService } = await import('../services')

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 注册增强功能的 IPC 处理器
  registerEnhancedIpcHandlers(mainWindow)

  // 创建并注册扩展增强处理器（实例化时会自动注册IPC处理器）
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  extensionEnhancedHandlers

  // ===== 扩展管理相关 IPC 处理器 =====

  // 获取所有扩展
  ipcMain.handle('extension:getAll', async () => {
    try {
      const extensions = extensionManager.getAllExtensions()
      return {
        success: true,
        extensions: extensions.map((ext) => ({
          id: ext.id,
          name: ext.name,
          version: ext.version,
          path: ext.path,
          enabled: ext.enabled,
          manifest: ext.manifest
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 添加扩展
  ipcMain.handle('extension:add', async (_, extensionPath: string) => {
    try {
      const result = await extensionManager.addExtension(extensionPath)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 移除扩展
  ipcMain.handle('extension:remove', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.removeExtension(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 切换扩展状态
  ipcMain.handle('extension:toggle', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.toggleExtension(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 验证扩展
  ipcMain.handle('extension:validate', async (_, extensionPath: string) => {
    try {
      const result = await extensionManager.validateExtension(extensionPath)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { valid: false, error: errorMessage }
    }
  })

  // 获取已加载的扩展
  ipcMain.handle('extension:getLoaded', async () => {
    try {
      const loadedExtensions = extensionManager.getLoadedExtensions()
      return {
        success: true,
        extensions: loadedExtensions
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取扩展设置
  ipcMain.handle('extension:getSettings', async () => {
    try {
      const settings = extensionManager.getSettings()
      return {
        success: true,
        settings
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新扩展设置
  ipcMain.handle(
    'extension:updateSettings',
    async (_, settings: { enableExtensions?: boolean; autoLoadExtensions?: boolean }) => {
      try {
        extensionManager.updateSettings(settings)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 使用隔离加载扩展
  ipcMain.handle(
    'extension:loadWithIsolation',
    async (_, extensionPath: string, isolationLevel?: string) => {
      try {
        const result = await extensionManager.loadExtensionWithIsolation(
          extensionPath,
          isolationLevel as ExtensionIsolationLevel | undefined
        )
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 使用隔离卸载扩展
  ipcMain.handle('extension:unloadWithIsolation', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.unloadExtensionWithIsolation(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取扩展及其权限信息
  ipcMain.handle('extension:getWithPermissions', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.getExtensionWithPermissions(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新权限设置
  ipcMain.handle(
    'extension:updatePermissionSettings',
    async (_, extensionId: string, permissions: string[], allowed: boolean) => {
      try {
        const result = await extensionManager.updatePermissionSettings(
          extensionId,
          permissions,
          allowed
        )
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 获取错误统计
  ipcMain.handle('extension:getErrorStats', async () => {
    try {
      const result = await extensionManager.getErrorStats()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取权限统计
  ipcMain.handle('extension:getPermissionStats', async () => {
    try {
      const result = await extensionManager.getPermissionStats()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 清除错误历史
  ipcMain.handle('extension:clearErrorHistory', async () => {
    try {
      const result = await extensionManager.clearErrorHistory()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 窗口管理相关 IPC
  ipcMain.on('window:open-dev-tools', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools()
    }
  })

  // 对话框相关 IPC
  ipcMain.handle('dialog:open-directory', async (_, options?: Electron.OpenDialogOptions) => {
    const { dialog } = await import('electron')
    return dialog.showOpenDialog(mainWindow!, {
      ...options,
      properties: ['openDirectory']
    })
  })

  ipcMain.handle('dialog:open-file', async (_, options?: Electron.OpenDialogOptions) => {
    const { dialog } = await import('electron')
    return dialog.showOpenDialog(mainWindow!, {
      ...options,
      properties: ['openFile']
    })
  })

  // ===== Store 相关 IPC 处理器 =====

  // 获取所有主要分组
  ipcMain.handle('store:get-primary-groups', () => {
    return storeService.getPrimaryGroups()
  })

  // 保存所有主要分组
  ipcMain.handle('store:set-primary-groups', (_, groups: PrimaryGroup[]) => {
    return storeService.setPrimaryGroups(groups)
  })

  // 清除所有主要分组
  ipcMain.handle('store:clear-primary-groups', () => {
    return storeService.clearPrimaryGroups()
  })

  // 添加主要分组
  ipcMain.handle('store:add-primary-group', (_, group: Partial<PrimaryGroup>) => {
    return storeService.addPrimaryGroup(group)
  })

  // 更新主要分组
  ipcMain.handle(
    'store:update-primary-group',
    (_, groupId: string, updates: Partial<PrimaryGroup>) => {
      return storeService.updatePrimaryGroup(groupId, updates)
    }
  )

  // 删除主要分组
  ipcMain.handle('store:delete-primary-group', (_, groupId: string) => {
    return storeService.deletePrimaryGroup(groupId)
  })

  // 添加次要分组
  ipcMain.handle(
    'store:add-secondary-group',
    (_, primaryGroupId: string, secondaryGroup: SecondaryGroup) => {
      return storeService.addSecondaryGroup(primaryGroupId, secondaryGroup)
    }
  )

  // 更新次要分组
  ipcMain.handle(
    'store:update-secondary-group',
    (_, secondaryGroupId: string, updates: Partial<SecondaryGroup>) => {
      return storeService.updateSecondaryGroup(secondaryGroupId, updates)
    }
  )

  // 删除次要分组
  ipcMain.handle('store:delete-secondary-group', (_, secondaryGroupId: string) => {
    return storeService.deleteSecondaryGroup(secondaryGroupId)
  })

  // 在主要分组中添加网站
  ipcMain.handle('store:add-website-to-primary', (_, primaryGroupId: string, website: Website) => {
    return storeService.addWebsiteToPrimaryGroup(primaryGroupId, website)
  })

  // 在次要分组中添加网站
  ipcMain.handle(
    'store:add-website-to-secondary',
    (_, secondaryGroupId: string, website: Website) => {
      return storeService.addWebsiteToSecondaryGroup(secondaryGroupId, website)
    }
  )

  // 更新网站
  ipcMain.handle('store:update-website', (_, websiteId: string, updates: Partial<Website>) => {
    return storeService.updateWebsite(websiteId, updates)
  })

  // 删除网站
  ipcMain.handle('store:delete-website', (_, websiteId: string) => {
    return storeService.deleteWebsite(websiteId)
  })

  // 更新二级分组排序
  ipcMain.handle(
    'store:update-secondary-group-order',
    (_, primaryGroupId: string, secondaryGroupIds: string[]) => {
      return storeService.updateSecondaryGroupOrder(primaryGroupId, secondaryGroupIds)
    }
  )

  // 更新网站排序
  ipcMain.handle(
    'store:update-website-order',
    (_, secondaryGroupId: string, websiteIds: string[]) => {
      return storeService.updateWebsiteOrder(secondaryGroupId, websiteIds)
    }
  )

  // 批量更新网站排序
  ipcMain.handle('store:batch-update-website-orders', (_, updates: WebsiteOrderUpdate[]) => {
    return storeService.batchUpdateWebsiteOrders(updates)
  })

  // 获取窗口状态
  ipcMain.handle('store:get-window-state', () => {
    return storeService.getWindowState()
  })

  // 设置窗口状态
  ipcMain.handle('store:set-window-state', (_, state: Partial<WindowState>) => {
    return storeService.setWindowState(state)
  })

  // 获取设置
  ipcMain.handle('store:get-settings', () => {
    return storeService.getSettings()
  })

  // 更新设置
  ipcMain.handle('store:update-settings', (_, updates: Partial<Settings>) => {
    return storeService.updateSettings(updates)
  })

  // 重置为默认值
  ipcMain.handle('store:reset-to-defaults', (_, defaultGroups: PrimaryGroup[]) => {
    return storeService.resetToDefaults(defaultGroups)
  })

  // 获取数据路径
  ipcMain.handle('store:get-data-path', () => {
    try {
      const { app } = require('electron')
      const path = app.getPath('userData')
      return { success: true, path }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // ===== Favicon 相关 IPC 处理器 =====

  // 获取网站 favicon 的 IPC 处理器
  ipcMain.handle('get-favicon', async (_, url: string) => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return await faviconService.getFavicon(url)
    } catch (error) {
      console.error('Error getting favicon:', error)
      return null
    }
  })

  // 批量预加载 favicon 的 IPC 处理器
  ipcMain.handle('preload-favicons', async (_, urls: string[], priority?: string[]) => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return await faviconService.preloadFavicons({ urls, priority })
    } catch (error) {
      console.error('Error preloading favicons:', error)
      return []
    }
  })

  // 获取 favicon 缓存统计信息的 IPC 处理器
  ipcMain.handle('get-favicon-stats', async () => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return faviconService.getCacheStats()
    } catch (error) {
      console.error('Error getting favicon stats:', error)
      return { totalEntries: 0, hitRate: 0, memoryUsage: 0 }
    }
  })

  // 清理 favicon 缓存的 IPC 处理器
  ipcMain.handle('clear-favicon-cache', async () => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      faviconService.clearCache()
      return { success: true }
    } catch (error) {
      console.error('Error clearing favicon cache:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
