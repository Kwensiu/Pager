import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../main/types/store'

const PRELOAD_IPC_ON_CHANNELS = new Set([
  'webview:navigate-back',
  'webview:navigate-forward',
  'webview:reload',
  'webview:reload-force',
  'webview:copy',
  'webview:paste',
  'webview:select-all',
  'webview:view-source',
  'webview:inspect-element',
  'webview:load-url'
])
const PRELOAD_IPC_SEND_CHANNELS = new Set(['webview:load-url'])
const PRELOAD_IPC_INVOKE_CHANNELS = new Set(['webview:load-url'])

function isAllowedPreloadIpcChannel(allowedChannels: Set<string>, channel: string): boolean {
  return typeof channel === 'string' && allowedChannels.has(channel)
}

function logBlockedPreloadIpc(
  method: 'on' | 'removeListener' | 'removeAllListeners' | 'send' | 'invoke',
  channel: string
): void {
  console.warn(`[preload] Blocked ipcRenderer.${method} on channel: ${channel}`)
}

type PreloadIpcListener = (...args: unknown[]) => void
type WrappedPreloadIpcListener = (_event: IpcRendererEvent, ...args: unknown[]) => void

const preloadIpcListenerMap = new Map<
  string,
  Map<PreloadIpcListener, WrappedPreloadIpcListener[]>
>()

function trackPreloadIpcListener(
  channel: string,
  listener: PreloadIpcListener,
  wrappedListener: WrappedPreloadIpcListener
): void {
  const channelListeners = preloadIpcListenerMap.get(channel) ?? new Map()
  const wrappedListeners = channelListeners.get(listener) ?? []
  wrappedListeners.push(wrappedListener)
  channelListeners.set(listener, wrappedListeners)
  preloadIpcListenerMap.set(channel, channelListeners)
}

function takeTrackedPreloadIpcListeners(
  channel: string,
  listener: PreloadIpcListener
): WrappedPreloadIpcListener[] {
  const channelListeners = preloadIpcListenerMap.get(channel)
  if (!channelListeners) {
    return []
  }

  const wrappedListeners = channelListeners.get(listener) ?? []
  channelListeners.delete(listener)
  if (channelListeners.size === 0) {
    preloadIpcListenerMap.delete(channel)
  }

  return wrappedListeners
}

function clearTrackedPreloadIpcChannel(channel: string): void {
  preloadIpcListenerMap.delete(channel)
}

function normalizeExtensionOptionsTarget(
  extensionIdOrUrl: string,
  optionsPath?: string
): [string, string?] {
  if (typeof extensionIdOrUrl === 'string' && extensionIdOrUrl.startsWith('chrome-extension://')) {
    try {
      const parsedUrl = new URL(extensionIdOrUrl)
      const parsedPath = parsedUrl.pathname.replace(/^\/+/, '')
      return [parsedUrl.hostname, parsedPath || optionsPath]
    } catch {
      return [extensionIdOrUrl, optionsPath]
    }
  }

  return [extensionIdOrUrl, optionsPath]
}

export const api = {
  // 暴露 ipcRenderer 用于监听事件
  ipcRenderer: {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!isAllowedPreloadIpcChannel(PRELOAD_IPC_ON_CHANNELS, channel)) {
        logBlockedPreloadIpc('on', channel)
        return
      }

      const wrappedListener: WrappedPreloadIpcListener = (_event, ...args) => listener(...args)
      trackPreloadIpcListener(channel, listener, wrappedListener)
      ipcRenderer.on(channel, wrappedListener)
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!isAllowedPreloadIpcChannel(PRELOAD_IPC_ON_CHANNELS, channel)) {
        logBlockedPreloadIpc('removeListener', channel)
        return
      }

      const wrappedListeners = takeTrackedPreloadIpcListeners(channel, listener)
      for (const wrappedListener of wrappedListeners) {
        ipcRenderer.removeListener(channel, wrappedListener)
      }
    },
    removeAllListeners: (channel: string) => {
      if (!isAllowedPreloadIpcChannel(PRELOAD_IPC_ON_CHANNELS, channel)) {
        logBlockedPreloadIpc('removeAllListeners', channel)
        return
      }

      clearTrackedPreloadIpcChannel(channel)
      ipcRenderer.removeAllListeners(channel)
    },
    send: (channel: string, ...args: unknown[]) => {
      if (!isAllowedPreloadIpcChannel(PRELOAD_IPC_SEND_CHANNELS, channel)) {
        logBlockedPreloadIpc('send', channel)
        return
      }
      ipcRenderer.send(channel, ...args)
    },
    invoke: (channel: string, ...args: unknown[]) => {
      if (!isAllowedPreloadIpcChannel(PRELOAD_IPC_INVOKE_CHANNELS, channel)) {
        logBlockedPreloadIpc('invoke', channel)
        return Promise.reject(new Error(`Blocked ipcRenderer.invoke channel: ${channel}`))
      }
      return ipcRenderer.invoke(channel, ...args)
    }
  },

  // 会话管理 - 直接添加到主 API 对象
  session: {
    addOrUpdate: (websiteId: string, url: string, title: string) =>
      ipcRenderer.invoke('session:add-update', websiteId, url, title),
    remove: (websiteId: string) => ipcRenderer.invoke('session:remove', websiteId),
    getAll: () => ipcRenderer.invoke('session:get-all'),
    get: (websiteId: string) => ipcRenderer.invoke('session:get', websiteId),
    clearAll: () => ipcRenderer.invoke('session:clear-all'),
    getStats: () => ipcRenderer.invoke('session:get-stats')
  },

  // Shell 相关 API
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
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
    unloadWithIsolation: (id: string) => ipcRenderer.invoke('extension:unloadWithIsolation', id),
    // 配置页面相关
    createConfigPage: (
      extensionId: string,
      extensionName: string,
      extensionPath: string,
      manifest: Record<string, unknown>
    ) =>
      ipcRenderer.invoke(
        'extension:create-config-page',
        extensionId,
        extensionName,
        extensionPath,
        manifest
      ),
    // 获取扩展目录中的文件列表
    getFiles: (extensionId: string) => ipcRenderer.invoke('extension:get-files', extensionId)
  },

  // WebView 相关 API
  webview: {
    loadUrl: (url: string) => ipcRenderer.send('webview:load-url', url),
    hide: () => ipcRenderer.send('webview:hide'),
    getUrl: () => ipcRenderer.invoke('webview:get-url'),
    reload: () => ipcRenderer.send('webview:reload'),
    goBack: () => ipcRenderer.send('webview:go-back'),
    goForward: () => ipcRenderer.send('webview:go-forward'),
    showContextMenu: (params: Electron.ContextMenuParams) =>
      ipcRenderer.send('webview:show-context-menu', params),
    createExtensionOptions: (url: string, title: string) =>
      ipcRenderer.invoke('window:create-extension-options', url, title),
    openExtensionOptionsInMain: (extensionIdOrUrl: string, optionsPath?: string) => {
      const [extensionId, normalizedOptionsPath] = normalizeExtensionOptionsTarget(
        extensionIdOrUrl,
        optionsPath
      )
      return ipcRenderer.invoke(
        'window:open-extension-options-in-main',
        extensionId,
        normalizedOptionsPath
      )
    }
  },

  // 崩溃模拟
  crash: {
    simulateCrash: () => ipcRenderer.invoke('crash:simulate')
  },

  // 窗口管理
  window: {
    resize: () => ipcRenderer.send('window:resize'),
    openDevTools: () => ipcRenderer.send('window:open-dev-tools'),
    loadExtensionUrl: (url: string) => ipcRenderer.invoke('window:load-extension-url', url),
    openExtensionInNewWindow: (url: string, title?: string) =>
      ipcRenderer.invoke('window:open-extension-in-new-window', url, title)
  },

  // 对话框 API
  dialog: {
    openDirectory: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:open-directory', options),
    openFile: (options?: Electron.OpenDialogOptions) =>
      ipcRenderer.invoke('dialog:open-file', options)
  },

  // 获取网站图标
  getFavicon: (url: string, options?: { force?: boolean }) =>
    ipcRenderer.invoke('get-favicon', url, options),

  // 批量预加载网站图标
  preloadFavicons: (urls: string[], priority?: string[]) =>
    ipcRenderer.invoke('preload-favicons', urls, priority),

  // 获取 favicon 缓存统计信息
  getFaviconStats: () => ipcRenderer.invoke('get-favicon-stats'),

  // 清理 favicon 缓存
  clearFaviconCache: () => ipcRenderer.invoke('clear-favicon-cache'),

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
    bridgeLegacyRendererState: (payload: {
      hasInitialized?: boolean
      settings?: { theme?: string; sidebarOpen?: boolean }
    }) => ipcRenderer.invoke('store:bridge-legacy-renderer-state', payload),

    // 清除数据相关
    clearAll: () => ipcRenderer.invoke('store:clear-all'),
    resetToDefaults: (defaultGroups: PrimaryGroup[]) =>
      ipcRenderer.invoke('store:reset-to-defaults', defaultGroups),
    // 获取数据路径
    getDataPath: () => ipcRenderer.invoke('store:get-data-path')
  },

  // ===== 增强功能 API =====
  enhanced: {
    // 文件系统操作
    fs: {
      readFile: (filePath: string) => ipcRenderer.invoke('fs:read-file', filePath)
    },
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

    // 系统托盘
    tray: {
      create: (options?: Record<string, unknown>) => ipcRenderer.invoke('tray:create', options),
      destroy: () => ipcRenderer.invoke('tray:destroy'),
      setTooltip: (tooltip: string) => ipcRenderer.invoke('tray:set-tooltip', tooltip),
      setContextMenu: (menuItems: unknown[]) =>
        ipcRenderer.invoke('tray:set-context-menu', menuItems)
    },

    // 内存优化
    memoryOptimizer: {
      start: () => ipcRenderer.invoke('memory-optimizer:start'),
      stop: () => ipcRenderer.invoke('memory-optimizer:stop'),
      cleanInactive: () => ipcRenderer.invoke('memory-optimizer:clean-inactive'),
      getStats: () => ipcRenderer.invoke('memory-optimizer:get-stats'),
      markActive: (websiteId: string) =>
        ipcRenderer.invoke('memory-optimizer:mark-active', websiteId),
      removeWebsite: (websiteId: string) =>
        ipcRenderer.invoke('memory-optimizer:remove-website', websiteId),
      getCurrentMemory: () => ipcRenderer.invoke('memory-optimizer:get-current-memory'),
      setThreshold: (mb: number) => ipcRenderer.invoke('memory-optimizer:set-threshold', mb)
    },

    // 数据导入导出
    dataSync: {
      exportConfig: (options?: Record<string, unknown>) =>
        ipcRenderer.invoke('data-sync:export-config', options),
      exportData: (data: Record<string, unknown>) =>
        ipcRenderer.invoke('data-sync:export-data', data),
      importConfig: (filePath: string) => ipcRenderer.invoke('data-sync:import-config', filePath),
      exportCookies: (websiteId: string, partition: string) =>
        ipcRenderer.invoke('data-sync:export-cookies', websiteId, partition),
      importCookies: (websiteId: string, partition: string, cookies: Record<string, unknown>[]) =>
        ipcRenderer.invoke('data-sync:import-cookies', websiteId, partition, cookies)
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
      getAll: (websiteId: string) => ipcRenderer.invoke('js-injector:get-all', websiteId),
      getWebsiteJsCode: (websiteId: string) =>
        ipcRenderer.invoke('js-injector:get-website-jscode', websiteId),
      injectCode: (code: string) => ipcRenderer.invoke('js-injector:inject-code', code),
      executeScript: (script: string) => ipcRenderer.invoke('js-injector:execute-script', script)
    },

    // 代理支持
    proxy: {
      setForWebsite: (websiteId: string, proxyRules: string) =>
        ipcRenderer.invoke('proxy:set-for-website', websiteId, proxyRules),
      clearForWebsite: (websiteId: string) =>
        ipcRenderer.invoke('proxy:clear-for-website', websiteId),
      testConnection: (proxyRules: string, testUrl?: string) =>
        ipcRenderer.invoke('proxy:test-connection', proxyRules, testUrl),
      getCurrentSettings: () => ipcRenderer.invoke('proxy:get-current-settings')
    },

    // 系统主题切换
    theme: {
      set: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),
      getCurrent: () => ipcRenderer.invoke('theme:get-current'),
      toggle: () => ipcRenderer.invoke('theme:toggle')
    },

    // 窗口管理
    windowManager: {
      toggleWindow: () => ipcRenderer.invoke('window-manager:toggle-window'),
      toggleAlwaysOnTop: () => ipcRenderer.invoke('window-manager:toggle-always-on-top'),
      toggleMiniMode: () => ipcRenderer.invoke('window-manager:toggle-mini-mode'),
      snapToEdge: (edge: 'left' | 'right' | 'top' | 'bottom') =>
        ipcRenderer.invoke('window-manager:snap-to-edge', edge),
      getState: () => ipcRenderer.invoke('window-manager:get-state'),
      minimizeWindow: () => ipcRenderer.invoke('window-manager:minimize-window'),
      maximizeWindow: () => ipcRenderer.invoke('window-manager:maximize-window'),
      exitApp: () => ipcRenderer.invoke('window-manager:exit-app')
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

    // 会话管理
    session: {
      addOrUpdate: (websiteId: string, url: string, title: string) =>
        ipcRenderer.invoke('session:add-update', websiteId, url, title),
      remove: (websiteId: string) => ipcRenderer.invoke('session:remove', websiteId),
      getAll: () => ipcRenderer.invoke('session:get-all'),
      get: (websiteId: string) => ipcRenderer.invoke('session:get', websiteId),
      clearAll: () => ipcRenderer.invoke('session:clear-all'),
      getStats: () => ipcRenderer.invoke('session:get-stats')
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
  },

  // 存储相关 API - 用于跨 WebView 共享数据
  storage: {
    getItem: (key: string) => ipcRenderer.invoke('storage:get-item', key),
    setItem: (key: string, value: string) => ipcRenderer.invoke('storage:set-item', key, value),
    removeItem: (key: string) => ipcRenderer.invoke('storage:remove-item', key),
    clear: () => ipcRenderer.invoke('storage:clear'),
    getAll: () => ipcRenderer.invoke('storage:get-all')
  }
}
