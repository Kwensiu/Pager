import { ipcMain, BrowserWindow } from 'electron'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../types/store'
import { getStoreService } from './handlers'

/**
 * 注册 Store 相关的 IPC 处理器
 */
export function registerStoreHandlers(_mainWindow: BrowserWindow): void {
  // 主要分组相关
  ipcMain.handle('store:get-primary-groups', async () => {
    const storeService = await getStoreService()
    return storeService.getPrimaryGroups()
  })

  ipcMain.handle('store:set-primary-groups', async (_, groups: PrimaryGroup[]) => {
    const storeService = await getStoreService()
    await storeService.setPrimaryGroups(groups)
  })

  ipcMain.handle('store:clear-primary-groups', async () => {
    const storeService = await getStoreService()
    await storeService.clearPrimaryGroups()
  })

  ipcMain.handle('store:add-primary-group', async (_, group: Partial<PrimaryGroup>) => {
    const storeService = await getStoreService()
    return storeService.addPrimaryGroup(group)
  })

  ipcMain.handle('store:update-primary-group', async (_, groupId: string, updates: Partial<PrimaryGroup>) => {
    const storeService = await getStoreService()
    return storeService.updatePrimaryGroup(groupId, updates)
  })

  ipcMain.handle('store:delete-primary-group', async (_, groupId: string) => {
    const storeService = await getStoreService()
    await storeService.deletePrimaryGroup(groupId)
  })

  // 次要分组相关
  ipcMain.handle('store:add-secondary-group', async (_, primaryGroupId: string, secondaryGroup: SecondaryGroup) => {
    const storeService = await getStoreService()
    return storeService.addSecondaryGroup(primaryGroupId, secondaryGroup)
  })

  ipcMain.handle('store:update-secondary-group', async (_, secondaryGroupId: string, updates: Partial<SecondaryGroup>) => {
    const storeService = await getStoreService()
    return storeService.updateSecondaryGroup(secondaryGroupId, updates)
  })

  ipcMain.handle('store:delete-secondary-group', async (_, secondaryGroupId: string) => {
    const storeService = await getStoreService()
    return storeService.deleteSecondaryGroup(secondaryGroupId)
  })

  // 网站相关
  ipcMain.handle('store:add-website-to-primary', async (_, primaryGroupId: string, website: Website) => {
    const storeService = await getStoreService()
    return storeService.addWebsiteToPrimaryGroup(primaryGroupId, website)
  })

  ipcMain.handle('store:add-website-to-secondary', async (_, secondaryGroupId: string, website: Website) => {
    const storeService = await getStoreService()
    return storeService.addWebsiteToSecondaryGroup(secondaryGroupId, website)
  })

  ipcMain.handle('store:update-website', async (_, websiteId: string, updates: Partial<Website>) => {
    const storeService = await getStoreService()
    return storeService.updateWebsite(websiteId, updates)
  })

  ipcMain.handle('store:delete-website', async (_, websiteId: string) => {
    const storeService = await getStoreService()
    return storeService.deleteWebsite(websiteId)
  })

  // 排序相关
  ipcMain.handle('store:update-secondary-group-order', async (_, primaryGroupId: string, secondaryGroupIds: string[]) => {
    const storeService = await getStoreService()
    await storeService.updateSecondaryGroupOrder(primaryGroupId, secondaryGroupIds)
  })

  ipcMain.handle('store:update-website-order', async (_, secondaryGroupId: string, websiteIds: string[]) => {
    const storeService = await getStoreService()
    await storeService.updateWebsiteOrder(secondaryGroupId, websiteIds)
  })

  ipcMain.handle('store:batch-update-website-orders', async (_, updates: WebsiteOrderUpdate[]) => {
    const storeService = await getStoreService()
    await storeService.batchUpdateWebsiteOrders(updates)
  })

  // 应用状态相关
  ipcMain.handle('store:get-last-active-website-id', async () => {
    const storeService = await getStoreService()
    return storeService.getLastActiveWebsiteId()
  })

  ipcMain.handle('store:set-last-active-website-id', async (_, websiteId: string | null) => {
    const storeService = await getStoreService()
    await storeService.setLastActiveWebsiteId(websiteId)
  })

  // 窗口状态相关
  ipcMain.handle('store:get-window-state', async () => {
    const storeService = await getStoreService()
    return storeService.getWindowState()
  })

  ipcMain.handle('store:set-window-state', async (_, state: Partial<WindowState>) => {
    const storeService = await getStoreService()
    await storeService.setWindowState(state)
  })

  // 设置相关
  ipcMain.handle('store:get-settings', async () => {
    const storeService = await getStoreService()
    return storeService.getSettings()
  })

  ipcMain.handle('store:update-settings', async (_, updates: Partial<Settings>) => {
    const storeService = await getStoreService()
    await storeService.updateSettings(updates)
  })

  // 清除数据相关
  ipcMain.handle('store:clear-all', async () => {
    const storeService = await getStoreService()
    await storeService.clearAll()
  })

  ipcMain.handle('store:reset-to-defaults', async (_, defaultGroups: PrimaryGroup[]) => {
    const storeService = await getStoreService()
    await storeService.resetToDefaults(defaultGroups)
  })

  // 获取数据路径
  ipcMain.handle('store:get-data-path', async () => {
    const storeService = await getStoreService()
    return storeService.getDataPath()
  })

  console.log('Store IPC handlers registered')
}
