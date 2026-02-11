// 共享的 Store 数据类型定义
// 此文件被 main 和 renderer 层共享使用

export interface Website {
  id: string
  name: string
  url: string
  icon?: string
  favicon?: string
  description?: string
  order?: number
  createdAt?: number
  updatedAt?: number
  // 新增字段 - tuboshu 功能
  jsCode?: string[] // 自定义 JS 代码注入
  proxy?: string // 代理设置
  partition?: string // Session 分区名称
  lastAccessTime?: number // 最后访问时间（用于内存优化）
  isOpen?: boolean // 是否在侧边栏中打开
  // 指纹伪装设置
  fingerprintEnabled?: boolean // 是否启用指纹伪装
  fingerprintMode?: 'basic' | 'balanced' | 'advanced' // 指纹伪装模式
}

export interface SecondaryGroup {
  id: string
  name: string
  websites: Website[]
  order?: number
  primaryGroupId?: string
  expanded?: boolean
  createdAt?: number
  updatedAt?: number
}

export interface PrimaryGroup {
  id: string
  name: string
  secondaryGroups: SecondaryGroup[]
  websites?: Website[]
  order?: number
  expanded?: boolean
  createdAt?: number
  updatedAt?: number
}

export interface WindowState {
  width: number
  height: number
  x: number | null
  y: number | null
  maximized: boolean
  // 新增字段
  alwaysOnTop?: boolean
  minimized?: boolean
}

export interface Settings {
  theme: 'light' | 'dark' // 删除 system 选项，窗口固定为深色
  showDebugOptions: boolean
  // 新增字段 - tuboshu 功能
  isAutoLaunch?: boolean // 开机自启动
  isMenuVisible?: boolean // 侧边栏可见性
  isMemoryOptimizationEnabled?: boolean // 内存优化
  isOpenDevTools?: boolean // 开发者工具
  isOpenZoom?: boolean // 缩放功能
  isOpenContextMenu?: boolean // 右键菜单
  leftMenuPosition?: 'left' | 'right' // 侧边栏位置
  howLinkOpenMethod?: 'tuboshu' | 'external' // 链接打开方式
  collapsedSidebarMode?: 'all' | 'expanded' // 侧边栏折叠模式
  language?: string // 语言设置
  minimizeToTray?: 'tray' | 'exit' // 关闭主窗口行为：托盘或退出
  dataPath?: string // 数据路径
  shortcutsEnabled?: boolean // 快捷键启用
  shortcutAlwaysOnTop?: string // 置顶快捷键
  shortcutMiniMode?: string // 迷你模式快捷键
  trayEnabled?: boolean // 托盘启用
  trayShowNotifications?: boolean // 托盘通知
  windowAlwaysOnTop?: boolean // 窗口置顶
  windowMiniMode?: boolean // 迷你模式
  memoryOptimizerEnabled?: boolean // 内存优化器
  memoryCleanInterval?: number // 清理间隔
  maxInactiveTime?: number // 最大非活动时间
  // 内存清理选项
  enableGarbageCollection?: boolean // 启用垃圾回收
  enableEmergencyCleanup?: boolean // 启用紧急清理
  clearInactiveSessionCache?: boolean // 清理不活跃会话缓存
  clearInactiveCookies?: boolean // 清理不活跃Cookie
  clearInactiveLocalStorage?: boolean // 清理不活跃本地存储
  proxyEnabled?: boolean // 代理启用
  proxyRules?: string // 代理规则
  proxySoftwareOnly?: boolean // 仅代理软件本体，不代理网页内容
  autoCheckUpdates?: boolean // 自动检查更新
  updateCheckInterval?: number // 更新检查间隔
  autoRestartOnCrash?: boolean // 崩溃后自动重启
  // 扩展管理设置
  extensionSettings?: ExtensionSettings

  // 隐私设置
  enableJavaScript?: boolean
  allowPopups?: boolean
  sessionIsolationEnabled?: boolean
  crashReportingEnabled?: boolean
  saveSession?: boolean
  clearCacheOnExit?: boolean
  // 清理选项配置
  clearCacheOptions?: {
    clearSessionCache?: boolean // 清理会话缓存
    clearStorageData?: boolean // 清除存储数据
    clearAuthCache?: boolean // 清除认证缓存
    clearDefaultSession?: boolean // 清除默认会话
  }
  // 文件访问设置
  allowLocalFileAccess?: boolean // 允许访问本地文件
  // 快速跳转网站设置
  quickResetWebsite?: boolean // 允许左键双击网站按钮时跳转到初始URL
  resetWebsiteConfirmDialog?: boolean // 跳转网页时提示确认弹窗
  autoCloseSettingsOnWebsiteClick?: boolean // 点击网站时自动关闭设置页面
  // 清除数据标志
  clearDataOnNextStart?: boolean // 下次启动时清除所有数据
}

export interface ExtensionSettings {
  enableExtensions: boolean
  autoLoadExtensions: boolean
  defaultIsolationLevel: ExtensionIsolationLevel
  defaultRiskTolerance: ExtensionRiskLevel
}

export interface WebsiteOrderUpdate {
  secondaryGroupId: string
  websiteIds: string[]
}

// 快捷键配置
export interface Shortcut {
  id: string
  name: string
  tag: string
  cmd: string
  isGlobal: boolean
  isOpen: boolean
}

// 数据导入导出配置
export interface DataSyncConfig {
  lastExportTime?: number
  lastImportTime?: number
  exportPath?: string
}

// 浏览器指纹配置
export interface FingerprintConfig {
  userAgent?: string
  platform?: string
  languages?: string[]
  screenResolution?: string
  timezone?: string
}

// 扩展管理类型
export interface ExtensionManifest {
  name: string
  version: string
  manifest_version?: number
  description?: string
  permissions?: string[]
  host_permissions?: string[]
  options_page?: string
  action?: {
    default_popup?: string
    default_title?: string
  }
  browser_action?: {
    default_popup?: string
    default_title?: string
  }
  background?: {
    service_worker?: string
    scripts?: string[]
    persistent?: boolean
  }
  content_scripts?: ContentScript[]
  icons?: Record<string, string>
}

export interface ExtensionInfo {
  /** 扩展 ID（由 Electron 分配） */
  id: string
  /** 扩展名称 */
  name: string
  /** 扩展版本 */
  version: string
  /** 扩展路径 */
  path: string
  /** 是否启用 */
  enabled: boolean
  /** 扩展 manifest 内容 */
  manifest?: ExtensionManifest
}

export interface ContentScript {
  matches?: string[]
  js?: string[]
  css?: string[]
}

export interface BackgroundConfig {
  service_worker?: string
  scripts?: string[]
  persistent?: boolean
}

export interface ExtensionConfig {
  extensions: ExtensionInfo[]
}

// 扩展隔离配置
export interface ExtensionIsolationConfig {
  level: 'strict' | 'standard' | 'relaxed' | 'none'
  sessionPoolSize: number
  sessionIdleTimeout: number
  memoryLimit: number
  cpuLimit: number
  networkRestrictions: boolean
  fileAccessRestrictions: boolean
  scriptInjectionDetection: boolean
}

// 扩展权限配置
export interface ExtensionPermissionInfo {
  permission: string
  category: 'sensitive' | 'network' | 'system' | 'file' | 'ui' | 'storage' | 'unknown'
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical'
  description: string
  required: boolean
}

export enum ExtensionPermissionCategory {
  SENSITIVE = 'sensitive',
  NETWORK = 'network',
  SYSTEM = 'system',
  FILE = 'file',
  UI = 'ui',
  STORAGE = 'storage',
  UNKNOWN = 'unknown'
}

export enum ExtensionRiskLevel {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ExtensionIsolationLevel {
  STRICT = 'strict',
  STANDARD = 'standard',
  RELAXED = 'relaxed',
  NONE = 'none'
}
