import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      webview: {
        loadUrl: (url: string) => void
        hide: () => void
        getUrl: () => Promise<string | null>
        reload: () => void
        goBack: () => void
        goForward: () => void
      }
      window: {
        resize: () => void
        openDevTools: () => void
      }
      getFavicon: (url: string) => Promise<string | null>
      store: {
        // 主要分组相关
        getPrimaryGroups: () => Promise<any[]>
        setPrimaryGroups: (groups: any[]) => Promise<void>
        clearPrimaryGroups: () => Promise<void>
        addPrimaryGroup: (group: any) => Promise<any>
        updatePrimaryGroup: (groupId: string, updates: any) => Promise<any>
        deletePrimaryGroup: (groupId: string) => Promise<void>

        // 次要分组相关
        addSecondaryGroup: (primaryGroupId: string, secondaryGroup: any) => Promise<any>
        updateSecondaryGroup: (secondaryGroupId: string, updates: any) => Promise<any>
        deleteSecondaryGroup: (secondaryGroupId: string) => Promise<boolean>

        // 网站相关
        addWebsiteToPrimary: (primaryGroupId: string, website: any) => Promise<any>
        addWebsiteToSecondary: (secondaryGroupId: string, website: any) => Promise<any>
        updateWebsite: (websiteId: string, updates: any) => Promise<any>
        deleteWebsite: (websiteId: string) => Promise<boolean>

        // 排序相关
        updateSecondaryGroupOrder: (
          primaryGroupId: string,
          secondaryGroupIds: string[]
        ) => Promise<void>
        updateWebsiteOrder: (secondaryGroupId: string, websiteIds: string[]) => Promise<void>
        batchUpdateWebsiteOrders: (updates: any[]) => Promise<void>

        // 应用状态相关
        getLastActiveWebsiteId: () => Promise<string | null>
        setLastActiveWebsiteId: (websiteId: string | null) => Promise<void>

        // 窗口状态相关
        getWindowState: () => Promise<any>
        setWindowState: (state: any) => Promise<void>

        // 设置相关
        getSettings: () => Promise<any>
        updateSettings: (updates: any) => Promise<void>

        // 清除数据相关
        clearAll: () => Promise<void>
        resetToDefaults: (defaultGroups: any[]) => Promise<void>
      }
    }
  }
}
