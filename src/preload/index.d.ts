import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../main/types/store'
import type { ExtensionInfo, ExtensionManifest } from '../main/extensions/types'

// 扩展 ElectronAPI 接口
declare global {
  interface Window {
    electron: ElectronAPI & {
      shell: {
        openPath: (path: string) => Promise<{
          success: boolean
          error?: string
        }>
      }
      extension: {
        getAll: () => Promise<{ success: boolean; extensions: ExtensionInfo[]; error?: string }>
        add: (
          path: string
        ) => Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }>
        remove: (id: string) => Promise<{ success: boolean; error?: string }>
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
        validate: (
          path: string
        ) => Promise<{ valid: boolean; error?: string; manifest?: ExtensionManifest }>
        getLoaded: () => Promise<{ success: boolean; loaded: ExtensionInfo[]; error?: string }>
        getSettings: () => Promise<{
          success: boolean
          settings: { enableExtensions: boolean; autoLoadExtensions: boolean }
          error?: string
        }>
        updateSettings: (settings: {
          enableExtensions?: boolean
          autoLoadExtensions?: boolean
        }) => Promise<{ success: boolean; error?: string }>
        // 新增的增强功能API
        getErrorStats: () => Promise<{
          success: boolean
          stats?: {
            totalErrors: number
            errorsByType: Record<string, number>
            recentErrors: Array<{ type: string; message: string; timestamp: number }>
          }
          error?: string
        }>
        getPermissionStats: () => Promise<{
          success: boolean
          stats?: {
            totalExtensions: number
            totalPermissions: number
            permissionsByCategory: Record<string, number>
            permissionsByRisk: Record<string, number>
            userSettingsCount: number
          }
          error?: string
        }>
        clearErrorHistory: () => Promise<{ success: boolean; error?: string }>
        getWithPermissions: (id: string) => Promise<{
          success: boolean
          extension?: {
            id: string
            name: string
            version: string
            enabled: boolean
            manifest?: ExtensionManifest
          }
          session?: {
            id: string
            isolationLevel: string
            isActive: boolean
            memoryUsage: number
          } | null
          permissions?: { settings: string[]; riskLevel: string }
          error?: string
        }>
        updatePermissionSettings: (
          id: string,
          permissions: string[],
          allowed: boolean
        ) => Promise<{ success: boolean; error?: string }>
        // 隔离加载和卸载扩展
        loadWithIsolation: (
          path: string,
          isolationLevel?: string
        ) => Promise<{
          success: boolean
          extension?: { id: string; name: string; version: string; enabled: boolean }
          sessionId?: string
          error?: string
        }>
        unloadWithIsolation: (id: string) => Promise<{ success: boolean; error?: string }>
        // 配置页面相关
        createConfigPage: (
          extensionId: string,
          extensionName: string,
          extensionPath: string,
          manifest: ExtensionManifest
        ) => Promise<{
          success: boolean
          windowId?: string
          error?: string
        }>
        // 获取扩展目录中的文件列表
        getFiles: (extensionId: string) => Promise<{
          success: boolean
          files: string[]
          manifest?: ExtensionManifest
          error?: string
        }>
      }
    }
    api: {
      ipcRenderer: {
        on: (channel: string, listener: (...args: unknown[]) => void) => void
        removeAllListeners: (channel: string) => void
        send: (channel: string, ...args: unknown[]) => void
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
      shell: {
        openPath: (path: string) => Promise<{
          success: boolean
          error?: string
        }>
        openExternal: (url: string) => Promise<{
          success: boolean
          error?: string
        }>
      }
      extension: {
        getAll: () => Promise<{ success: boolean; extensions: ExtensionInfo[]; error?: string }>
        add: (
          path: string
        ) => Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }>
        remove: (id: string) => Promise<{ success: boolean; error?: string }>
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
        validate: (
          path: string
        ) => Promise<{ valid: boolean; error?: string; manifest?: ExtensionManifest }>
        getLoaded: () => Promise<{ success: boolean; loaded: ExtensionInfo[]; error?: string }>
        getSettings: () => Promise<{
          success: boolean
          settings: { enableExtensions: boolean; autoLoadExtensions: boolean }
          error?: string
        }>
        updateSettings: (settings: {
          enableExtensions?: boolean
          autoLoadExtensions?: boolean
        }) => Promise<{ success: boolean; error?: string }>
        // 新增的增强功能API
        getErrorStats: () => Promise<{
          success: boolean
          stats?: {
            totalErrors: number
            errorsByType: Record<string, number>
            recentErrors: Array<{ type: string; message: string; timestamp: number }>
          }
          error?: string
        }>
        getPermissionStats: () => Promise<{
          success: boolean
          stats?: {
            totalExtensions: number
            totalPermissions: number
            permissionsByCategory: Record<string, number>
            permissionsByRisk: Record<string, number>
            userSettingsCount: number
          }
          error?: string
        }>
        clearErrorHistory: () => Promise<{ success: boolean; error?: string }>
        getWithPermissions: (id: string) => Promise<{
          success: boolean
          extension?: {
            id: string
            name: string
            version: string
            enabled: boolean
            manifest?: ExtensionManifest
          }
          session?: {
            id: string
            isolationLevel: string
            isActive: boolean
            memoryUsage: number
          } | null
          permissions?: { settings: string[]; riskLevel: string }
          error?: string
        }>
        updatePermissionSettings: (
          id: string,
          permissions: string[],
          allowed: boolean
        ) => Promise<{ success: boolean; error?: string }>
        // 隔离加载和卸载扩展
        loadWithIsolation: (
          path: string,
          isolationLevel?: string
        ) => Promise<{
          success: boolean
          extension?: { id: string; name: string; version: string; enabled: boolean }
          sessionId?: string
          error?: string
        }>
        unloadWithIsolation: (id: string) => Promise<{ success: boolean; error?: string }>
        // 配置页面相关
        createConfigPage: (
          extensionId: string,
          extensionName: string,
          extensionPath: string,
          manifest: ExtensionManifest
        ) => Promise<{
          success: boolean
          windowId?: string
          error?: string
        }>
        // 获取扩展目录中的文件列表
        getFiles: (extensionId: string) => Promise<{
          success: boolean
          files: string[]
          manifest?: ExtensionManifest
          error?: string
        }>
      }
      webview: {
        loadUrl: (url: string) => void
        hide: () => void
        getUrl: () => Promise<string | null>
        reload: () => void
        goBack: () => void
        goForward: () => void
        showContextMenu: (params: Electron.ContextMenuParams) => void
        createExtensionOptions: (
          url: string,
          title: string
        ) => Promise<{
          success: boolean
          windowId?: string
        }>
        openExtensionOptionsInMain: (url: string) => Promise<{
          success: boolean
          error?: string
        }>
      }
      window: {
        resize: () => void
        openDevTools: () => void
        loadExtensionUrl: (url: string) => Promise<{
          success: boolean
          error?: string
        }>
        openExtensionInNewWindow: (
          url: string,
          title?: string
        ) => Promise<{
          success: boolean
          error?: string
        }>
      }
      dialog: {
        openDirectory: (
          options?: Electron.OpenDialogOptions
        ) => Promise<{ canceled: boolean; filePaths: string[] }>
        openFile: (
          options?: Electron.OpenDialogOptions
        ) => Promise<{ canceled: boolean; filePaths: string[] }>
      }
      getFavicon: (url: string) => Promise<string | null>
      store: {
        // 主要分组相关
        getPrimaryGroups: () => Promise<PrimaryGroup[]>
        setPrimaryGroups: (groups: PrimaryGroup[]) => Promise<void>
        clearPrimaryGroups: () => Promise<void>
        addPrimaryGroup: (group: Partial<PrimaryGroup>) => Promise<PrimaryGroup>
        updatePrimaryGroup: (
          groupId: string,
          updates: Partial<PrimaryGroup>
        ) => Promise<PrimaryGroup | null>
        deletePrimaryGroup: (groupId: string) => Promise<void>

        // 次要分组相关
        addSecondaryGroup: (
          primaryGroupId: string,
          secondaryGroup: SecondaryGroup
        ) => Promise<SecondaryGroup>
        updateSecondaryGroup: (
          secondaryGroupId: string,
          updates: Partial<SecondaryGroup>
        ) => Promise<SecondaryGroup | null>
        deleteSecondaryGroup: (secondaryGroupId: string) => Promise<boolean>

        // 网站相关
        addWebsiteToPrimary: (primaryGroupId: string, website: Website) => Promise<Website>
        addWebsiteToSecondary: (secondaryGroupId: string, website: Website) => Promise<Website>
        updateWebsite: (websiteId: string, updates: Partial<Website>) => Promise<Website | null>
        deleteWebsite: (websiteId: string) => Promise<boolean>

        // 排序相关
        updateSecondaryGroupOrder: (
          primaryGroupId: string,
          secondaryGroupIds: string[]
        ) => Promise<void>
        updateWebsiteOrder: (secondaryGroupId: string, websiteIds: string[]) => Promise<void>
        batchUpdateWebsiteOrders: (updates: WebsiteOrderUpdate[]) => Promise<void>

        // 应用状态相关
        getLastActiveWebsiteId: () => Promise<string | null>
        setLastActiveWebsiteId: (websiteId: string | null) => Promise<void>

        // 窗口状态相关
        getWindowState: () => Promise<WindowState>
        setWindowState: (state: Partial<WindowState>) => Promise<void>

        // 设置相关
        getSettings: () => Promise<Settings>
        updateSettings: (updates: Partial<Settings>) => Promise<void>

        // 清除数据相关
        clearAll: () => Promise<void>
        resetToDefaults: (defaultGroups: PrimaryGroup[]) => Promise<void>
        // 获取数据路径
        getDataPath: () => Promise<{ success: boolean; path?: string; error?: string }>
      }
      extension: {
        getAll: () => Promise<{ success: boolean; extensions: ExtensionInfo[]; error?: string }>
        add: (
          path: string
        ) => Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }>
        remove: (id: string) => Promise<{ success: boolean; error?: string }>
        toggle: (id: string, enabled: boolean) => Promise<{ success: boolean; error?: string }>
        validate: (
          path: string
        ) => Promise<{ valid: boolean; error?: string; manifest?: ExtensionManifest }>
        getLoaded: () => Promise<{ success: boolean; loaded: ExtensionInfo[]; error?: string }>
        getSettings: () => Promise<{
          success: boolean
          settings: { enableExtensions: boolean; autoLoadExtensions: boolean }
          error?: string
        }>
        updateSettings: (settings: {
          enableExtensions?: boolean
          autoLoadExtensions?: boolean
        }) => Promise<{ success: boolean; error?: string }>
        // 新增的增强功能API
        getErrorStats: () => Promise<{
          success: boolean
          stats?: {
            totalErrors: number
            errorsByType: Record<string, number>
            recentErrors: Array<{ type: string; message: string; timestamp: number }>
          }
          error?: string
        }>
        getPermissionStats: () => Promise<{
          success: boolean
          stats?: {
            totalExtensions: number
            totalPermissions: number
            permissionsByCategory: Record<string, number>
            permissionsByRisk: Record<string, number>
            userSettingsCount: number
          }
          error?: string
        }>
        clearErrorHistory: () => Promise<{ success: boolean; error?: string }>
        getWithPermissions: (id: string) => Promise<{
          success: boolean
          extension?: {
            id: string
            name: string
            version: string
            enabled: boolean
            manifest?: ExtensionManifest
          }
          session?: {
            id: string
            isolationLevel: string
            isActive: boolean
            memoryUsage: number
          } | null
          permissions?: { settings: string[]; riskLevel: string }
          error?: string
        }>
        updatePermissionSettings: (
          id: string,
          permissions: string[],
          allowed: boolean
        ) => Promise<{ success: boolean; error?: string }>
        // 隔离加载和卸载扩展
        loadWithIsolation: (
          path: string,
          isolationLevel?: string
        ) => Promise<{
          success: boolean
          extension?: { id: string; name: string; version: string; enabled: boolean }
          sessionId?: string
          error?: string
        }>
        unloadWithIsolation: (id: string) => Promise<{ success: boolean; error?: string }>
      }
      // ===== 增强功能 API =====
      enhanced: {
        // 浏览器指纹伪装
        fingerprint: {
          generate: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>
          applyToWebsite: (websiteId: string) => Promise<boolean>
          clear: (websiteId: string) => Promise<boolean>
          refresh: (options?: Record<string, unknown>) => Promise<{ success: boolean }>
          clearCache: () => Promise<{ success: boolean }>
          getCacheStats: () => Promise<{ size: number; keys: string[] }>
        }
        // 全局快捷键
        shortcut: {
          register: (
            shortcut: import('../shared/types/store').Shortcut
          ) => Promise<{ success: boolean; message?: string }>
          unregister: (cmd: string) => Promise<{ success: boolean; message?: string }>
          getAll: () => Promise<import('../shared/types/store').Shortcut[]>
          enableAll: () => Promise<{
            success: boolean
            message?: string
            successCount?: number
            totalCount?: number
          }>
          disableAll: () => Promise<{ success: boolean; message?: string }>
          update: (
            shortcut: import('../shared/types/store').Shortcut
          ) => Promise<{ success: boolean; message?: string }>
          validate: (cmd: string) => Promise<{ valid: boolean; message?: string }>
          getDefaults: () => Promise<import('../shared/types/store').Shortcut[]>
          checkConflict: (
            cmd: string,
            excludeId?: string
          ) => Promise<{
            hasConflict: boolean
            conflict: import('../shared/types/store').Shortcut | null
          }>
          getAllConflicts: (shortcuts: import('../shared/types/store').Shortcut[]) => Promise<{
            hasConflicts: boolean
            conflicts: Array<{
              shortcut: import('../shared/types/store').Shortcut
              conflicts: import('../shared/types/store').Shortcut[]
            }>
          }>
        }
        // 系统托盘
        tray: {
          create: (options?: Record<string, unknown>) => Promise<boolean>
          destroy: () => Promise<void>
          setTooltip: (tooltip: string) => Promise<void>
          setContextMenu: (menuItems: unknown[]) => Promise<void>
        }
        // 窗口边缘吸附
        windowAdsorption: {
          enable: () => Promise<void>
          disable: () => Promise<void>
          isEnabled: () => Promise<boolean>
          setSensitivity: (sensitivity: number) => Promise<void>
        }
        // 内存优化
        memoryOptimizer: {
          start: () => Promise<void>
          stop: () => Promise<void>
          cleanInactive: () => Promise<string[]>
          getStats: () => Promise<{
            activeCount: number
            inactiveCount: number
            totalCount: number
            optimizationEnabled: boolean
            inactiveThreshold: number
            cleanupInterval: number
            gcInterval: number
            memoryMonitorInterval: number
            memoryThreshold: number
            currentMemoryUsage?: { workingSetSize: number; privateBytes: number }
          }>
          markActive: (websiteId: string) => Promise<void>
          removeWebsite: (websiteId: string) => Promise<void>
          getCurrentMemory: () => Promise<{
            workingSetSize: number
            privateBytes: number
          } | null>
          setThreshold: (mb: number) => Promise<void>
        }
        // 数据导入导出
        dataSync: {
          exportConfig: (options?: Record<string, unknown>) => Promise<Record<string, unknown>>
          importConfig: (filePath: string) => Promise<boolean>
          exportCookies: (websiteId?: string) => Promise<Record<string, unknown>>
          importCookies: (filePath: string, websiteId?: string) => Promise<number>
        }
        // 自动启动
        autoLaunch: {
          enable: (args?: string[]) => Promise<boolean>
          disable: () => Promise<boolean>
          isEnabled: () => Promise<boolean>
          toggle: () => Promise<boolean>
          getSettings: () => Promise<Electron.LoginItemSettings>
          setHidden: (hidden: boolean) => Promise<boolean>
          setArgs: (args: string[]) => Promise<boolean>
          wasLaunchedAtLogin: () => Promise<boolean>
          wasLaunchedAsHidden: () => Promise<boolean>
          getSupportedSettings: () => Promise<{
            supportsOpenAtLogin: boolean
            supportsOpenAsHidden: boolean
            supportsArgs: boolean
          }>
          validateArgs: (args: string[]) => Promise<{
            valid: boolean
            errors: string[]
          }>
          getDefaultArgs: () => Promise<string[]>
          getStatusReport: () => Promise<{
            enabled: boolean
            hidden: boolean
            hasArgs: boolean
            wasLaunchedAtLogin: boolean
            wasLaunchedAsHidden: boolean
            supportedSettings: {
              openAtLogin: boolean
              openAsHidden: boolean
              args: boolean
            }
          }>
          getEnvironmentInfo: () => Promise<{
            platform: string
            isDev: boolean
            isSupported: boolean
            electronVersion: string
          }>
        }
        // JS 代码注入
        jsInjector: {
          inject: (websiteId: string, code: string) => Promise<string>
          remove: (websiteId: string, injectionId: string) => Promise<boolean>
          getAll: (websiteId: string) => Promise<Array<{ id: string; code: string }>>
          getWebsiteJsCode: (websiteId: string) => Promise<Array<{ id: string; code: string }>>
        }
        // 代理支持
        proxy: {
          setForWebsite: (websiteId: string, proxyRules: string) => Promise<boolean>
          clearForWebsite: (websiteId: string) => Promise<boolean>
          testConnection: (
            proxyRules: string,
            testUrl?: string
          ) => Promise<{
            success: boolean
            latency?: number
            error?: string
          }>
        }
        // 系统主题切换
        theme: {
          set: (theme: 'light' | 'dark' | 'system') => Promise<void>
          getCurrent: () => Promise<'light' | 'dark' | 'system'>
          toggle: () => Promise<void>
        }
        // 窗口管理
        windowManager: {
          toggleWindow: () => Promise<void>
          toggleAlwaysOnTop: () => Promise<void>
          toggleMiniMode: () => Promise<void>
          snapToEdge: (edge: 'left' | 'right' | 'top' | 'bottom') => Promise<void>
          getState: () => Promise<{
            alwaysOnTop: boolean
            miniMode: boolean
            position: { x: number; y: number }
            size: { width: number; height: number }
          }>
          minimizeWindow: () => Promise<void>
          maximizeWindow: () => Promise<void>
          exitApp: () => Promise<void>
        }
        // 扩展增强
        extensionEnhancer: {
          register: (extension: Record<string, unknown>) => Promise<string>
          enable: (extensionId: string) => Promise<boolean>
          disable: (extensionId: string) => Promise<boolean>
          getStats: () => Promise<{
            totalExtensions: number
            enabledCount: number
            disabledCount: number
          }>
        }
        // 版本检查
        versionChecker: {
          checkUpdate: (force?: boolean) => Promise<{
            available: boolean
            latestVersion?: string
            releaseNotes?: string
            error?: string
          }>
          downloadUpdate: () => Promise<{ success: boolean; error?: string }>
          installUpdate: () => Promise<{ success: boolean; error?: string }>
          getVersionInfo: () => Promise<{
            appVersion: string
            electronVersion: string
            chromeVersion: string
            nodeVersion: string
          }>
        }
        // Session 隔离
        sessionIsolation: {
          create: (websiteId: string) => Promise<string>
          clear: (websiteId: string) => Promise<boolean>
          exportCookies: (websiteId: string) => Promise<Electron.Cookie[]>
          importCookies: (websiteId: string, cookies: Electron.Cookie[]) => Promise<number>
        }

        // 会话管理
        session: {
          addOrUpdate: (websiteId: string, url: string, title: string) => Promise<void>
          remove: (websiteId: string) => Promise<void>
          getAll: () => Promise<
            Array<{ url: string; title: string; timestamp: number; websiteId?: string }>
          >
          get: (
            websiteId: string
          ) => Promise<
            { url: string; title: string; timestamp: number; websiteId?: string } | undefined
          >
          clearAll: () => Promise<void>
          getStats: () => Promise<{ totalSessions: number; lastSaved: number }>
        }
        // 进程崩溃处理
        crashHandler: {
          getStats: () => Promise<{
            totalCrashes: number
            lastCrashTime: number | null
            reports: Array<{ id: string; timestamp: number; type: string }>
          }>
          clearReports: () => Promise<void>
          sendReport: (reportId: string) => Promise<boolean>
        }
        // 通用功能
        getAllFeatures: () => Promise<Record<string, boolean>>
        enableAll: () => Promise<void>
        disableAll: () => Promise<void>
      }
      // 存储相关 API - 用于跨 WebView 共享数据
      storage: {
        getItem: (key: string) => Promise<string | null>
        setItem: (key: string, value: string) => Promise<boolean>
        removeItem: (key: string) => Promise<boolean>
        clear: () => Promise<boolean>
        getAll: () => Promise<Record<string, string>>
      }
      // 崩溃模拟
      crash: {
        simulateCrash: () => Promise<void>
      }
    }
  }

  declare global {
    interface Window {
      electron: ElectronAPI
      api: API
    }
  }
}
