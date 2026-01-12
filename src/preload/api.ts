import { ipcRenderer } from 'electron'

export const api = {
  // WebView 相关 API
  webview: {
    loadUrl: (url: string) => ipcRenderer.send('webview:load-url', url),
    hide: () => ipcRenderer.send('webview:hide'),
    getUrl: () => ipcRenderer.invoke('webview:get-url'),
    reload: () => ipcRenderer.send('webview:reload'),
    goBack: () => ipcRenderer.send('webview:go-back'),
    goForward: () => ipcRenderer.send('webview:go-forward')
  },

  // 窗口管理
  window: {
    resize: () => ipcRenderer.send('window:resize'),
    openDevTools: () => ipcRenderer.send('window:open-dev-tools')
  },

  // 获取网站图标
  getFavicon: (url: string) => ipcRenderer.invoke('get-favicon', url),

  // Store 相关 API
  store: {
    // 主要分组相关
    getPrimaryGroups: () => ipcRenderer.invoke('store:get-primary-groups'),
    setPrimaryGroups: (groups: any[]) => ipcRenderer.invoke('store:set-primary-groups', groups),
    clearPrimaryGroups: () => ipcRenderer.invoke('store:clear-primary-groups'),
    addPrimaryGroup: (group: any) => ipcRenderer.invoke('store:add-primary-group', group),
    updatePrimaryGroup: (groupId: string, updates: any) =>
      ipcRenderer.invoke('store:update-primary-group', groupId, updates),
    deletePrimaryGroup: (groupId: string) =>
      ipcRenderer.invoke('store:delete-primary-group', groupId),

    // 次要分组相关
    addSecondaryGroup: (primaryGroupId: string, secondaryGroup: any) =>
      ipcRenderer.invoke('store:add-secondary-group', primaryGroupId, secondaryGroup),
    updateSecondaryGroup: (secondaryGroupId: string, updates: any) =>
      ipcRenderer.invoke('store:update-secondary-group', secondaryGroupId, updates),
    deleteSecondaryGroup: (secondaryGroupId: string) =>
      ipcRenderer.invoke('store:delete-secondary-group', secondaryGroupId),

    // 网站相关
    addWebsiteToPrimary: (primaryGroupId: string, website: any) =>
      ipcRenderer.invoke('store:add-website-to-primary', primaryGroupId, website),
    addWebsiteToSecondary: (secondaryGroupId: string, website: any) =>
      ipcRenderer.invoke('store:add-website-to-secondary', secondaryGroupId, website),
    updateWebsite: (websiteId: string, updates: any) =>
      ipcRenderer.invoke('store:update-website', websiteId, updates),
    deleteWebsite: (websiteId: string) => ipcRenderer.invoke('store:delete-website', websiteId),

    // 排序相关
    updateSecondaryGroupOrder: (primaryGroupId: string, secondaryGroupIds: string[]) =>
      ipcRenderer.invoke('store:update-secondary-group-order', primaryGroupId, secondaryGroupIds),
    updateWebsiteOrder: (secondaryGroupId: string, websiteIds: string[]) =>
      ipcRenderer.invoke('store:update-website-order', secondaryGroupId, websiteIds),
    batchUpdateWebsiteOrders: (updates: any[]) =>
      ipcRenderer.invoke('store:batch-update-website-orders', updates),

    // 应用状态相关
    getLastActiveWebsiteId: () => ipcRenderer.invoke('store:get-last-active-website-id'),
    setLastActiveWebsiteId: (websiteId: string | null) =>
      ipcRenderer.invoke('store:set-last-active-website-id', websiteId),

    // 窗口状态相关
    getWindowState: () => ipcRenderer.invoke('store:get-window-state'),
    setWindowState: (state: any) => ipcRenderer.invoke('store:set-window-state', state),

    // 设置相关
    getSettings: () => ipcRenderer.invoke('store:get-settings'),
    updateSettings: (updates: any) => ipcRenderer.invoke('store:update-settings', updates),

    // 清除数据相关
    clearAll: () => ipcRenderer.invoke('store:clear-all'),
    resetToDefaults: (defaultGroups: any[]) =>
      ipcRenderer.invoke('store:reset-to-defaults', defaultGroups)
  }
}
