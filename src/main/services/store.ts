import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../types/store'

// 定义 Store 数据结构类型
interface StoreSchema {
  primaryGroups: PrimaryGroup[]
  lastActiveWebsiteId: string | null
  windowState: WindowState
  settings: Settings
}

// 定义 Store 的类型接口
interface ElectronStore<T = StoreSchema> {
  get<K extends keyof T>(key: K, defaultValue?: T[K]): T[K]
  set<K extends keyof T>(key: K, value: T[K]): void
  delete<K extends keyof T>(key: K): void
  clear(): void
  path?: string
}

let store: ElectronStore | null = null

async function getStore(): Promise<ElectronStore> {
  if (!store) {
    const ElectronStore = (await import('electron-store')).default
    const Store = (ElectronStore as { default?: typeof ElectronStore }).default || ElectronStore

    store = new Store({
      name: 'pager-store',
      encryptionKey: undefined, // 确保不加密，便于调试
      clearInvalidConfig: false,
      defaults: {
        primaryGroups: [],
        lastActiveWebsiteId: null,
        windowState: {
          width: 1200,
          height: 800,
          x: null,
          y: null,
          maximized: false
        },
        settings: {
          // 通用设置
          theme: 'light',
          language: 'zh',
          minimizeToTray: true,
          collapsedSidebarMode: 'all',
          dataPath: '',

          // 全局快捷键
          shortcutsEnabled: true,
          shortcutAlwaysOnTop: 'Ctrl+Shift+T',
          shortcutMiniMode: 'Ctrl+Shift+M',

          // 系统托盘
          trayEnabled: true,
          trayShowNotifications: true,

          // 窗口管理
          windowAlwaysOnTop: false,
          windowMiniMode: false,
          windowAdsorptionEnabled: true,
          windowAdsorptionSensitivity: 50,

          // 内存优化
          memoryOptimizerEnabled: true,
          memoryCleanInterval: 30,
          maxInactiveTime: 60,

          // 数据同步
          autoSyncEnabled: false,
          syncInterval: 24,

          // 自动启动
          autoLaunchEnabled: false,

          // 代理支持
          proxyEnabled: false,
          proxyRules: '',

          // 版本检查
          autoCheckUpdates: true,

          // Session 隔离
          sessionIsolationEnabled: true,

          // 进程崩溃处理
          crashReportingEnabled: true,
          autoRestartOnCrash: false,

          // 浏览器设置
          enableJavaScript: true,
          allowPopups: true,

          // 隐私与数据
          saveSession: true,
          clearCacheOnExit: false,

          // 扩展设置
          enableExtensions: true,
          autoLoadExtensions: true,

          // 调试模式
          showDebugOptions: false
        }
      }
    })
    // 打印存储路径以便调试
    console.log('Store initialized, path:', store.path)
  }
  return store
}

export const storeService = {
  // ===== 主要分组相关 =====

  // 获取所有主要分组
  async getPrimaryGroups() {
    const s = await getStore()
    return s.get('primaryGroups', [])
  },

  // 保存所有主要分组
  async setPrimaryGroups(groups: PrimaryGroup[]) {
    const s = await getStore()
    s.set('primaryGroups', groups)
  },

  // 清除所有主要分组
  async clearPrimaryGroups() {
    const s = await getStore()
    s.set('primaryGroups', [])
  },

  // 添加主要分组
  async addPrimaryGroup(group: Partial<PrimaryGroup>) {
    const groups = await this.getPrimaryGroups()

    // 确保必需字段存在
    if (!group.id) {
      throw new Error('Primary group must have an id')
    }
    if (!group.name) {
      throw new Error('Primary group must have a name')
    }

    const completeGroup: PrimaryGroup = {
      id: group.id,
      name: group.name,
      secondaryGroups: group.secondaryGroups ?? [],
      websites: group.websites ?? [],
      order: group.order,
      updatedAt: group.updatedAt ?? Date.now()
    }

    groups.push(completeGroup)
    await this.setPrimaryGroups(groups)
    return completeGroup
  },

  // 更新主要分组
  async updatePrimaryGroup(groupId: string, updates: Partial<PrimaryGroup>) {
    const groups = await this.getPrimaryGroups()
    const index = groups.findIndex((g) => g.id === groupId)
    if (index !== -1) {
      const group = groups[index]
      groups[index] = { ...group, ...updates, updatedAt: Date.now() }
      await this.setPrimaryGroups(groups)
      return groups[index]
    }
    return null
  },

  // 删除主要分组
  async deletePrimaryGroup(groupId: string) {
    const groups = (await this.getPrimaryGroups()).filter((g) => g.id !== groupId)
    await this.setPrimaryGroups(groups)
  },

  // ===== 次要分组相关 =====

  // 添加次要分组到主要分组
  async addSecondaryGroup(primaryGroupId: string, secondaryGroup: SecondaryGroup) {
    const groups = await this.getPrimaryGroups()
    const index = groups.findIndex((g) => g.id === primaryGroupId)

    if (index === -1) {
      throw new Error('Primary group not found')
    }

    const group = groups[index]
    group.secondaryGroups.push(secondaryGroup)
    group.updatedAt = Date.now()
    await this.setPrimaryGroups(groups)
    return secondaryGroup
  },

  // 更新次要分组
  async updateSecondaryGroup(secondaryGroupId: string, updates: Partial<SecondaryGroup>) {
    const groups = await this.getPrimaryGroups()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex(
        (sg: SecondaryGroup) => sg.id === secondaryGroupId
      )
      if (secondaryIndex !== -1) {
        const secondaryGroups = groups[i].secondaryGroups
        secondaryGroups[secondaryIndex] = {
          ...secondaryGroups[secondaryIndex],
          ...updates,
          updatedAt: Date.now()
        }
        groups[i].updatedAt = Date.now()
        await this.setPrimaryGroups(groups)
        return secondaryGroups[secondaryIndex]
      }
    }

    return null
  },

  // 删除次要分组
  async deleteSecondaryGroup(secondaryGroupId: string) {
    const groups = await this.getPrimaryGroups()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        groups[i].secondaryGroups.splice(secondaryIndex, 1)
        groups[i].updatedAt = Date.now()
        await this.setPrimaryGroups(groups)
        return true
      }
    }

    return false
  },

  // ===== 网站相关 =====

  // 在主要分组中添加网站
  async addWebsiteToPrimaryGroup(primaryGroupId: string, website: Website) {
    const groups = await this.getPrimaryGroups()
    const index = groups.findIndex((g) => g.id === primaryGroupId)

    if (index === -1) {
      throw new Error('Primary group not found')
    }

    const group = groups[index]
    if (!group.websites) {
      group.websites = []
    }

    group.websites.push(website)
    group.updatedAt = Date.now()
    await this.setPrimaryGroups(groups)
    return website
  },

  // 在次要分组中添加网站
  async addWebsiteToSecondaryGroup(secondaryGroupId: string, website: Website) {
    const groups = await this.getPrimaryGroups()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        const secondaryGroup = groups[i].secondaryGroups[secondaryIndex]
        secondaryGroup.websites.push(website)
        secondaryGroup.updatedAt = Date.now()
        groups[i].updatedAt = Date.now()
        await this.setPrimaryGroups(groups)
        return website
      }
    }

    throw new Error('Secondary group not found')
  },

  // 更新网站
  async updateWebsite(websiteId: string, updates: Partial<Website>) {
    const groups = await this.getPrimaryGroups()

    // 搜索主要分组中的网站
    for (let i = 0; i < groups.length; i++) {
      if (groups[i].websites) {
        const websites = groups[i].websites!
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites[websiteIndex] = {
            ...websites[websiteIndex],
            ...updates,
            updatedAt: Date.now()
          }
          groups[i].updatedAt = Date.now()
          await this.setPrimaryGroups(groups)
          return websites[websiteIndex]
        }
      }

      // 搜索次要分组中的网站
      for (let j = 0; j < groups[i].secondaryGroups.length; j++) {
        const websites = groups[i].secondaryGroups[j].websites
        if (!websites) continue
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites[websiteIndex] = {
            ...websites[websiteIndex],
            ...updates,
            updatedAt: Date.now()
          }
          groups[i].secondaryGroups[j].updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
          await this.setPrimaryGroups(groups)
          return websites[websiteIndex]
        }
      }
    }

    return null
  },

  // 删除网站
  async deleteWebsite(websiteId: string) {
    const groups = await this.getPrimaryGroups()

    for (let i = 0; i < groups.length; i++) {
      // 删除主要分组中的网站
      if (groups[i].websites) {
        const websites = groups[i].websites!
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites.splice(websiteIndex, 1)
          groups[i].updatedAt = Date.now()
          await this.setPrimaryGroups(groups)
          return true
        }
      }

      // 删除次要分组中的网站
      for (let j = 0; j < groups[i].secondaryGroups.length; j++) {
        const websites = groups[i].secondaryGroups[j].websites
        if (!websites) continue
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites.splice(websiteIndex, 1)
          groups[i].secondaryGroups[j].updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
          await this.setPrimaryGroups(groups)
          return true
        }
      }
    }

    return false
  },

  // ===== 排序相关 =====

  // 更新二级分组排序
  async updateSecondaryGroupOrder(primaryGroupId: string, secondaryGroupIds: string[]) {
    const groups = await this.getPrimaryGroups()
    const index = groups.findIndex((g) => g.id === primaryGroupId)

    if (index === -1) {
      throw new Error('Primary group not found')
    }

    const sortedSecondaryGroups = secondaryGroupIds.map((id, orderIndex) => {
      const group = groups[index].secondaryGroups.find((sg) => sg.id === id)
      if (!group) {
        throw new Error(`Secondary group ${id} not found`)
      }
      return { ...group, order: orderIndex * 100, updatedAt: Date.now() }
    })

    groups[index].secondaryGroups = sortedSecondaryGroups
    groups[index].updatedAt = Date.now()
    await this.setPrimaryGroups(groups)
  },

  // 更新网站排序
  async updateWebsiteOrder(secondaryGroupId: string, websiteIds: string[]) {
    const groups = await this.getPrimaryGroups()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        const secondaryGroup = groups[i].secondaryGroups[secondaryIndex]
        const sortedWebsites = websiteIds.map((id, orderIndex) => {
          const website = secondaryGroup.websites.find((w) => w.id === id)
          if (!website) {
            throw new Error(`Website ${id} not found`)
          }
          return { ...website, order: orderIndex * 100, updatedAt: Date.now() }
        })

        secondaryGroup.websites = sortedWebsites
        secondaryGroup.updatedAt = Date.now()
        groups[i].updatedAt = Date.now()
        await this.setPrimaryGroups(groups)
        return
      }
    }

    throw new Error('Secondary group not found')
  },

  // 批量更新网站排序
  async batchUpdateWebsiteOrders(updates: WebsiteOrderUpdate[]) {
    const groups = await this.getPrimaryGroups()

    updates.forEach(({ secondaryGroupId, websiteIds }) => {
      for (let i = 0; i < groups.length; i++) {
        const secondaryIndex = groups[i].secondaryGroups.findIndex(
          (sg) => sg.id === secondaryGroupId
        )
        if (secondaryIndex !== -1) {
          const secondaryGroup = groups[i].secondaryGroups[secondaryIndex]
          const sortedWebsites = websiteIds.map((id, orderIndex) => {
            const website = secondaryGroup.websites.find((w) => w.id === id)
            if (!website) {
              throw new Error(`Website ${id} not found`)
            }
            return { ...website, order: orderIndex * 100, updatedAt: Date.now() }
          })

          secondaryGroup.websites = sortedWebsites
          secondaryGroup.updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
        }
      }
    })

    await this.setPrimaryGroups(groups)
  },

  // ===== 应用状态相关 =====

  // 获取最后激活的网站ID
  async getLastActiveWebsiteId() {
    const s = await getStore()
    return s.get('lastActiveWebsiteId', null)
  },

  // 设置最后激活的网站ID
  async setLastActiveWebsiteId(websiteId: string | null) {
    const s = await getStore()
    s.set('lastActiveWebsiteId', websiteId)
  },

  // ===== 窗口状态相关 =====

  // 获取窗口状态
  async getWindowState() {
    const s = await getStore()
    return s.get('windowState')
  },

  // 设置窗口状态
  async setWindowState(state: Partial<WindowState>) {
    const currentState = await this.getWindowState()
    const s = await getStore()

    // 合并当前状态和更新，确保必需字段存在
    const mergedState: WindowState = {
      width: state.width ?? currentState?.width ?? 1200,
      height: state.height ?? currentState?.height ?? 800,
      x: state.x ?? currentState?.x ?? null,
      y: state.y ?? currentState?.y ?? null,
      maximized: state.maximized ?? currentState?.maximized ?? false
    }

    s.set('windowState', mergedState)
  },

  // ===== 设置相关 =====

  // 获取设置
  async getSettings() {
    const s = await getStore()
    return s.get('settings')
  },

  // 更新设置
  async updateSettings(updates: Partial<Settings>) {
    const settings = await this.getSettings()
    const s = await getStore()
    s.set('settings', { ...settings, ...updates })
  },

  // ===== 清除数据相关 =====

  // 清除所有数据（恢复默认）
  async clearAll() {
    const s = await getStore()
    s.clear()
  },

  // 重置为默认数据
  async resetToDefaults(defaultGroups: PrimaryGroup[]) {
    const s = await getStore()
    s.set('primaryGroups', defaultGroups)
  },

  // 获取数据路径
  async getDataPath() {
    try {
      const { app } = await import('electron')
      const path = app.getPath('userData')
      return { success: true, path }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  }
}

// 导出 store 实例以供直接访问
export { getStore as store }
