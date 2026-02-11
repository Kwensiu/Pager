import React, { useState, useEffect } from 'react'
import { Button } from '../../ui/button'
import { Switch } from '../../ui/switch'
import { Label } from '../../ui/label'
import { Separator } from '../../ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Loader2, CheckCircle, XCircle, Globe, Zap, AlertTriangle, Activity } from 'lucide-react'
import { UpdateDialog } from '../../ui/update-dialog'
import { useI18n } from '@/core/i18n/useI18n'
import { useSettings } from '@/hooks/useSettings'
import { ExtensionIsolationLevel, ExtensionRiskLevel } from '../../../shared/types/store'
import { getDefaultGroups } from '@/utils/defaultGroupsHelper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../../ui/dialog'
import { ExtensionManager } from './ExtensionManager'
import { ShortcutSettings } from './ShortcutSettings'

interface SettingsDialogProps {
  open?: boolean
  mode?: 'dialog' | 'page'
}

/**
 * 设置页面组件
 * 管理应用的所有设置，包括新功能
 */
const SettingsDialog: React.FC<SettingsDialogProps> = () => {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('general')
  const { settings, updateSettings } = useSettings()
  const [showExtensionManager, setShowExtensionManager] = useState(false)
  const [showCrashConfirmDialog, setShowCrashConfirmDialog] = useState(false)
  const [showClearCacheSettingsDialog, setShowClearCacheSettingsDialog] = useState(false)
  const [showClearDataConfirmDialog, setShowClearDataConfirmDialog] = useState(false)
  const [showResetToDefaultsDialog, setShowResetToDefaultsDialog] = useState(false)

  // Toast 状态
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // 内存统计状态
  const [memoryStats, setMemoryStats] = useState<{
    activeCount: number
    inactiveCount: number
    currentMemoryUsage?: { workingSetSize: number; privateBytes: number }
    optimizationEnabled: boolean
  } | null>(null)
  const [loadingMemoryStats, setLoadingMemoryStats] = useState(false)

  // 加载内存统计
  const loadMemoryStats = async (): Promise<void> => {
    if (!settings.memoryOptimizerEnabled) return

    setLoadingMemoryStats(true)
    try {
      const stats = await window.api.enhanced.memoryOptimizer.getStats()
      console.log('Memory stats loaded:', stats)
      setMemoryStats(stats)
    } catch (error) {
      console.error('Failed to load memory stats:', error)
    } finally {
      setLoadingMemoryStats(false)
    }
  }

  // 监听内存优化开关变化
  useEffect(() => {
    if (settings.memoryOptimizerEnabled && activeTab === 'performance') {
      loadMemoryStats()
      // 每30秒刷新一次统计
      const interval = setInterval(loadMemoryStats, 30000)
      return () => clearInterval(interval)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.memoryOptimizerEnabled, activeTab])

  // 同步自动启动状态
  useEffect(() => {
    const syncAutoLaunchStatus = async (): Promise<void> => {
      try {
        if (window.api?.enhanced?.autoLaunch) {
          const isActuallyEnabled = await window.api.enhanced.autoLaunch.isEnabled()
          if (isActuallyEnabled !== settings.isAutoLaunch) {
            console.log('Syncing auto-launch status:', isActuallyEnabled)
            updateSettings({ isAutoLaunch: isActuallyEnabled })
          }
        }
      } catch (error) {
        console.error('Failed to sync auto-launch status:', error)
      }
    }

    syncAutoLaunchStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 处理清理选项设置变更
  const handleClearCacheOptionChange = (
    option: keyof NonNullable<typeof settings.clearCacheOptions>,
    value: boolean
  ): void => {
    const currentOptions = settings.clearCacheOptions || {}
    updateSettings({
      clearCacheOptions: {
        ...currentOptions,
        [option]: value
      }
    })
  }

  // 清理选项配置
  const clearCacheOptionsConfig: Array<{
    key: keyof NonNullable<typeof settings.clearCacheOptions>
    label: string
    description: string
    tooltip: string
    defaultChecked: boolean
  }> = [
    {
      key: 'clearStorageData',
      label: t('settings.clearStorageData'),
      description: t('settings.clearStorageDataDescription'),
      tooltip: t('settings.clearStorageDataTooltip'),
      defaultChecked: false
    },
    {
      key: 'clearAuthCache',
      label: t('settings.clearAuthCache'),
      description: t('settings.clearAuthCacheDescription'),
      tooltip: t('settings.clearAuthCacheTooltip'),
      defaultChecked: false
    },
    {
      key: 'clearSessionCache',
      label: t('settings.clearSessionCache'),
      description: t('settings.clearSessionCacheDescription'),
      tooltip: t('settings.clearSessionCacheTooltip'),
      defaultChecked: true
    },
    {
      key: 'clearDefaultSession',
      label: t('settings.clearDefaultSession'),
      description: t('settings.clearDefaultSessionDescription'),
      tooltip: t('settings.clearDefaultSessionTooltip'),
      defaultChecked: true
    }
  ]

  // 渲染清理设置选项
  const renderClearCacheOption = (config: (typeof clearCacheOptionsConfig)[0]): JSX.Element => (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <Label>{config.label}</Label>
          <div className="group relative">
            <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center cursor-help">
              <span className="text-xs text-muted-foreground">?</span>
            </div>
            <div className="absolute left-6 top-0 z-50 invisible group-hover:visible bg-popover text-popover-foreground border rounded-md shadow-md p-2 w-64 text-sm">
              {config.tooltip}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      <Switch
        checked={settings.clearCacheOptions?.[config.key] ?? config.defaultChecked}
        onCheckedChange={(checked) => handleClearCacheOptionChange(config.key, checked)}
      />
    </div>
  )

  // 处理崩溃模拟
  const handleSimulateCrash = async (): Promise<void> => {
    try {
      if (window.api?.crash?.simulateCrash) {
        await window.api.crash.simulateCrash()
        // 注意：应用会在这里崩溃，所以下面的代码可能不会执行
      } else {
        console.error('崩溃模拟API不可用')
      }
    } catch (error) {
      console.error('崩溃模拟失败:', error)
    }
  }

  // 处理清除所有数据
  const handleClearData = async (): Promise<void> => {
    try {
      if (window.api?.store?.clearAll) {
        await window.api.store.clearAll()
        alert(t('settings.clearAllDataSuccess'))
        setShowClearDataConfirmDialog(false)

        // 延迟关闭应用，让用户看到成功提示
        setTimeout(() => {
          if (window.api?.enhanced?.windowManager?.exitApp) {
            window.api.enhanced.windowManager.exitApp()
          }
        }, 1500)
      } else {
        alert('清除数据功能不可用')
        setShowClearDataConfirmDialog(false)
      }
    } catch (error) {
      console.error('清除数据失败:', error)
      alert('清除数据失败')
      setShowClearDataConfirmDialog(false)
    }
  }

  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{
    currentVersion: string
    latestVersion?: string
    available: boolean
    releaseNotes?: string
    error?: string
  } | null>(null)
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)

  // 代理测试状态
  const [isTestingProxy, setIsTestingProxy] = useState(false)
  const [proxyTestResult, setProxyTestResult] = useState<{
    success: boolean
    latency?: number
    error?: string
  } | null>(null)

  // 获取版本信息
  const [versionInfo, setVersionInfo] = useState<{
    appVersion: string
    electronVersion: string
    chromeVersion: string
    nodeVersion: string
  } | null>(null)

  // 组件加载时获取版本信息
  useEffect(() => {
    const fetchVersionInfo = async (): Promise<void> => {
      try {
        const { api } = window

        if (api?.enhanced?.versionChecker) {
          const info = await api.enhanced.versionChecker.getVersionInfo()
          setVersionInfo({
            appVersion: info.appVersion,
            electronVersion: info.electronVersion,
            chromeVersion: info.chromeVersion,
            nodeVersion: info.nodeVersion
          })
          return
        }
      } catch (error) {
        console.error('Failed to get version info:', error)
      }
    }

    fetchVersionInfo()
  }, [])

  // 获取数据路径
  const [dataPath, setDataPath] = useState('')

  // 组件加载时获取数据路径
  useEffect(() => {
    const fetchDataPath = async (): Promise<void> => {
      try {
        const { api } = window
        if (api?.store?.getDataPath) {
          const result = await api.store.getDataPath()
          if (result.success) {
            setDataPath(result.path || '')
            updateSettings({ dataPath: result.path || '' })
          } else {
            setDataPath('获取路径失败')
          }
        }
      } catch (error) {
        console.error('Failed to get data path:', error)
        setDataPath('获取路径失败')
      }
    }

    fetchDataPath()
  }, [updateSettings])

  // 打开数据目录
  const openDataDirectory = async (): Promise<void> => {
    try {
      if (dataPath) {
        // 直接打开当前数据目录
        await window.api.shell.openPath(dataPath)
      } else {
        // 如果没有数据路径，尝试获取用户数据目录
        const result = await window.api.store.getDataPath()
        if (result.success && result.path) {
          await window.api.shell.openPath(result.path)
        } else {
          alert('无法获取数据目录路径')
        }
      }
    } catch (error) {
      console.error('Failed to open data directory:', error)
      alert('打开数据目录失败')
    }
  }

  const saveSettings = async (): Promise<void> => {
    try {
      // 应用设置到各个服务
      await applySettings()
    } catch (error) {
      console.error('Failed to apply settings:', error)
    }
  }

  const applySettings = async (): Promise<void> => {
    try {
      const { api } = window

      if (!api?.enhanced) {
        console.warn('Enhanced API not available')
        return
      }

      // 应用主题
      if (api.enhanced.theme?.set) {
        await api.enhanced.theme.set(settings.theme)
      }

      // 应用窗口管理设置
      if (settings.windowAlwaysOnTop && api.enhanced.windowManager?.toggleAlwaysOnTop) {
        await api.enhanced.windowManager.toggleAlwaysOnTop()
      }

      // 应用内存优化
      if (api.enhanced.memoryOptimizer) {
        if (settings.memoryOptimizerEnabled) {
          await api.enhanced.memoryOptimizer.start()
        } else {
          await api.enhanced.memoryOptimizer.stop()
        }
      }

      console.log('Settings applied successfully')
    } catch (error) {
      console.error('Failed to apply settings:', error)
      // 不抛出错误，避免影响 UI 状态
    }
  }

  const handleSettingChange = async (key: keyof typeof settings, value: unknown): Promise<void> => {
    // 立即更新 UI 状态
    if (key === 'clearCacheOptions') {
      updateSettings({ [key]: value } as Partial<typeof settings>)
    } else {
      updateSettings({ [key]: value } as Partial<typeof settings>)
    }

    // 对于某些特殊设置，延迟应用以避免状态冲突
    const settingsRequiringDelay = [
      'windowAlwaysOnTop',
      'windowMiniMode',
      'memoryOptimizerEnabled',
      'isAutoLaunch'
    ]

    if (settingsRequiringDelay.includes(key)) {
      // 延迟应用设置，给系统状态同步时间
      setTimeout(async () => {
        try {
          await saveSettings()
        } catch (error) {
          console.error('Failed to apply settings:', error)
          // 对于自动启动，如果应用失败，恢复到之前状态
          if (key === 'isAutoLaunch') {
            const previousValue = !value // 恢复到相反的值
            updateSettings({ [key]: previousValue } as Partial<typeof settings>)
          }
          // 如果应用失败，不恢复 UI 状态，让用户看到他们选择的状态
        }
      }, 200)
    } else {
      // 对于其他设置，立即应用
      try {
        await saveSettings()
      } catch (error) {
        console.error('Failed to apply settings:', error)
      }
    }
  }

  // 显示恢复默认设置确认对话框
  const handleResetToDefaults = (): void => {
    setShowResetToDefaultsDialog(true)
  }

  // 实际执行恢复默认设置
  const executeResetToDefaults = async (): Promise<void> => {
    // 重置设置
    updateSettings({
      theme: 'light',
      language: 'zh',
      autoCheckUpdates: true,
      minimizeToTray: 'exit',
      collapsedSidebarMode: 'all',
      // 快速跳转网站设置
      quickResetWebsite: true,
      resetWebsiteConfirmDialog: true,
      autoCloseSettingsOnWebsiteClick: true,
      shortcutsEnabled: true,
      shortcutAlwaysOnTop: 'Ctrl+Shift+T',
      shortcutMiniMode: 'Ctrl+Shift+M',
      trayEnabled: true,
      trayShowNotifications: true,
      windowAlwaysOnTop: false,
      windowMiniMode: false,
      memoryOptimizerEnabled: true,
      memoryCleanInterval: 30,
      maxInactiveTime: 60,
      // 内存清理选项
      enableGarbageCollection: true,
      enableEmergencyCleanup: true,
      clearInactiveSessionCache: false,
      clearInactiveCookies: false,
      clearInactiveLocalStorage: false,
      isAutoLaunch: false,
      proxyEnabled: false,
      proxyRules: '',
      proxySoftwareOnly: true,
      sessionIsolationEnabled: true,
      crashReportingEnabled: true,
      saveSession: true,
      clearCacheOnExit: false,
      clearCacheOptions: {
        clearStorageData: false,
        clearAuthCache: false,
        clearSessionCache: true,
        clearDefaultSession: true
      },
      allowLocalFileAccess: false,
      enableJavaScript: true,
      allowPopups: false,
      isOpenDevTools: false,
      isOpenZoom: false,
      isOpenContextMenu: false,
      leftMenuPosition: 'left',
      howLinkOpenMethod: 'tuboshu',
      dataPath: '',
      extensionSettings: {
        enableExtensions: false,
        autoLoadExtensions: false,
        defaultIsolationLevel: ExtensionIsolationLevel.STANDARD,
        defaultRiskTolerance: ExtensionRiskLevel.MEDIUM
      },
      showDebugOptions: false
    })

    // 恢复默认网站分组
    try {
      const defaultGroups = getDefaultGroups()
      if (window.api?.store?.setPrimaryGroups) {
        await window.api.store.setPrimaryGroups(defaultGroups)
      }
    } catch (error) {
      console.error('Failed to restore default groups:', error)
    }

    // 应用设置
    await saveSettings()

    // 关闭对话框
    setShowResetToDefaultsDialog(false)

    // 自动重启应用
    setTimeout(() => {
      if (window.api?.enhanced?.windowManager?.exitApp) {
        window.api.enhanced.windowManager.exitApp()
      }
    }, 1000)
  }

  const handleManualUpdateCheck = async (): Promise<void> => {
    if (isCheckingUpdate) return

    setIsCheckingUpdate(true)
    setShowUpdateDialog(true)
    setUpdateInfo(null)

    try {
      const { api } = window
      if (api?.enhanced?.versionChecker) {
        const result = await api.enhanced.versionChecker.checkUpdate(true)
        const versionInfo = await api.enhanced.versionChecker.getVersionInfo()

        // 合并版本信息
        const fullUpdateInfo = {
          ...result,
          currentVersion: versionInfo.appVersion
        }
        setUpdateInfo(fullUpdateInfo)
      } else {
        setUpdateInfo({
          currentVersion: '未知',
          available: false,
          error: '更新检查功能不可用'
        })
      }
    } catch (error) {
      setUpdateInfo({
        currentVersion: '未知',
        available: false,
        error: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const testProxyConnection = async (): Promise<void> => {
    if (!settings.proxyRules?.trim()) {
      setProxyTestResult({
        success: false,
        error: '请先输入代理规则'
      })
      return
    }

    setIsTestingProxy(true)
    setProxyTestResult(null)

    try {
      const { api } = window
      if (!api?.enhanced?.proxy) {
        setProxyTestResult({
          success: false,
          error: '代理功能不可用'
        })
        return
      }

      const result = await api.enhanced.proxy.testConnection(settings.proxyRules)

      setProxyTestResult({
        success: result.success,
        latency: result.latency,
        error: result.error
      })
    } catch (error) {
      setProxyTestResult({
        success: false,
        error: error instanceof Error ? error.message : '测试失败'
      })
    } finally {
      setIsTestingProxy(false)
    }
  }

  const exportAllSettings = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.store) {
        alert('导出功能不可用')
        return
      }

      // 获取所有需要导出的数据
      const [settings, primaryGroups, shortcuts] = await Promise.all([
        api.store.getSettings(),
        api.store.getPrimaryGroups(),
        api.enhanced?.shortcut?.getAll?.() || []
      ])

      // 构建导出数据
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          settings,
          websites: primaryGroups,
          shortcuts, // 快捷键配置
          // TODO: 添加扩展设置导出 (extensionSettings)
          includeCookies: true
        }
      }

      // 创建下载链接
      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      // 使用本地时间格式：年月日时分秒
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')

      a.download = `pager-settings-${year}-${month}-${day}-${hours}-${minutes}-${seconds}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const importAllSettings = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.store) {
        alert('导入功能不可用')
        return
      }

      // 打开文件选择对话框
      const { canceled, filePaths } = await api.dialog.openFile({
        title: '导入设置',
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })

      if (canceled || filePaths.length === 0) {
        return
      }

      const filePath = filePaths[0]
      if (!filePath) return

      // 使用 IPC 读取文件内容
      const result = await (
        window as unknown as {
          api: {
            enhanced: {
              fs: {
                readFile: (
                  path: string
                ) => Promise<{ success: boolean; content?: string; error?: string }>
              }
            }
          }
        }
      ).api.enhanced.fs.readFile(filePath)

      if (!result.success || !result.content) {
        throw new Error(result.error || '读取文件失败')
      }

      const fileContent = result.content
      const importData = JSON.parse(fileContent)

      // 验证数据格式
      if (!importData.version || !importData.data) {
        alert('无效的配置文件格式')
        return
      }

      // 确认导入
      if (!confirm('确定要导入这些设置吗？这将覆盖当前的设置和网站数据。')) {
        return
      }

      // 导入设置
      if (importData.data.settings) {
        await api.store.updateSettings(importData.data.settings)
        // 应用设置
        await saveSettings()
      }

      // 导入网站数据
      if (importData.data.websites) {
        await api.store.setPrimaryGroups(importData.data.websites)
      }

      // 导入快捷键配置
      if (importData.data.shortcuts && api.enhanced?.shortcut) {
        try {
          // 先清除现有快捷键
          await api.enhanced.shortcut.disableAll()

          // 重新注册快捷键
          for (const shortcut of importData.data.shortcuts) {
            await api.enhanced.shortcut.register(shortcut)
          }
        } catch (error) {
          console.error('Failed to import shortcuts:', error)
          // 不阻止整个导入过程，只记录错误
        }
      }

      alert('设置导入成功')
    } catch (error) {
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-background text-foreground sidebar-scrollbar">
      <h1 className="text-2xl font-bold mb-6 text-foreground">{t('settings.title', '设置')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 mb-4">
          <TabsTrigger value="general">通用</TabsTrigger>
          <TabsTrigger value="privacy">隐私</TabsTrigger>
          <TabsTrigger value="window">窗口</TabsTrigger>
          <TabsTrigger value="performance">性能</TabsTrigger>
          <TabsTrigger value="network">网络</TabsTrigger>
          <TabsTrigger value="advanced">高级</TabsTrigger>
        </TabsList>

        {/* 通用设置 */}
        <TabsContent value="general" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.theme')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.themeDescription')}</p>
              </div>
              <Select
                value={settings.theme}
                onValueChange={(value: 'light' | 'dark') => handleSettingChange('theme', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">浅色</SelectItem>
                  <SelectItem value="dark">深色</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.language')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.languageDescription')}</p>
              </div>
              <Select
                value={settings.language}
                onValueChange={(value: string) => handleSettingChange('language', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.collapsedSidebarMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.collapsedSidebarModeDescription')}
                </p>
              </div>
              <Select
                value={settings.collapsedSidebarMode}
                onValueChange={(value: 'all' | 'expanded') =>
                  handleSettingChange('collapsedSidebarMode', value)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">显示所有网站</SelectItem>
                  <SelectItem value="expanded">仅显示展开的分组</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center justify-between flex-1">
                <div className="space-y-0.5">
                  <Label>{t('settings.autoCheckUpdates')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.autoCheckUpdatesDescription')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-2"
                  onClick={handleManualUpdateCheck}
                  title="手动检查更新"
                  disabled={isCheckingUpdate}
                >
                  <svg
                    className={`h-4 w-4 ${isCheckingUpdate ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  >
                    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
              <Switch
                checked={settings.autoCheckUpdates}
                onCheckedChange={(checked) => handleSettingChange('autoCheckUpdates', checked)}
                className="ml-4"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.closeMainWindow')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.closeMainWindowDescription')}
                </p>
              </div>
              <Select
                value={settings.minimizeToTray}
                onValueChange={(value: 'tray' | 'exit') => handleSettingChange('minimizeToTray', value)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tray">{t('settings.minimizeToTray')}</SelectItem>
                  <SelectItem value="exit">{t('settings.exitApp')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.isAutoLaunch')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.isAutoLaunchDescription')}
                </p>
              </div>
              <Switch
                checked={settings.isAutoLaunch}
                onCheckedChange={(checked) => handleSettingChange('isAutoLaunch', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.quickResetWebsite')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.quickResetWebsiteDescription')}
                </p>
              </div>
              <Switch
                checked={settings.quickResetWebsite}
                onCheckedChange={(checked) => handleSettingChange('quickResetWebsite', checked)}
              />
            </div>

            {settings.quickResetWebsite && (
              <div className="pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.resetWebsiteConfirmDialog')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.resetWebsiteConfirmDialogDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.resetWebsiteConfirmDialog}
                    onCheckedChange={(checked) =>
                      handleSettingChange('resetWebsiteConfirmDialog', checked)
                    }
                  />
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.autoCloseSettingsOnWebsiteClick')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.autoCloseSettingsOnWebsiteClickDescription')}
                </p>
              </div>
              <Switch
                checked={settings.autoCloseSettingsOnWebsiteClick}
                onCheckedChange={(checked) =>
                  handleSettingChange('autoCloseSettingsOnWebsiteClick', checked)
                }
              />
            </div>
          </div>
        </TabsContent>

        {/* 隐私设置 */}
        <TabsContent value="privacy" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.enableJavaScript')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.enableJavaScriptDescription')}
                </p>
              </div>
              <Switch
                checked={settings.enableJavaScript}
                onCheckedChange={(checked) => {
                  handleSettingChange('enableJavaScript', checked)
                  setToastMessage('JavaScript 设置已更改，已自动刷新页面')
                  setShowToast(true)
                  setTimeout(() => setShowToast(false), 3000)
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.allowPopups')}</Label>
                <p className="text-sm text-muted-foreground">{t('settings.popupDescription')}</p>
              </div>
              <Switch
                checked={settings.allowPopups}
                onCheckedChange={(checked) => handleSettingChange('allowPopups', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.sessionIsolationEnabled')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.sessionIsolationEnabledDescription')}
                </p>
              </div>
              <Switch
                checked={settings.sessionIsolationEnabled}
                onCheckedChange={(checked) => {
                  handleSettingChange('sessionIsolationEnabled', checked)
                  setToastMessage('Session 隔离设置已更改，已自动刷新页面')
                  setShowToast(true)
                  setTimeout(() => setShowToast(false), 3000)
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.crashReportingEnabled')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.crashReportingEnabledDescription')}
                </p>
              </div>
              <Switch
                checked={settings.crashReportingEnabled}
                onCheckedChange={(checked) => handleSettingChange('crashReportingEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.saveSession')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.saveSessionDescription')}
                </p>
              </div>
              <Switch
                checked={settings.saveSession}
                onCheckedChange={(checked) => handleSettingChange('saveSession', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center justify-between flex-1">
                <div className="space-y-0.5">
                  <Label>{t('settings.clearCacheOnExit')}</Label>
                  <p className="text-sm text-muted-foreground">{t('settings.cacheDescription')}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 ml-2"
                  onClick={() => setShowClearCacheSettingsDialog(true)}
                  title={t('settings.clearCacheSettings')}
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  >
                    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </Button>
              </div>
              <Switch
                checked={settings.clearCacheOnExit}
                onCheckedChange={(checked) => handleSettingChange('clearCacheOnExit', checked)}
                className="ml-4"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>允许本地文件访问</Label>
                <p className="text-sm text-muted-foreground">
                  允许添加和访问本地文件（file://协议）
                </p>
              </div>
              <Switch
                checked={settings.allowLocalFileAccess || false}
                onCheckedChange={(checked) => handleSettingChange('allowLocalFileAccess', checked)}
              />
            </div>
          </div>
        </TabsContent>

        {/* 窗口设置 */}
        <TabsContent value="window" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.windowAlwaysOnTop')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.windowAlwaysOnTopDescription')}
                </p>
              </div>
              <Switch
                checked={settings.windowAlwaysOnTop}
                onCheckedChange={(checked) => handleSettingChange('windowAlwaysOnTop', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.windowMiniMode')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.windowMiniModeDescription')}
                </p>
              </div>
              <Switch
                checked={settings.windowMiniMode}
                onCheckedChange={(checked) => handleSettingChange('windowMiniMode', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.trayEnabled')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('settings.trayEnabledDescription')}
                </p>
              </div>
              <Switch
                checked={settings.trayEnabled}
                onCheckedChange={(checked) => handleSettingChange('trayEnabled', checked)}
              />
            </div>

            {settings.trayEnabled && (
              <div className="pl-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>{t('settings.trayShowNotifications')}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t('settings.trayShowNotificationsDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.trayShowNotifications}
                    onCheckedChange={(checked) =>
                      handleSettingChange('trayShowNotifications', checked)
                    }
                  />
                </div>
              </div>
            )}

            <Separator />

            {/* 快捷键设置 */}
            <ShortcutSettings />
          </div>
        </TabsContent>

        {/* 性能设置 */}
        <TabsContent value="performance" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>内存优化</Label>
                <p className="text-sm text-muted-foreground">自动清理不活跃的网站以释放内存</p>
              </div>
              <Switch
                checked={settings.memoryOptimizerEnabled}
                onCheckedChange={(checked) =>
                  handleSettingChange('memoryOptimizerEnabled', checked)
                }
              />
            </div>

            {settings.memoryOptimizerEnabled && (
              <div className="pl-4 space-y-4">
                {/* 内存统计 */}
                <div className="rounded-lg border bg-muted p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      <Label className="text-base font-semibold">内存使用情况</Label>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMemoryStats}
                      disabled={loadingMemoryStats}
                    >
                      {loadingMemoryStats ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <span className="text-sm">刷新</span>
                      )}
                    </Button>
                  </div>

                  {memoryStats && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">活跃网站</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {memoryStats.activeCount}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">不活跃网站</p>
                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                          {memoryStats.inactiveCount}
                        </p>
                      </div>
                      {memoryStats.currentMemoryUsage ? (
                        <>
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground">当前内存使用</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {Math.round(memoryStats.currentMemoryUsage.workingSetSize / 1024)} MB
                            </p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs text-muted-foreground">私有内存</p>
                            <p className="text-lg text-slate-600 dark:text-slate-400">
                              {Math.round(memoryStats.currentMemoryUsage.privateBytes / 1024)} MB
                            </p>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1 col-span-2">
                          <p className="text-xs text-muted-foreground">当前内存使用</p>
                          <p className="text-lg text-slate-600 dark:text-slate-400">暂无数据</p>
                        </div>
                      )}
                    </div>
                  )}

                  {!memoryStats && !loadingMemoryStats && (
                    <p className="text-sm text-muted-foreground">点击刷新按钮查看内存统计</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>清理间隔（分钟）</Label>
                    <Input
                      type="number"
                      value={settings.memoryCleanInterval}
                      onChange={(e) =>
                        handleSettingChange('memoryCleanInterval', parseInt(e.target.value) || 30)
                      }
                      min={5}
                      max={240}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>最大不活跃时间（分钟）</Label>
                    <Input
                      type="number"
                      value={settings.maxInactiveTime}
                      onChange={(e) =>
                        handleSettingChange('maxInactiveTime', parseInt(e.target.value) || 60)
                      }
                      min={10}
                      max={480}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-semibold">清理选项</Label>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>启用垃圾回收</Label>
                      <p className="text-sm text-muted-foreground">
                        定期触发 V8 垃圾回收以释放内存
                      </p>
                    </div>
                    <Switch
                      checked={settings.enableGarbageCollection ?? true}
                      onCheckedChange={(checked) =>
                        handleSettingChange('enableGarbageCollection', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>紧急清理</Label>
                      <p className="text-sm text-muted-foreground">当内存超过阈值时自动清理</p>
                    </div>
                    <Switch
                      checked={settings.enableEmergencyCleanup ?? true}
                      onCheckedChange={(checked) =>
                        handleSettingChange('enableEmergencyCleanup', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>清理会话缓存</Label>
                      <p className="text-sm text-muted-foreground">清理不活跃网站的会话数据</p>
                    </div>
                    <Switch
                      checked={settings.clearInactiveSessionCache ?? false}
                      onCheckedChange={(checked) =>
                        handleSettingChange('clearInactiveSessionCache', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>清理 Cookie</Label>
                      <p className="text-sm text-muted-foreground">清理不活跃网站的 Cookie 数据</p>
                    </div>
                    <Switch
                      checked={settings.clearInactiveCookies ?? false}
                      onCheckedChange={(checked) =>
                        handleSettingChange('clearInactiveCookies', checked)
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>清理本地存储</Label>
                      <p className="text-sm text-muted-foreground">清理不活跃网站的 localStorage</p>
                    </div>
                    <Switch
                      checked={settings.clearInactiveLocalStorage ?? false}
                      onCheckedChange={(checked) =>
                        handleSettingChange('clearInactiveLocalStorage', checked)
                      }
                    />
                  </div>
                </div>

                <Separator />

                <Button
                  variant="default"
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700 dark:text-white"
                  onClick={async () => {
                    const cleanedIds = await window.api.enhanced.memoryOptimizer.cleanInactive()
                    console.log('Cleaned websites:', cleanedIds)
                  }}
                >
                  立即清理不活跃网站
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 网络设置 */}
        <TabsContent value="network" className="space-y-6">
          <div className="space-y-6">
            {/* 代理设置 */}
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    <Label className="text-base font-semibold">{t('proxy.title')}</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('proxy.description')}</p>
                </div>
                <Switch
                  checked={settings.proxyEnabled}
                  onCheckedChange={(checked) => handleSettingChange('proxyEnabled', checked)}
                />
              </div>

              <div className="space-y-4">
                {/* 软件代理开关 */}
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">{t('proxy.softwareOnly')}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t('proxy.softwareOnlyDescription')}
                    </p>
                  </div>
                  <Switch
                    checked={settings.proxySoftwareOnly ?? true}
                    onCheckedChange={(checked) => handleSettingChange('proxySoftwareOnly', checked)}
                  />
                </div>

                {/* 网页代理设置 - 始终显示 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-sm font-medium">{t('proxy.rules')}</Label>
                    {settings.proxySoftwareOnly && (
                      <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        {t('proxy.softwareProxyEnabled')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={settings.proxyRules}
                      onChange={(e) => handleSettingChange('proxyRules', e.target.value)}
                      placeholder={t('proxy.rulesPlaceholder')}
                      className="font-mono flex-1"
                    />
                    <Button
                      onClick={testProxyConnection}
                      variant="outline"
                      size="sm"
                      disabled={isTestingProxy || !settings.proxyRules?.trim()}
                      className="h-9 px-2"
                    >
                      {isTestingProxy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      <strong>{t('proxy.supportedFormats')}</strong>
                    </p>
                    <div className="grid gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-secondary rounded text-xs">
                          {t('proxy.http')}
                        </span>
                        <code>http=proxy.example.com:8080;https=proxy.example.com:8080</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-secondary rounded text-xs">
                          {t('proxy.socks5')}
                        </span>
                        <code>socks5://proxy.example.com:1080</code>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-secondary rounded text-xs">
                          {t('proxy.simple')}
                        </span>
                        <code>proxy.example.com:8080</code>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 测试结果显示 */}
                {proxyTestResult && (
                  <div className="flex items-center gap-2 text-sm p-3 rounded-md bg-muted/50">
                    {proxyTestResult.success ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-green-600">
                          {t('proxy.connectionSuccess')}{' '}
                          {proxyTestResult.latency && `(${proxyTestResult.latency}ms)`}
                        </span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-red-600">
                          {proxyTestResult.error || t('proxy.connectionFailed')}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>扩展设置</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>启用扩展</Label>
                    <p className="text-sm text-muted-foreground">启用浏览器扩展功能</p>
                  </div>
                  <Switch
                    checked={settings.extensionSettings?.enableExtensions}
                    onCheckedChange={(checked) =>
                      handleSettingChange('extensionSettings', {
                        ...settings.extensionSettings,
                        enableExtensions: checked
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>自动加载扩展</Label>
                    <p className="text-sm text-muted-foreground">启动时自动加载已安装的扩展</p>
                  </div>
                  <Switch
                    checked={settings.extensionSettings?.autoLoadExtensions}
                    onCheckedChange={(checked) =>
                      handleSettingChange('extensionSettings', {
                        ...settings.extensionSettings,
                        autoLoadExtensions: checked
                      })
                    }
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => setShowExtensionManager(true)}
                >
                  <span>管理扩展</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>数据管理</Label>
              <div className="text-sm text-muted-foreground mb-1">
                数据存储路径: {settings.dataPath || '获取路径中...'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={exportAllSettings} variant="outline" size="sm">
                  导出所有设置
                </Button>
                <Button onClick={importAllSettings} variant="outline" size="sm">
                  导入设置
                </Button>
                <Button onClick={handleResetToDefaults} variant="warning" size="sm">
                  恢复默认设置
                </Button>
                <Button
                  onClick={() => setShowClearDataConfirmDialog(true)}
                  variant="destructive"
                  size="sm"
                >
                  清除所有数据
                </Button>
                <Button onClick={openDataDirectory} variant="outline" size="sm">
                  打开数据目录
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('enhancedFeatures.crashHandler.autoRestart')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('enhancedFeatures.crashHandler.description')}
                </p>
              </div>
              <Switch
                checked={settings.autoRestartOnCrash}
                onCheckedChange={(checked) => handleSettingChange('autoRestartOnCrash', checked)}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Pager: {versionInfo?.appVersion || '加载中...'}</p>
              <p>Electron: {versionInfo?.electronVersion || '加载中...'}</p>
              <p>Chrome: {versionInfo?.chromeVersion || '加载中...'}</p>
              <p>Node.js: {versionInfo?.nodeVersion || '加载中...'}</p>
            </div>

            <Separator />

            {/* 调试选项 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>调试模式</Label>
                  <p className="text-sm text-muted-foreground">显示高级调试选项</p>
                </div>
                <Switch
                  checked={settings.showDebugOptions}
                  onCheckedChange={(checked) => handleSettingChange('showDebugOptions', checked)}
                />
              </div>

              {settings.showDebugOptions && (
                <div className="border-red-500 border-2 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:border-red-700">
                  <h3 className="text-lg font-semibold mb-2 text-red-700 dark:text-red-300">
                    调试选项
                  </h3>
                  <div className="space-y-2">
                    <p className="text-red-600 dark:text-red-400 text-sm">
                      警告：这些选项仅供调试使用，操作可能不可恢复！
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (window.api?.window?.openDevTools) {
                            window.api.window.openDevTools()
                          } else {
                            alert('打开开发者工具功能不可用')
                          }
                        }}
                      >
                        打开开发者工具
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowCrashConfirmDialog(true)}
                        className="relative overflow-hidden"
                      >
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        模拟崩溃
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 扩展管理器对话框 */}
      <Dialog open={showExtensionManager} onOpenChange={setShowExtensionManager}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('extensions.title', '扩展管理')}</DialogTitle>
            <DialogDescription>
              {t('extensions.description') || '管理您的浏览器扩展'}
            </DialogDescription>
          </DialogHeader>
          <ExtensionManager open={showExtensionManager} onOpenChange={setShowExtensionManager} />
        </DialogContent>
      </Dialog>

      {/* 更新对话框 */}
      <UpdateDialog
        open={showUpdateDialog}
        onClose={() => setShowUpdateDialog(false)}
        currentVersion={updateInfo?.currentVersion || versionInfo?.appVersion || ''}
        latestVersion={updateInfo?.latestVersion}
        available={updateInfo?.available || false}
        releaseNotes={updateInfo?.releaseNotes}
        error={updateInfo?.error}
        isChecking={isCheckingUpdate}
      />

      {/* 清理设置对话框 */}
      <Dialog open={showClearCacheSettingsDialog} onOpenChange={setShowClearCacheSettingsDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              >
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('settings.clearCacheSettings')}
            </DialogTitle>
            <DialogDescription>{t('settings.clearCacheSettingsDescription')}</DialogDescription>
          </DialogHeader>
          {/* 清理选项列表 - 使用配置数组渲染，便于维护 */}
          <div className="space-y-4 mt-4">
            <div className="space-y-3">
              {clearCacheOptionsConfig.map((config) => (
                <div key={config.key}>{renderClearCacheOption(config)}</div>
              ))}
            </div>
          </div>
          {/* 对话框操作按钮 */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowClearCacheSettingsDialog(false)}>
              {t('cancel', '取消')}
            </Button>
            <Button onClick={() => setShowClearCacheSettingsDialog(false)}>
              {t('confirm', '确定')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 清除数据确认对话框 */}
      <Dialog open={showClearDataConfirmDialog} onOpenChange={setShowClearDataConfirmDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.clearAllDataTitle')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>
                  <strong>{t('settings.clearAllDataWarning')}</strong>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('settings.clearAllDataDescription')}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowClearDataConfirmDialog(false)}>
              {t('settings.clearAllDataCancel')}
            </Button>
            <Button variant="destructive" onClick={handleClearData}>
              {t('settings.clearAllDataConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 恢复默认设置确认对话框 */}
      <Dialog open={showResetToDefaultsDialog} onOpenChange={setShowResetToDefaultsDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {t('settings.resetToDefaultsTitle')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>
                  <strong>{t('settings.resetToDefaultsWarning')}</strong>
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('settings.resetToDefaultsDescription')}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowResetToDefaultsDialog(false)}>
              {t('settings.resetToDefaultsCancel')}
            </Button>
            <Button variant="destructive" onClick={executeResetToDefaults}>
              {t('settings.resetToDefaultsConfirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 崩溃确认对话框 */}
      <Dialog open={showCrashConfirmDialog} onOpenChange={setShowCrashConfirmDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              确认模拟崩溃
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <div>
                  <strong>警告：</strong>此操作将模拟应用程序崩溃，用于测试崩溃恢复功能。
                </div>
                <div className="text-sm text-muted-foreground">
                  应用程序将立即关闭，所有未保存的数据可能会丢失。您确定要继续吗？
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowCrashConfirmDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleSimulateCrash}>
              确认崩溃
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* In-app Toast 提示 */}
      {showToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-md shadow-lg z-50 transition-opacity duration-300">
          {toastMessage}
        </div>
      )}
    </div>
  )
}

export default SettingsDialog
