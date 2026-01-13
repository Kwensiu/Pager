import { WebsiteGroup, Website, PrimaryGroup, SecondaryGroup } from '@/types/website'

// 本地存储键名（用于数据迁移和降级）
const GROUP_STORAGE_KEY = 'website-groups'
const PRIMARY_GROUP_STORAGE_KEY = 'primary-groups'

// 检查是否在 Electron 环境中
const isElectron = typeof window !== 'undefined' && window.api && window.api.store

export const storageService = {
  // ===== 主要分组相关 =====

  // 获取所有主要分组
  async getPrimaryGroups(): Promise<PrimaryGroup[]> {
    if (isElectron) {
      try {
        const data = await window.api.store.getPrimaryGroups()
        // 为缺少 createdAt 字段的数据添加默认值
        return data.map((group) => ({
          ...group,
          createdAt: group.createdAt ?? Date.now(),
          updatedAt: group.updatedAt ?? Date.now(),
          websites:
            group.websites?.map((w) => ({
              ...w,
              order: w.order ?? 0,
              createdAt: w.createdAt ?? Date.now(),
              updatedAt: w.updatedAt ?? Date.now()
            })) ?? [],
          secondaryGroups: group.secondaryGroups.map((sg) => ({
            ...sg,
            primaryGroupId: group.id,
            order: sg.order ?? 0,
            createdAt: sg.createdAt ?? Date.now(),
            updatedAt: sg.updatedAt ?? Date.now(),
            websites: sg.websites.map((w) => ({
              ...w,
              order: w.order ?? 0,
              createdAt: w.createdAt ?? Date.now(),
              updatedAt: w.updatedAt ?? Date.now()
            }))
          }))
        }))
      } catch (error) {
        console.error('Failed to load primary groups from store:', error)
        return this.getPrimaryGroupsFromLocalStorage()
      }
    } else {
      return this.getPrimaryGroupsFromLocalStorage()
    }
  },

  // 从 localStorage 获取主要分组（降级方案）
  getPrimaryGroupsFromLocalStorage(): PrimaryGroup[] {
    try {
      const data = localStorage.getItem(PRIMARY_GROUP_STORAGE_KEY)
      if (!data || data === 'undefined') return []
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to load primary groups from localStorage:', error)
      return []
    }
  },

  // 保存所有主要分组
  async setPrimaryGroups(groups: PrimaryGroup[]): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.setPrimaryGroups(groups)
      } catch (error) {
        console.error('Failed to save primary groups to store:', error)
        this.savePrimaryGroupsToLocalStorage(groups)
      }
    } else {
      this.savePrimaryGroupsToLocalStorage(groups)
    }
  },

  // 保存主要分组到 localStorage（降级方案）
  savePrimaryGroupsToLocalStorage(groups: PrimaryGroup[]): void {
    try {
      localStorage.setItem(PRIMARY_GROUP_STORAGE_KEY, JSON.stringify(groups))
    } catch (error) {
      console.error('Failed to save primary groups to localStorage:', error)
    }
  },

  // 清除所有主要分组数据
  async clearPrimaryGroups(): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.clearPrimaryGroups()
      } catch (error) {
        console.error('Failed to clear primary groups from store:', error)
        this.clearPrimaryGroupsFromLocalStorage()
      }
    } else {
      this.clearPrimaryGroupsFromLocalStorage()
    }
  },

  // 从 localStorage 清除主要分组（降级方案）
  clearPrimaryGroupsFromLocalStorage(): void {
    try {
      localStorage.removeItem(PRIMARY_GROUP_STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear primary groups from localStorage:', error)
    }
  },

  // 添加主要分组
  async addPrimaryGroup(name: string): Promise<PrimaryGroup> {
    const groups = await this.getPrimaryGroups()
    const newGroup: PrimaryGroup = {
      id: `primary-${Date.now()}`,
      name,
      expanded: true,
      secondaryGroups: [],
      websites: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (isElectron) {
      try {
        return await window.api.store.addPrimaryGroup(newGroup)
      } catch (error) {
        console.error('Failed to add primary group to store:', error)
        groups.push(newGroup)
        this.savePrimaryGroupsToLocalStorage(groups)
        return newGroup
      }
    } else {
      groups.push(newGroup)
      this.savePrimaryGroupsToLocalStorage(groups)
      return newGroup
    }
  },

  // ===== 次要分组相关 =====

  // 添加次要分组到主要分组
  async addSecondaryGroupToPrimary(primaryGroupId: string, name: string): Promise<SecondaryGroup> {
    const groups = await this.getPrimaryGroups()
    const primaryGroupIndex = groups.findIndex((g) => g.id === primaryGroupId)

    if (primaryGroupIndex === -1) {
      throw new Error('Primary group not found')
    }

    // 计算新的order值（放在最后）
    const existingGroups = groups[primaryGroupIndex].secondaryGroups
    const maxOrder =
      existingGroups.length > 0 ? Math.max(...existingGroups.map((g) => g.order || 0)) : -100
    const newOrder = maxOrder + 100

    const newSecondaryGroup: SecondaryGroup = {
      id: `secondary-${Date.now()}`,
      name,
      primaryGroupId,
      expanded: true,
      websites: [],
      order: newOrder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (isElectron) {
      try {
        return await window.api.store.addSecondaryGroup(primaryGroupId, newSecondaryGroup)
      } catch (error) {
        console.error('Failed to add secondary group to store:', error)
        groups[primaryGroupIndex].secondaryGroups.push(newSecondaryGroup)
        groups[primaryGroupIndex].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return newSecondaryGroup
      }
    } else {
      groups[primaryGroupIndex].secondaryGroups.push(newSecondaryGroup)
      groups[primaryGroupIndex].updatedAt = Date.now()
      this.savePrimaryGroupsToLocalStorage(groups)
      return newSecondaryGroup
    }
  },

  // 更新次要分组
  async updateSecondaryGroup(
    secondaryGroupId: string,
    updates: Partial<SecondaryGroup>
  ): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.updateSecondaryGroup(secondaryGroupId, updates)
      } catch (error) {
        console.error('Failed to update secondary group in store:', error)
        this.updateSecondaryGroupInLocalStorage(secondaryGroupId, updates)
      }
    } else {
      this.updateSecondaryGroupInLocalStorage(secondaryGroupId, updates)
    }
  },

  // 在 localStorage 中更新次要分组
  updateSecondaryGroupInLocalStorage(
    secondaryGroupId: string,
    updates: Partial<SecondaryGroup>
  ): void {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        groups[i].secondaryGroups[secondaryIndex] = {
          ...groups[i].secondaryGroups[secondaryIndex],
          ...updates,
          updatedAt: Date.now()
        }
        groups[i].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return
      }
    }
  },

  // 删除次要分组
  async deleteSecondaryGroup(secondaryGroupId: string): Promise<boolean> {
    if (isElectron) {
      try {
        return await window.api.store.deleteSecondaryGroup(secondaryGroupId)
      } catch (error) {
        console.error('Failed to delete secondary group from store:', error)
        return this.deleteSecondaryGroupFromLocalStorage(secondaryGroupId)
      }
    } else {
      return this.deleteSecondaryGroupFromLocalStorage(secondaryGroupId)
    }
  },

  // 在 localStorage 中删除次要分组
  deleteSecondaryGroupFromLocalStorage(secondaryGroupId: string): boolean {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        groups[i].secondaryGroups.splice(secondaryIndex, 1)
        groups[i].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return true
      }
    }

    return false
  },

  // ===== 网站相关 =====

  // 在主要分组中添加网站
  async addWebsiteToPrimaryGroup(
    primaryGroupId: string,
    website: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Website> {
    const groups = await this.getPrimaryGroups()
    const primaryGroupIndex = groups.findIndex((g) => g.id === primaryGroupId)

    if (primaryGroupIndex === -1) {
      throw new Error('Primary group not found')
    }

    const existingWebsites = groups[primaryGroupIndex].websites || []
    const maxOrder =
      existingWebsites.length > 0 ? Math.max(...existingWebsites.map((w) => w.order || 0)) : -100
    const newOrder = maxOrder + 100

    const newWebsite: Website = {
      ...website,
      id: `website-${Date.now()}`,
      order: newOrder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (!groups[primaryGroupIndex].websites) {
      groups[primaryGroupIndex].websites = []
    }

    if (isElectron) {
      try {
        return await window.api.store.addWebsiteToPrimary(primaryGroupId, newWebsite)
      } catch (error) {
        console.error('Failed to add website to store:', error)
        groups[primaryGroupIndex].websites.push(newWebsite)
        groups[primaryGroupIndex].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return newWebsite
      }
    } else {
      groups[primaryGroupIndex].websites.push(newWebsite)
      groups[primaryGroupIndex].updatedAt = Date.now()
      this.savePrimaryGroupsToLocalStorage(groups)
      return newWebsite
    }
  },

  // 在次要分组中添加网站
  async addWebsiteToSecondaryGroup(
    secondaryGroupId: string,
    website: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Website> {
    const groups = await this.getPrimaryGroups()

    let targetSecondaryGroup: { primaryGroupIndex: number; secondaryGroupIndex: number } | null =
      null
    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        targetSecondaryGroup = { primaryGroupIndex: i, secondaryGroupIndex: secondaryIndex }
        break
      }
    }

    if (!targetSecondaryGroup) {
      throw new Error('Secondary group not found')
    }

    const { primaryGroupIndex, secondaryGroupIndex } = targetSecondaryGroup
    const existingWebsites = groups[primaryGroupIndex].secondaryGroups[secondaryGroupIndex].websites
    const maxOrder =
      existingWebsites.length > 0 ? Math.max(...existingWebsites.map((w) => w.order || 0)) : -100
    const newOrder = maxOrder + 100

    const newWebsite: Website = {
      ...website,
      id: `website-${Date.now()}`,
      order: newOrder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (isElectron) {
      try {
        return await window.api.store.addWebsiteToSecondary(secondaryGroupId, newWebsite)
      } catch (error) {
        console.error('Failed to add website to store:', error)
        groups[primaryGroupIndex].secondaryGroups[secondaryGroupIndex].websites.push(newWebsite)
        groups[primaryGroupIndex].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return newWebsite
      }
    } else {
      groups[primaryGroupIndex].secondaryGroups[secondaryGroupIndex].websites.push(newWebsite)
      groups[primaryGroupIndex].updatedAt = Date.now()
      this.savePrimaryGroupsToLocalStorage(groups)
      return newWebsite
    }
  },

  // 更新网站
  async updateWebsite(websiteId: string, updates: Partial<Website>): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.updateWebsite(websiteId, updates)
      } catch (error) {
        console.error('Failed to update website in store:', error)
        this.updateWebsiteInLocalStorage(websiteId, updates)
      }
    } else {
      this.updateWebsiteInLocalStorage(websiteId, updates)
    }
  },

  // 在 localStorage 中更新网站
  updateWebsiteInLocalStorage(websiteId: string, updates: Partial<Website>): void {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    for (let i = 0; i < groups.length; i++) {
      const websites = groups[i].websites
      if (websites) {
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites[websiteIndex] = {
            ...websites[websiteIndex],
            ...updates,
            updatedAt: Date.now()
          }
          groups[i].updatedAt = Date.now()
          this.savePrimaryGroupsToLocalStorage(groups)
          return
        }
      }

      for (let j = 0; j < groups[i].secondaryGroups.length; j++) {
        const websites = groups[i].secondaryGroups[j].websites
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites[websiteIndex] = {
            ...websites[websiteIndex],
            ...updates,
            updatedAt: Date.now()
          }
          groups[i].secondaryGroups[j].updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
          this.savePrimaryGroupsToLocalStorage(groups)
          return
        }
      }
    }
  },

  // 删除网站
  async deleteWebsite(websiteId: string): Promise<boolean> {
    if (isElectron) {
      try {
        return await window.api.store.deleteWebsite(websiteId)
      } catch (error) {
        console.error('Failed to delete website from store:', error)
        return this.deleteWebsiteFromLocalStorage(websiteId)
      }
    } else {
      return this.deleteWebsiteFromLocalStorage(websiteId)
    }
  },

  // 在 localStorage 中删除网站
  deleteWebsiteFromLocalStorage(websiteId: string): boolean {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    for (let i = 0; i < groups.length; i++) {
      const websites = groups[i].websites
      if (websites) {
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites.splice(websiteIndex, 1)
          groups[i].updatedAt = Date.now()
          this.savePrimaryGroupsToLocalStorage(groups)
          return true
        }
      }

      for (let j = 0; j < groups[i].secondaryGroups.length; j++) {
        const websites = groups[i].secondaryGroups[j].websites
        const websiteIndex = websites.findIndex((w) => w.id === websiteId)
        if (websiteIndex !== -1) {
          websites.splice(websiteIndex, 1)
          groups[i].secondaryGroups[j].updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
          this.savePrimaryGroupsToLocalStorage(groups)
          return true
        }
      }
    }

    return false
  },

  // ===== 排序相关 =====

  // 更新二级分组排序
  async updateSecondaryGroupOrder(
    primaryGroupId: string,
    secondaryGroupIds: string[]
  ): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.updateSecondaryGroupOrder(primaryGroupId, secondaryGroupIds)
      } catch (error) {
        console.error('Failed to update secondary group order in store:', error)
        this.updateSecondaryGroupOrderInLocalStorage(primaryGroupId, secondaryGroupIds)
      }
    } else {
      this.updateSecondaryGroupOrderInLocalStorage(primaryGroupId, secondaryGroupIds)
    }
  },

  // 在 localStorage 中更新二级分组排序
  updateSecondaryGroupOrderInLocalStorage(
    primaryGroupId: string,
    secondaryGroupIds: string[]
  ): void {
    const groups = this.getPrimaryGroupsFromLocalStorage()
    const primaryGroupIndex = groups.findIndex((g) => g.id === primaryGroupId)

    if (primaryGroupIndex === -1) {
      throw new Error('Primary group not found')
    }

    const secondaryGroups = groups[primaryGroupIndex].secondaryGroups
    const sortedSecondaryGroups = secondaryGroupIds.map((id, index) => {
      const group = secondaryGroups.find((sg) => sg.id === id)
      if (!group) {
        throw new Error(`Secondary group ${id} not found`)
      }
      return {
        ...group,
        order: index * 100,
        updatedAt: Date.now()
      }
    })

    groups[primaryGroupIndex].secondaryGroups = sortedSecondaryGroups
    groups[primaryGroupIndex].updatedAt = Date.now()
    this.savePrimaryGroupsToLocalStorage(groups)
  },

  // 更新网站排序
  async updateWebsiteOrder(secondaryGroupId: string, websiteIds: string[]): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.updateWebsiteOrder(secondaryGroupId, websiteIds)
      } catch (error) {
        console.error('Failed to update website order in store:', error)
        this.updateWebsiteOrderInLocalStorage(secondaryGroupId, websiteIds)
      }
    } else {
      this.updateWebsiteOrderInLocalStorage(secondaryGroupId, websiteIds)
    }
  },

  // 在 localStorage 中更新网站排序
  updateWebsiteOrderInLocalStorage(secondaryGroupId: string, websiteIds: string[]): void {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    for (let i = 0; i < groups.length; i++) {
      const secondaryIndex = groups[i].secondaryGroups.findIndex((sg) => sg.id === secondaryGroupId)
      if (secondaryIndex !== -1) {
        const websites = groups[i].secondaryGroups[secondaryIndex].websites
        const sortedWebsites = websiteIds.map((id, index) => {
          const website = websites.find((w) => w.id === id)
          if (!website) {
            throw new Error(`Website ${id} not found`)
          }
          return {
            ...website,
            order: index * 100,
            updatedAt: Date.now()
          }
        })

        groups[i].secondaryGroups[secondaryIndex].websites = sortedWebsites
        groups[i].secondaryGroups[secondaryIndex].updatedAt = Date.now()
        groups[i].updatedAt = Date.now()
        this.savePrimaryGroupsToLocalStorage(groups)
        return
      }
    }
  },

  // 批量更新网站排序
  async batchUpdateWebsiteOrders(
    updates: Array<{
      secondaryGroupId: string
      websiteIds: string[]
    }>
  ): Promise<void> {
    if (isElectron) {
      try {
        await window.api.store.batchUpdateWebsiteOrders(updates)
      } catch (error) {
        console.error('Failed to batch update website orders in store:', error)
        this.batchUpdateWebsiteOrdersInLocalStorage(updates)
      }
    } else {
      this.batchUpdateWebsiteOrdersInLocalStorage(updates)
    }
  },

  // 在 localStorage 中批量更新网站排序
  batchUpdateWebsiteOrdersInLocalStorage(
    updates: Array<{
      secondaryGroupId: string
      websiteIds: string[]
    }>
  ): void {
    const groups = this.getPrimaryGroupsFromLocalStorage()

    updates.forEach(({ secondaryGroupId, websiteIds }) => {
      for (let i = 0; i < groups.length; i++) {
        const secondaryIndex = groups[i].secondaryGroups.findIndex(
          (sg) => sg.id === secondaryGroupId
        )
        if (secondaryIndex !== -1) {
          const websites = groups[i].secondaryGroups[secondaryIndex].websites
          const sortedWebsites = websiteIds.map((id, index) => {
            const website = websites.find((w) => w.id === id)
            if (!website) {
              throw new Error(`Website ${id} not found`)
            }
            return {
              ...website,
              order: index * 100,
              updatedAt: Date.now()
            }
          })

          groups[i].secondaryGroups[secondaryIndex].websites = sortedWebsites
          groups[i].secondaryGroups[secondaryIndex].updatedAt = Date.now()
          groups[i].updatedAt = Date.now()
        }
      }
    })

    this.savePrimaryGroupsToLocalStorage(groups)
  },

  // ===== 旧版兼容方法（已废弃，保留用于兼容性）=====

  getGroups(): WebsiteGroup[] {
    try {
      const data = localStorage.getItem(GROUP_STORAGE_KEY)
      if (!data || data === 'undefined') return []
      return JSON.parse(data)
    } catch (error) {
      console.error('Failed to load groups:', error)
      return []
    }
  },

  saveGroups(groups: WebsiteGroup[]): void {
    try {
      localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(groups))
    } catch (error) {
      console.error('Failed to save groups:', error)
    }
  },

  addGroup(name: string): WebsiteGroup {
    const groups = this.getGroups()
    const newGroup: WebsiteGroup = {
      id: `group-${Date.now()}`,
      name,
      expanded: true,
      websites: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    groups.push(newGroup)
    this.saveGroups(groups)
    return newGroup
  },

  deleteGroup(groupId: string): void {
    const groups = this.getGroups().filter((g) => g.id !== groupId)
    this.saveGroups(groups)
  },

  updateGroup(groupId: string, updates: Partial<WebsiteGroup>): void {
    const groups = this.getGroups()
    const index = groups.findIndex((g) => g.id === groupId)
    if (index !== -1) {
      groups[index] = {
        ...groups[index],
        ...updates,
        updatedAt: Date.now()
      }
      this.saveGroups(groups)
    }
  },

  addWebsite(groupId: string, website: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>): Website {
    const groups = this.getGroups()
    const groupIndex = groups.findIndex((g) => g.id === groupId)

    if (groupIndex === -1) {
      throw new Error('Group not found')
    }

    const existingWebsites = groups[groupIndex].websites
    const maxOrder =
      existingWebsites.length > 0 ? Math.max(...existingWebsites.map((w) => w.order || 0)) : -100
    const newOrder = maxOrder + 100

    const newWebsite: Website = {
      ...website,
      id: `website-${Date.now()}`,
      order: newOrder,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    groups[groupIndex].websites.push(newWebsite)
    groups[groupIndex].updatedAt = Date.now()
    this.saveGroups(groups)
    return newWebsite
  },

  deleteWebsiteByGroup(groupId: string, websiteId: string): void {
    const groups = this.getGroups()
    const groupIndex = groups.findIndex((g) => g.id === groupId)

    if (groupIndex !== -1) {
      groups[groupIndex].websites = groups[groupIndex].websites.filter((w) => w.id !== websiteId)
      groups[groupIndex].updatedAt = Date.now()
      this.saveGroups(groups)
    }
  },

  updateWebsiteByGroup(groupId: string, websiteId: string, updates: Partial<Website>): void {
    const groups = this.getGroups()
    const groupIndex = groups.findIndex((g) => g.id === groupId)

    if (groupIndex !== -1) {
      const websiteIndex = groups[groupIndex].websites.findIndex((w) => w.id === websiteId)
      if (websiteIndex !== -1) {
        groups[groupIndex].websites[websiteIndex] = {
          ...groups[groupIndex].websites[websiteIndex],
          ...updates,
          updatedAt: Date.now()
        }
        groups[groupIndex].updatedAt = Date.now()
        this.saveGroups(groups)
      }
    }
  }
}
