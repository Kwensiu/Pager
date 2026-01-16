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
import { useSettings } from '@/hooks/useSettings'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '../../ui/dialog'
import { ExtensionManager } from './ExtensionManager'

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
      const { api } = window
      if (api?.dialog?.openDirectory) {
        const result = await api.dialog.openDirectory({
          properties: ['openDirectory']
        })

        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          // 打开选定的目录
          const { shell } = await import('electron')
          await shell.openPath(result.filePaths[0])
        }
      } else {
        // 如果API不可用，尝试直接打开当前数据路径
        if (dataPath) {
          const { shell } = await import('electron')
          await shell.openPath(dataPath)
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

  const handleSettingChange = async (key: keyof typeof settings, value: unknown): Promise<void> => {
    updateSettings({ [key]: value } as Partial<typeof settings>)
    // 自动应用设置
    await saveSettings()
  }

  const handleResetToDefaults = async (): Promise<void> => {
    updateSettings({
      theme: 'light',
      language: 'zh',
      autoUpdate: true,
      minimizeToTray: true,
      collapsedSidebarMode: 'all',
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
    // 自动应用设置
    await saveSettings()
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

  const exportAllSettings = async (): Promise<void> => {
    try {
      const { api } = window
      if (!api?.store) {
        alert('数据同步功能不可用')
        return
      }

      // 获取所有需要导出的数据
      const [settings, primaryGroups] = await Promise.all([
        api.store.getSettings(),
        api.store.getPrimaryGroups()
      ])

      // 构建导出数据
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          settings,
          websites: primaryGroups,
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
        alert('数据同步功能不可用')
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

      alert('设置导入成功')
    } catch (error) {
      alert(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-background text-foreground sidebar-scrollbar">
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
                  <SelectItem value="all">显示所有网站</SelectItem>
                  <SelectItem value="expanded">仅显示展开的分组</SelectItem>
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
                <Button onClick={openDataDirectory} variant="outline" size="sm">
                  打开数据目录
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

      {/* 扩展管理器对话框 */}
      <Dialog open={showExtensionManager} onOpenChange={setShowExtensionManager}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('extensions.title') || '扩展管理'}</DialogTitle>
            <DialogDescription>
              {t('extensions.description') || '管理您的浏览器扩展'}
            </DialogDescription>
          </DialogHeader>
          <ExtensionManager open={showExtensionManager} onOpenChange={setShowExtensionManager} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettingsDialog
