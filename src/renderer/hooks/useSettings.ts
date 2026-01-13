import { useState, useEffect } from 'react'

interface Settings {
  // 通用设置
  theme: 'light' | 'dark' | 'system'
  language: string
  autoUpdate: boolean
  minimizeToTray: boolean
  collapsedSidebarMode: 'all' | 'expanded'

  // 浏览器指纹伪装
  fingerprintEnabled: boolean
  fingerprintMode: 'basic' | 'balanced' | 'advanced'

  // 全局快捷键
  shortcutsEnabled: boolean
  shortcutAlwaysOnTop: string
  shortcutMiniMode: string

  // 系统托盘
  trayEnabled: boolean
  trayShowNotifications: boolean

  // 窗口管理
  windowAlwaysOnTop: boolean
  windowMiniMode: boolean
  windowAdsorptionEnabled: boolean
  windowAdsorptionSensitivity: number

  // 内存优化
  memoryOptimizerEnabled: boolean
  memoryCleanInterval: number
  maxInactiveTime: number

  // 数据同步
  autoSyncEnabled: boolean
  syncInterval: number

  // 自动启动
  autoLaunchEnabled: boolean

  // 代理支持
  proxyEnabled: boolean
  proxyRules: string

  // 版本检查
  autoCheckUpdates: boolean
  updateCheckInterval: number

  // Session 隔离
  sessionIsolationEnabled: boolean

  // 进程崩溃处理
  crashReportingEnabled: boolean
  autoRestartOnCrash: boolean

  // 浏览器设置
  enableJavaScript: boolean
  allowPopups: boolean

  // 隐私与数据
  saveSession: boolean
  clearCacheOnExit: boolean

  // 扩展设置
  enableExtensions: boolean
  autoLoadExtensions: boolean

  // 调试模式
  showDebugOptions: boolean
}

const defaultSettings: Settings = {
  // 通用设置
  theme: 'system',
  language: 'zh',
  autoUpdate: true,
  minimizeToTray: true,
  collapsedSidebarMode: 'all',

  // 浏览器指纹伪装
  fingerprintEnabled: false,
  fingerprintMode: 'balanced',

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
  updateCheckInterval: 24,

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

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const savedSettings = localStorage.getItem('settings')
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings)
        return { ...defaultSettings, ...parsed }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
    return defaultSettings
  })

  // 监听 localStorage 的变化（来自其他标签页或窗口）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          setSettings((prev) => ({ ...prev, ...parsed }))
        } catch (error) {
          console.error('Failed to parse settings from storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const updateSettings = (newSettings: Partial<Settings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    localStorage.setItem('settings', JSON.stringify(updated))
    // 手动触发 storage 事件，确保同一个标签页内的组件也能收到更新
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'settings',
        newValue: JSON.stringify(updated),
        oldValue: localStorage.getItem('settings'),
        storageArea: localStorage,
        url: window.location.href
      })
    )
  }

  return { settings, updateSettings }
}
