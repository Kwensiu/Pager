import { ipcRenderer } from 'electron'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../main/types/store'

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

  // 对话框 API
  dialog: {
    openDirectory: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:open-directory', options),
    openFile: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:open-file', options)
  },

  // 获取网站图标
  getFavicon: (url: string) => ipcRenderer.invoke('get-favicon', url),

  // Store 相关 API
  store: {
    // 主要分组相关
    getPrimaryGroups: () => ipcRenderer.invoke('store:get-primary-groups'),
    setPrimaryGroups: (groups: PrimaryGroup[]) =>
      ipcRenderer.invoke('store:set-primary-groups', groups),
    clearPrimaryGroups: () => ipcRenderer.invoke('store:clear-primary-groups'),
    addPrimaryGroup: (group: Partial<PrimaryGroup>) =>
      ipcRenderer.invoke('store:add-primary-group', group),
    updatePrimaryGroup: (groupId: string, updates: Partial<PrimaryGroup>) =>
      ipcRenderer.invoke('store:update-primary-group', groupId, updates),
    deletePrimaryGroup: (groupId: string) =>
      ipcRenderer.invoke('store:delete-primary-group', groupId),

    // 次要分组相关
    addSecondaryGroup: (primaryGroupId: string, secondaryGroup: SecondaryGroup) =>
      ipcRenderer.invoke('store:add-secondary-group', primaryGroupId, secondaryGroup),
    updateSecondaryGroup: (secondaryGroupId: string, updates: Partial<SecondaryGroup>) =>
      ipcRenderer.invoke('store:update-secondary-group', secondaryGroupId, updates),
    deleteSecondaryGroup: (secondaryGroupId: string) =>
      ipcRenderer.invoke('store:delete-secondary-group', secondaryGroupId),

    // 网站相关
    addWebsiteToPrimary: (primaryGroupId: string, website: Website) =>
      ipcRenderer.invoke('store:add-website-to-primary', primaryGroupId, website),
    addWebsiteToSecondary: (secondaryGroupId: string, website: Website) =>
      ipcRenderer.invoke('store:add-website-to-secondary', secondaryGroupId, website),
    updateWebsite: (websiteId: string, updates: Partial<Website>) =>
      ipcRenderer.invoke('store:update-website', websiteId, updates),
    deleteWebsite: (websiteId: string) => ipcRenderer.invoke('store:delete-website', websiteId),

    // 排序相关
    updateSecondaryGroupOrder: (primaryGroupId: string, secondaryGroupIds: string[]) =>
      ipcRenderer.invoke('store:update-secondary-group-order', primaryGroupId, secondaryGroupIds),
    updateWebsiteOrder: (secondaryGroupId: string, websiteIds: string[]) =>
      ipcRenderer.invoke('store:update-website-order', secondaryGroupId, websiteIds),
    batchUpdateWebsiteOrders: (updates: WebsiteOrderUpdate[]) =>
      ipcRenderer.invoke('store:batch-update-website-orders', updates),

    // 应用状态相关
    getLastActiveWebsiteId: () => ipcRenderer.invoke('store:get-last-active-website-id'),
    setLastActiveWebsiteId: (websiteId: string | null) =>
      ipcRenderer.invoke('store:set-last-active-website-id', websiteId),

    // 窗口状态相关
    getWindowState: () => ipcRenderer.invoke('store:get-window-state'),
    setWindowState: (state: Partial<WindowState>) =>
      ipcRenderer.invoke('store:set-window-state', state),

    // 设置相关
    getSettings: () => ipcRenderer.invoke('store:get-settings'),
    updateSettings: (updates: Partial<Settings>) =>
      ipcRenderer.invoke('store:update-settings', updates),

    // 清除数据相关
    clearAll: () => ipcRenderer.invoke('store:clear-all'),
    resetToDefaults: (defaultGroups: PrimaryGroup[]) =>
      ipcRenderer.invoke('store:reset-to-defaults', defaultGroups)
  },

  // 扩展相关 API
  extension: {
    getAll: () => ipcRenderer.invoke('extension:getAll'),
    add: (path: string) => ipcRenderer.invoke('extension:add', path),
    remove: (id: string) => ipcRenderer.invoke('extension:remove', id),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('extension:toggle', id, enabled),
    validate: (path: string) => ipcRenderer.invoke('extension:validate', path),
    getLoaded: () => ipcRenderer.invoke('extension:getLoaded'),
    getSettings: () => ipcRenderer.invoke('extension:getSettings'),
    updateSettings: (settings: { enableExtensions?: boolean; autoLoadExtensions?: boolean }) =>
      ipcRenderer.invoke('extension:updateSettings', settings),
    // 新增的增强功能API
    getErrorStats: () => ipcRenderer.invoke('extension:getErrorStats'),
    getPermissionStats: () => ipcRenderer.invoke('extension:getPermissionStats'),
    clearErrorHistory: () => ipcRenderer.invoke('extension:clearErrorHistory'),
    getWithPermissions: (id: string) => ipcRenderer.invoke('extension:getWithPermissions', id),
    updatePermissionSettings: (id: string, permissions: string[], allowed: boolean) =>
      ipcRenderer.invoke('extension:updatePermissionSettings', id, permissions, allowed),
    // 隔离加载和卸载扩展
    loadWithIsolation: (path: string, isolationLevel?: string) =>
      ipcRenderer.invoke('extension:loadWithIsolation', path, isolationLevel),
    unloadWithIsolation: (id: string) => ipcRenderer.invoke('extension:unloadWithIsolation', id)
  },

  // ===== 增强功能 API =====
  enhanced: {
    // 浏览器指纹伪装
    fingerprint: {
      generate: (options?: Record<string, unknown>) =>
        ipcRenderer.invoke('fingerprint:generate', options),
      applyToWebsite: (websiteId: string) =>
        ipcRenderer.invoke('fingerprint:apply-to-website', websiteId),
      clear: (websiteId: string) => ipcRenderer.invoke('fingerprint:clear', websiteId),
      refresh: (options?: Record<string, unknown>) =>
        ipcRenderer.invoke('fingerprint:refresh', options),
      clearCache: () => ipcRenderer.invoke('fingerprint:clear-cache'),
      getCacheStats: () => ipcRenderer.invoke('fingerprint:get-cache-stats')
    },

    // 全局快捷键
    shortcut: {
      register: (shortcut: string, action: string) =>
        ipcRenderer.invoke('shortcut:register', shortcut, action),
      unregister: (shortcut: string) => ipcRenderer.invoke('shortcut:unregister', shortcut),
      getAll: () => ipcRenderer.invoke('shortcut:get-all'),
      enableAll: () => ipcRenderer.invoke('shortcut:enable-all'),
      disableAll: () => ipcRenderer.invoke('shortcut:disable-all')
    },

    // 系统托盘
    tray: {
      create: (options?: Record<string, unknown>) => ipcRenderer.invoke('tray:create', options),
      destroy: () => ipcRenderer.invoke('tray:destroy'),
      setTooltip: (tooltip: string) => ipcRenderer.invoke('tray:set-tooltip', tooltip),
      setContextMenu: (menuItems: unknown[]) =>
        ipcRenderer.invoke('tray:set-context-menu', menuItems)
    },

    // 窗口边缘吸附
    windowAdsorption: {
      enable: () => ipcRenderer.invoke('window-adsorption:enable'),
      disable: () => ipcRenderer.invoke('window-adsorption:disable'),
      isEnabled: () => ipcRenderer.invoke('window-adsorption:is-enabled'),
      setSensitivity: (sensitivity: number) =>
        ipcRenderer.invoke('window-adsorption:set-sensitivity', sensitivity)
    },

    // 内存优化
    memoryOptimizer: {
      start: () => ipcRenderer.invoke('memory-optimizer:start'),
      stop: () => ipcRenderer.invoke('memory-optimizer:stop'),
      cleanInactive: () => ipcRenderer.invoke('memory-optimizer:clean-inactive'),
      getStats: () => ipcRenderer.invoke('memory-optimizer:get-stats')
    },

    // 数据同步
    dataSync: {
      exportConfig: (options?: Record<string, unknown>) =>
        ipcRenderer.invoke('data-sync:export-config', options),
      importConfig: (filePath: string) => ipcRenderer.invoke('data-sync:import-config', filePath),
      exportCookies: (websiteId?: string) =>
        ipcRenderer.invoke('data-sync:export-cookies', websiteId),
      importCookies: (filePath: string, websiteId?: string) =>
        ipcRenderer.invoke('data-sync:import-cookies', filePath, websiteId)
    },

    // 自动启动
    autoLaunch: {
      enable: (args?: string[]) => ipcRenderer.invoke('auto-launch:enable', args),
      disable: () => ipcRenderer.invoke('auto-launch:disable'),
      isEnabled: () => ipcRenderer.invoke('auto-launch:is-enabled'),
      toggle: () => ipcRenderer.invoke('auto-launch:toggle'),
      getSettings: () => ipcRenderer.invoke('auto-launch:get-settings'),
      setHidden: (hidden: boolean) => ipcRenderer.invoke('auto-launch:set-hidden', hidden),
      setArgs: (args: string[]) => ipcRenderer.invoke('auto-launch:set-args', args),
      wasLaunchedAtLogin: () => ipcRenderer.invoke('auto-launch:was-launched-at-login'),
      wasLaunchedAsHidden: () => ipcRenderer.invoke('auto-launch:was-launched-as-hidden'),
      getSupportedSettings: () => ipcRenderer.invoke('auto-launch:get-supported-settings'),
      validateArgs: (args: string[]) => ipcRenderer.invoke('auto-launch:validate-args', args),
      getDefaultArgs: () => ipcRenderer.invoke('auto-launch:get-default-args'),
      getStatusReport: () => ipcRenderer.invoke('auto-launch:get-status-report'),
      getEnvironmentInfo: () => ipcRenderer.invoke('auto-launch:get-environment-info')
    },

    // JS 代码注入
    jsInjector: {
      inject: (websiteId: string, code: string) =>
        ipcRenderer.invoke('js-injector:inject', websiteId, code),
      remove: (websiteId: string, injectionId: string) =>
        ipcRenderer.invoke('js-injector:remove', websiteId, injectionId),
      getAll: (websiteId: string) => ipcRenderer.invoke('js-injector:get-all', websiteId)
    },

    // 代理支持
    proxy: {
      setForWebsite: (websiteId: string, proxyRules: string) =>
        ipcRenderer.invoke('proxy:set-for-website', websiteId, proxyRules),
      clearForWebsite: (websiteId: string) =>
        ipcRenderer.invoke('proxy:clear-for-website', websiteId),
      testConnection: (proxyRules: string, testUrl?: string) =>
        ipcRenderer.invoke('proxy:test-connection', proxyRules, testUrl)
    },

    // 系统主题切换
    theme: {
      set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
      getCurrent: () => ipcRenderer.invoke('theme:get-current'),
      toggle: () => ipcRenderer.invoke('theme:toggle')
    },

    // 窗口管理
    windowManager: {
      toggleAlwaysOnTop: () => ipcRenderer.invoke('window-manager:toggle-always-on-top'),
      toggleMiniMode: () => ipcRenderer.invoke('window-manager:toggle-mini-mode'),
      snapToEdge: (edge: 'left' | 'right' | 'top' | 'bottom') =>
        ipcRenderer.invoke('window-manager:snap-to-edge', edge),
      getState: () => ipcRenderer.invoke('window-manager:get-state')
    },

    // 扩展增强
    extensionEnhancer: {
      register: (extension: Record<string, unknown>) =>
        ipcRenderer.invoke('extension-enhancer:register', extension),
      enable: (extensionId: string) => ipcRenderer.invoke('extension-enhancer:enable', extensionId),
      disable: (extensionId: string) =>
        ipcRenderer.invoke('extension-enhancer:disable', extensionId),
      getStats: () => ipcRenderer.invoke('extension-enhancer:get-stats')
    },

    // 版本检查
    versionChecker: {
      checkUpdate: (force?: boolean) => ipcRenderer.invoke('version-checker:check-update', force),
      downloadUpdate: () => ipcRenderer.invoke('version-checker:download-update'),
      installUpdate: () => ipcRenderer.invoke('version-checker:install-update'),
      getVersionInfo: () => ipcRenderer.invoke('version-checker:get-version-info')
    },

    // Session 隔离
    sessionIsolation: {
      create: (websiteId: string) => ipcRenderer.invoke('session-isolation:create', websiteId),
      clear: (websiteId: string) => ipcRenderer.invoke('session-isolation:clear', websiteId),
      exportCookies: (websiteId: string) =>
        ipcRenderer.invoke('session-isolation:export-cookies', websiteId),
      importCookies: (websiteId: string, cookies: unknown[]) =>
        ipcRenderer.invoke('session-isolation:import-cookies', websiteId, cookies)
    },

    // 进程崩溃处理
    crashHandler: {
      getStats: () => ipcRenderer.invoke('crash-handler:get-stats'),
      clearReports: () => ipcRenderer.invoke('crash-handler:clear-reports'),
      sendReport: (reportId: string) => ipcRenderer.invoke('crash-handler:send-report', reportId)
    },

    // 通用功能
    getAllFeatures: () => ipcRenderer.invoke('enhanced:get-all-features'),
    enableAll: () => ipcRenderer.invoke('enhanced:enable-all'),
    disableAll: () => ipcRenderer.invoke('enhanced:disable-all')
  }
}
