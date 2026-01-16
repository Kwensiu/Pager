import { useState, useEffect } from 'react'
import type { Settings } from '../../shared/types/store'
import { ExtensionIsolationLevel, ExtensionRiskLevel } from '../../shared/types/store'

const defaultSettings: Settings = {
  theme: 'light',
  showDebugOptions: false,
  isAutoLaunch: false,
  isMenuVisible: true,
  isWindowEdgeAdsorption: true,
  isMemoryOptimizationEnabled: true,
  isOpenDevTools: false,
  isOpenZoom: true,
  isOpenContextMenu: true,
  leftMenuPosition: 'left',
  howLinkOpenMethod: 'tuboshu',
  extensionSettings: {
    enableExtensions: true,
    autoLoadExtensions: true,
    defaultIsolationLevel: ExtensionIsolationLevel.STANDARD,
    defaultRiskTolerance: ExtensionRiskLevel.MEDIUM
  },
  enableJavaScript: true,
  allowPopups: true,
  sessionIsolationEnabled: true,
  crashReportingEnabled: true,
  saveSession: true,
  clearCacheOnExit: false,
  allowLocalFileAccess: false // 默认关闭本地文件访问
}

export function useSettings(): {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
} {
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

  // 组件挂载时从主进程同步设置
  useEffect(() => {
    const loadSettingsFromMainProcess = async (): Promise<void> => {
      try {
        if (window.api?.store?.getSettings) {
          const mainProcessSettings = await window.api.store.getSettings()
          if (mainProcessSettings) {
            setSettings((prev) => {
              const merged = { ...defaultSettings, ...prev, ...mainProcessSettings }
              // 同步回 localStorage
              localStorage.setItem('settings', JSON.stringify(merged))
              return merged
            })
          }
        }
      } catch (error) {
        console.error('Failed to load settings from main process:', error)
      }
    }

    loadSettingsFromMainProcess()
  }, [])

  // 监听 localStorage 的变化（来自其他标签页或窗口）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'settings' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          // 避免覆盖当前状态，只合并新设置
          setSettings((prev) => {
            const merged = { ...prev, ...parsed }
            // 防止循环更新：如果新旧设置相同，不更新状态
            if (JSON.stringify(prev) === JSON.stringify(merged)) {
              return prev
            }
            return merged
          })
        } catch (error) {
          console.error('Failed to parse settings from storage event:', error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const updateSettings = (newSettings: Partial<Settings>): void => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      // 只有设置真正改变时才更新 localStorage
      if (JSON.stringify(prev) === JSON.stringify(updated)) {
        return prev
      }

      // 保存到 localStorage
      localStorage.setItem('settings', JSON.stringify(updated))

      // 同步到主进程的 electron-store
      if (window.api?.store?.updateSettings) {
        window.api.store.updateSettings(newSettings).catch((error) => {
          console.error('Failed to sync settings to main process:', error)
        })
      }

      // 手动触发 storage 事件，确保同一个标签页内的组件也能收到更新
      // 但避免循环触发
      try {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'settings',
            newValue: JSON.stringify(updated),
            oldValue: JSON.stringify(prev),
            storageArea: localStorage,
            url: window.location.href
          })
        )
      } catch (error) {
        console.warn('Failed to dispatch storage event:', error)
      }

      return updated
    })
  }

  return { settings, updateSettings }
}
