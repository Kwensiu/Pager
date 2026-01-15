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

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      ipcRenderer: {
        on: (channel: string, listener: (...args: any[]) => void) => void
        removeAllListeners: (channel: string) => void
        send: (channel: string, ...args: any[]) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
      }
      webview: {
        loadUrl: (url: string) => void
        hide: () => void
        getUrl: () => Promise<string | null>
        reload: () => void
        goBack: () => void
        goForward: () => void
        showContextMenu: (params: Electron.ContextMenuParams) => void
      }
      window: {
        resize: () => void
        openDevTools: () => void
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
          register: (shortcut: string, action: string) => Promise<boolean>
          unregister: (shortcut: string) => Promise<boolean>
          getAll: () => Promise<Array<{ shortcut: string; action: string }>>
          enableAll: () => Promise<void>
          disableAll: () => Promise<void>
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
          cleanInactive: () => Promise<number>
          getStats: () => Promise<{
            totalCleaned: number
            lastCleanTime: number | null
            isRunning: boolean
          }>
        }
        // 数据同步
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
          toggleAlwaysOnTop: () => Promise<void>
          toggleMiniMode: () => Promise<void>
          snapToEdge: (edge: 'left' | 'right' | 'top' | 'bottom') => Promise<void>
          getState: () => Promise<{
            alwaysOnTop: boolean
            miniMode: boolean
            position: { x: number; y: number }
            size: { width: number; height: number }
          }>
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
            currentVersion: string
            electronVersion: string
            chromeVersion: string
            nodeVersion: string
          }>
        }
        // Session 隔离
        sessionIsolation: {
          create: (websiteId: string) => Promise<string>
          clear: (websiteId: string) => Promise<boolean>
          exportCookies: (websiteId: string) => Promise<unknown[]>
          importCookies: (websiteId: string, cookies: unknown[]) => Promise<number>
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
    }
  }
}
