import React, { useState, useEffect } from 'react'
import { Button } from '../../ui/button'
import { Switch } from '../../ui/switch'
import { Label } from '../../ui/label'
import { Separator } from '../../ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { Input } from '../../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Slider } from '../../ui/slider'
import { useI18n } from '@/core/i18n/useI18n'

interface SettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  mode?: 'dialog' | 'page'
}

/**
 * 设置页面组件
 * 管理应用的所有设置，包括新功能
 */
const SettingsDialog: React.FC<SettingsDialogProps> = ({ onOpenChange }) => {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState('general')
  const [settings, setSettings] = useState({
    // 通用设置
    theme: 'system' as 'light' | 'dark' | 'system',
    language: 'zh',
    autoUpdate: true,
    minimizeToTray: true,
    collapsedSidebarMode: 'all' as 'all' | 'expanded',

    // 浏览器指纹伪装
    fingerprintEnabled: false,
    fingerprintMode: 'balanced' as 'basic' | 'balanced' | 'advanced',

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
    memoryCleanInterval: 30, // 分钟
    maxInactiveTime: 60, // 分钟

    // 数据同步
    autoSyncEnabled: false,
    syncInterval: 24, // 小时

    // 自动启动
    autoLaunchEnabled: false,

    // 代理支持
    proxyEnabled: false,
    proxyRules: '',

    // 版本检查
    autoCheckUpdates: true,
    updateCheckInterval: 24, // 小时

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
  })

  const loadSettings = async (): Promise<void> => {
    try {
      // 这里可以从存储中加载设置
      // 暂时使用默认值
      console.log('Loading settings...')
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  // 加载设置
  useEffect(() => {
    loadSettings()
  }, [])

  const saveSettings = async (): Promise<void> => {
    try {
      // 这里可以保存设置到存储
      console.log('Saving settings:', settings)

      // 应用设置到各个服务
      await applySettings()

      // 页面模式下不需要关闭对话框，可以显示保存成功的提示
      alert('设置已保存')

      if (onOpenChange) {
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
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
      await api.enhanced.theme.set(settings.theme)

      // 应用窗口管理设置
      if (settings.windowAlwaysOnTop) {
        await api.enhanced.windowManager.toggleAlwaysOnTop()
      }

      // 应用内存优化
      if (settings.memoryOptimizerEnabled) {
        await api.enhanced.memoryOptimizer.start()
      } else {
        await api.enhanced.memoryOptimizer.stop()
      }

      // 应用自动启动
      if (settings.autoLaunchEnabled) {
        await api.enhanced.autoLaunch.enable()
      } else {
        await api.enhanced.autoLaunch.disable()
      }

      // 应用窗口边缘吸附
      if (settings.windowAdsorptionEnabled) {
        await api.enhanced.windowAdsorption.enable()
        await api.enhanced.windowAdsorption.setSensitivity(settings.windowAdsorptionSensitivity)
      } else {
        await api.enhanced.windowAdsorption.disable()
      }

      console.log('Settings applied successfully')
    } catch (error) {
      console.error('Failed to apply settings:', error)
    }
  }

  const handleSettingChange = (key: keyof typeof settings, value: unknown): void => {
    setSettings((prev) => ({
      ...prev,
      [key]: value
    }))
  }

  const handleResetToDefaults = (): void => {
    setSettings({
      theme: 'system',
      language: 'zh',
      autoUpdate: true,
      minimizeToTray: true,
      collapsedSidebarMode: 'all',
      fingerprintEnabled: false,
      fingerprintMode: 'balanced',
      shortcutsEnabled: true,
      shortcutAlwaysOnTop: 'Ctrl+Shift+T',
      shortcutMiniMode: 'Ctrl+Shift+M',
      trayEnabled: true,
      trayShowNotifications: true,
      windowAlwaysOnTop: false,
      windowMiniMode: false,
      windowAdsorptionEnabled: true,
      windowAdsorptionSensitivity: 50,
      memoryOptimizerEnabled: true,
      memoryCleanInterval: 30,
      maxInactiveTime: 60,
      autoSyncEnabled: false,
      syncInterval: 24,
      autoLaunchEnabled: false,
      proxyEnabled: false,
      proxyRules: '',
      autoCheckUpdates: true,
      updateCheckInterval: 24,
      sessionIsolationEnabled: true,
      crashReportingEnabled: true,
      autoRestartOnCrash: false,
      enableJavaScript: true,
      allowPopups: true,
      saveSession: true,
      clearCacheOnExit: false,
      enableExtensions: true,
      autoLoadExtensions: true,
      showDebugOptions: false
    })
  }

  const testProxyConnection = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.enhanced?.proxy) {
        alert('代理功能不可用')
        return
      }

      const result = await api.enhanced.proxy.testConnection(settings.proxyRules)

      if (result.success) {
        alert(`代理连接测试成功！延迟: ${result.latency}ms`)
      } else {
        alert(`代理连接测试失败: ${result.error}`)
      }
    } catch (error) {
      alert(`测试失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const checkForUpdates = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.enhanced?.versionChecker) {
        alert('版本检查功能不可用')
        return
      }

      const result = await api.enhanced.versionChecker.checkUpdate(true)

      if (result.available) {
        alert(`发现新版本: ${result.latestVersion}\n${result.releaseNotes || ''}`)
      } else {
        alert('当前已是最新版本')
      }
    } catch (error) {
      alert(`检查更新失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const exportAllSettings = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.enhanced?.dataSync) {
        alert('数据同步功能不可用')
        return
      }

      const result = await api.enhanced.dataSync.exportConfig({
        includeCookies: true,
        includeSettings: true
      })

      // 创建下载链接
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pager-settings-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)

      alert('设置导出成功')
    } catch (error) {
      alert(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6 text-foreground">{t('settings.title') || '设置'}</h1>

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
                <Label>主题</Label>
                <p className="text-sm text-muted-foreground">选择应用主题</p>
              </div>
              <Select
                value={settings.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') =>
                  handleSettingChange('theme', value)
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">浅色</SelectItem>
                  <SelectItem value="dark">深色</SelectItem>
                  <SelectItem value="system">跟随系统</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>语言</Label>
                <p className="text-sm text-muted-foreground">选择应用语言</p>
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
                <Label>侧边栏折叠模式</Label>
                <p className="text-sm text-muted-foreground">侧边栏折叠时的显示模式</p>
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
                  <SelectItem value="all">全部折叠</SelectItem>
                  <SelectItem value="expanded">展开模式</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自动检查更新</Label>
                <p className="text-sm text-muted-foreground">自动检查应用更新</p>
              </div>
              <Switch
                checked={settings.autoUpdate}
                onCheckedChange={(checked) => handleSettingChange('autoUpdate', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>最小化到托盘</Label>
                <p className="text-sm text-muted-foreground">最小化时隐藏到系统托盘</p>
              </div>
              <Switch
                checked={settings.minimizeToTray}
                onCheckedChange={(checked) => handleSettingChange('minimizeToTray', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自动启动</Label>
                <p className="text-sm text-muted-foreground">开机时自动启动应用</p>
              </div>
              <Switch
                checked={settings.autoLaunchEnabled}
                onCheckedChange={(checked) => handleSettingChange('autoLaunchEnabled', checked)}
              />
            </div>
          </div>
        </TabsContent>

        {/* 隐私设置 */}
        <TabsContent value="privacy" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>浏览器指纹伪装</Label>
                <p className="text-sm text-muted-foreground">伪装浏览器指纹防止追踪</p>
              </div>
              <Switch
                checked={settings.fingerprintEnabled}
                onCheckedChange={(checked) => handleSettingChange('fingerprintEnabled', checked)}
              />
            </div>

            {settings.fingerprintEnabled && (
              <div className="pl-4 space-y-2">
                <Label>伪装模式</Label>
                <Select
                  value={settings.fingerprintMode}
                  onValueChange={(value: 'basic' | 'balanced' | 'advanced') =>
                    handleSettingChange('fingerprintMode', value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">基础模式</SelectItem>
                    <SelectItem value="balanced">平衡模式</SelectItem>
                    <SelectItem value="advanced">高级模式</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用 JavaScript</Label>
                <p className="text-sm text-muted-foreground">在浏览器中启用 JavaScript 执行</p>
              </div>
              <Switch
                checked={settings.enableJavaScript}
                onCheckedChange={(checked) => handleSettingChange('enableJavaScript', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>允许弹窗</Label>
                <p className="text-sm text-muted-foreground">允许网站打开新窗口或弹窗</p>
              </div>
              <Switch
                checked={settings.allowPopups}
                onCheckedChange={(checked) => handleSettingChange('allowPopups', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Session 隔离</Label>
                <p className="text-sm text-muted-foreground">为每个网站创建独立的会话</p>
              </div>
              <Switch
                checked={settings.sessionIsolationEnabled}
                onCheckedChange={(checked) =>
                  handleSettingChange('sessionIsolationEnabled', checked)
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>崩溃报告</Label>
                <p className="text-sm text-muted-foreground">发送崩溃报告帮助改进应用</p>
              </div>
              <Switch
                checked={settings.crashReportingEnabled}
                onCheckedChange={(checked) => handleSettingChange('crashReportingEnabled', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>保存会话</Label>
                <p className="text-sm text-muted-foreground">退出时保存当前会话状态</p>
              </div>
              <Switch
                checked={settings.saveSession}
                onCheckedChange={(checked) => handleSettingChange('saveSession', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>退出时清除缓存</Label>
                <p className="text-sm text-muted-foreground">应用退出时自动清除浏览器缓存</p>
              </div>
              <Switch
                checked={settings.clearCacheOnExit}
                onCheckedChange={(checked) => handleSettingChange('clearCacheOnExit', checked)}
              />
            </div>
          </div>
        </TabsContent>

        {/* 窗口设置 */}
        <TabsContent value="window" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>窗口置顶</Label>
                <p className="text-sm text-muted-foreground">窗口始终显示在最前面</p>
              </div>
              <Switch
                checked={settings.windowAlwaysOnTop}
                onCheckedChange={(checked) => handleSettingChange('windowAlwaysOnTop', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>小窗模式</Label>
                <p className="text-sm text-muted-foreground">启用小窗模式</p>
              </div>
              <Switch
                checked={settings.windowMiniMode}
                onCheckedChange={(checked) => handleSettingChange('windowMiniMode', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>窗口边缘吸附</Label>
                <p className="text-sm text-muted-foreground">窗口靠近屏幕边缘时自动吸附</p>
              </div>
              <Switch
                checked={settings.windowAdsorptionEnabled}
                onCheckedChange={(checked) =>
                  handleSettingChange('windowAdsorptionEnabled', checked)
                }
              />
            </div>

            {settings.windowAdsorptionEnabled && (
              <div className="pl-4 space-y-2">
                <Label>吸附灵敏度</Label>
                <div className="flex items-center space-x-4">
                  <Slider
                    value={[settings.windowAdsorptionSensitivity]}
                    onValueChange={([value]) =>
                      handleSettingChange('windowAdsorptionSensitivity', value)
                    }
                    min={1}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="w-12 text-sm">{settings.windowAdsorptionSensitivity}</span>
                </div>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>系统托盘</Label>
                <p className="text-sm text-muted-foreground">在系统托盘显示应用图标</p>
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
                    <Label>显示通知</Label>
                    <p className="text-sm text-muted-foreground">在系统托盘显示通知</p>
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
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>全局快捷键</Label>
                <p className="text-sm text-muted-foreground">启用全局快捷键功能</p>
              </div>
              <Switch
                checked={settings.shortcutsEnabled}
                onCheckedChange={(checked) => handleSettingChange('shortcutsEnabled', checked)}
              />
            </div>

            {settings.shortcutsEnabled && (
              <div className="pl-4 space-y-4">
                <div className="space-y-2">
                  <Label>窗口置顶快捷键</Label>
                  <Input
                    value={settings.shortcutAlwaysOnTop}
                    onChange={(e) => handleSettingChange('shortcutAlwaysOnTop', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>小窗模式快捷键</Label>
                  <Input
                    value={settings.shortcutMiniMode}
                    onChange={(e) => handleSettingChange('shortcutMiniMode', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 网络设置 */}
        <TabsContent value="network" className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>代理支持</Label>
                <p className="text-sm text-muted-foreground">为网站设置代理</p>
              </div>
              <Switch
                checked={settings.proxyEnabled}
                onCheckedChange={(checked) => handleSettingChange('proxyEnabled', checked)}
              />
            </div>

            {settings.proxyEnabled && (
              <div className="pl-4 space-y-4">
                <div className="space-y-2">
                  <Label>代理规则</Label>
                  <Input
                    value={settings.proxyRules}
                    onChange={(e) => handleSettingChange('proxyRules', e.target.value)}
                    placeholder="例如: http=proxy.example.com:8080;https=proxy.example.com:8080"
                  />
                  <p className="text-sm text-muted-foreground">
                    格式: http=host:port;https=host:port;socks=host:port
                  </p>
                </div>

                <Button onClick={testProxyConnection} variant="outline" size="sm">
                  测试代理连接
                </Button>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>数据同步</Label>
                <p className="text-sm text-muted-foreground">自动同步配置和 Cookie</p>
              </div>
              <Switch
                checked={settings.autoSyncEnabled}
                onCheckedChange={(checked) => handleSettingChange('autoSyncEnabled', checked)}
              />
            </div>

            {settings.autoSyncEnabled && (
              <div className="pl-4 space-y-2">
                <Label>同步间隔（小时）</Label>
                <Input
                  type="number"
                  value={settings.syncInterval}
                  onChange={(e) =>
                    handleSettingChange('syncInterval', parseInt(e.target.value) || 24)
                  }
                  min={1}
                  max={168}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>版本检查</Label>
              <div className="flex items-center space-x-2">
                <Button onClick={checkForUpdates} variant="outline" size="sm">
                  立即检查更新
                </Button>
                <div className="flex-1" />
                <Switch
                  checked={settings.autoCheckUpdates}
                  onCheckedChange={(checked) => handleSettingChange('autoCheckUpdates', checked)}
                />
                <Label>自动检查</Label>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>扩展设置</Label>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>启用扩展</Label>
                    <p className="text-sm text-muted-foreground">启用浏览器扩展功能</p>
                  </div>
                  <Switch
                    checked={settings.enableExtensions}
                    onCheckedChange={(checked) => handleSettingChange('enableExtensions', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>自动加载扩展</Label>
                    <p className="text-sm text-muted-foreground">启动时自动加载已安装的扩展</p>
                  </div>
                  <Switch
                    checked={settings.autoLoadExtensions}
                    onCheckedChange={(checked) =>
                      handleSettingChange('autoLoadExtensions', checked)
                    }
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    // 这里需要打开扩展管理器
                    console.log('打开扩展管理器')
                  }}
                >
                  <span>管理扩展</span>
                </Button>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>数据管理</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={exportAllSettings} variant="outline" size="sm">
                  导出所有设置
                </Button>
                <Button onClick={handleResetToDefaults} variant="outline" size="sm">
                  恢复默认设置
                </Button>
                <Button
                  onClick={() => {
                    // 清除所有数据功能
                    if (confirm('确定要清除所有数据吗？此操作不可恢复！')) {
                      if (window.api?.store?.clearAll) {
                        window.api.store.clearAll()
                        alert('所有数据已清除')
                      } else {
                        alert('清除数据功能不可用')
                      }
                    }
                  }}
                  variant="destructive"
                  size="sm"
                >
                  清除所有数据
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>崩溃后自动重启</Label>
                <p className="text-sm text-muted-foreground">应用崩溃后自动重启</p>
              </div>
              <Switch
                checked={settings.autoRestartOnCrash}
                onCheckedChange={(checked) => handleSettingChange('autoRestartOnCrash', checked)}
              />
            </div>

            <div className="text-sm text-muted-foreground">
              <p>应用版本: 0.0.2</p>
              <p>Electron: 39.2.7</p>
              <p>Chrome: 128.0.6613.138</p>
              <p>Node.js: 20.17.0</p>
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
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="outline" onClick={handleResetToDefaults}>
          恢复默认
        </Button>
        <Button onClick={saveSettings}>保存设置</Button>
      </div>
    </div>
  )
}

export default SettingsDialog
