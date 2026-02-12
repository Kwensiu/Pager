import { useState, useEffect } from 'react'
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Loader2,
  Package,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react'
import { Button } from '@/ui/button'
import { useI18n } from '@/core/i18n/useI18n'
import { AddExtensionDialog } from './AddExtensionDialog'
import { ConfirmDialog } from './ConfirmDialog'
import type { ExtensionManifest } from '../../../shared/types/store'

interface Extension {
  id: string
  realId?: string
  name: string
  version: string
  path?: string
  enabled: boolean
  manifest?: ExtensionManifest
  session?: {
    id: string
    isolationLevel: string
    isActive: boolean
    memoryUsage: number
  }
  permissions?: {
    settings: string[]
    riskLevel: string
  }
  error?: {
    type: string
    message: string
    severity: string
    recoverable: boolean
  }
}

interface ExtensionManagerProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
}

export function ExtensionManager({ open }: ExtensionManagerProps): JSX.Element {
  const { t } = useI18n()
  const [extensions, setExtensions] = useState<Extension[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null)
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null)

  // 加载扩展列表
  const loadExtensions = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result = await window.api.extension.getAll()
      if (result.success && result.extensions) {
        setExtensions(result.extensions)
      } else {
        setExtensions([])
      }
    } catch (error) {
      console.error('Failed to load extensions:', error)
      setExtensions([])
    } finally {
      setIsLoading(false)
    }
  }

  // 加载扩展详细信息
  const loadExtensionDetails = async (extensionId: string): Promise<Extension | null> => {
    try {
      const result = await window.api.extension.getWithPermissions(extensionId)
      if (result.success && result.extension) {
        return {
          ...result.extension,
          session: result.session || undefined,
          permissions: result.permissions || undefined
        }
      }
      return null
    } catch (error) {
      console.error('Failed to load extension details:', error)
      return null
    }
  }

  // 当对话框打开时加载扩展
  useEffect(() => {
    if (open) {
      loadExtensions()
    }
  }, [open])

  // 添加扩展（使用隔离和权限验证）
  const handleAddExtension = async (path: string): Promise<void> => {
    try {
      const result = await window.api.extension.loadWithIsolation(path)
      if (result.success) {
        await loadExtensions()

        // 显示成功消息
        console.log('Extension loaded successfully:', result)
      } else {
        throw new Error(result.error || 'Failed to load extension')
      }
    } catch (error) {
      console.error('Failed to add extension:', error)
      throw error
    }
  }

  // 删除扩展（同时销毁隔离会话）
  const handleRemoveExtension = async (id: string): Promise<void> => {
    try {
      const result = await window.api.extension.unloadWithIsolation(id)
      if (result.success) {
        await loadExtensions()
        setConfirmDelete(null)
      } else {
        throw new Error(result.error || 'Failed to remove extension')
      }
    } catch (error) {
      console.error('Failed to remove extension:', error)
    }
  }

  // 启用/禁用扩展
  const handleToggleExtension = async (id: string, enabled: boolean): Promise<void> => {
    try {
      await window.api.extension.toggle(id, enabled)
      await loadExtensions()
    } catch (error) {
      console.error('Failed to toggle extension:', error)
    }
  }

  // 更新权限设置
  const handleUpdatePermission = async (
    extensionId: string,
    permission: string,
    allowed: boolean
  ): Promise<void> => {
    try {
      const result = await window.api.extension.updatePermissionSettings(
        extensionId,
        [permission],
        allowed
      )
      if (result.success) {
        // 重新加载扩展详细信息
        const updatedExtension = await loadExtensionDetails(extensionId)
        if (updatedExtension) {
          setExtensions((prev) =>
            prev.map((ext) => (ext.id === extensionId ? updatedExtension : ext))
          )
        }
      } else {
        throw new Error(result.error || 'Failed to update permission')
      }
    } catch (error) {
      console.error('Failed to update permission:', error)
    }
  }

  // 获取风险等级图标
  const getRiskIcon = (riskLevel: string): JSX.Element => {
    switch (riskLevel) {
      case 'low':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  // 获取隔离级别文本
  const getIsolationLevelText = (level: string): string => {
    switch (level) {
      case 'strict':
        return t('extensions.isolation.strict')
      case 'standard':
        return t('extensions.isolation.standard')
      case 'relaxed':
        return t('extensions.isolation.relaxed')
      case 'none':
        return 'none'
      default:
        return level
    }
  }

  // 检查扩展文件结构
  const handleInspectExtension = async (extension: Extension): Promise<void> => {
    try {
      console.log(`Inspecting extension structure for: ${extension.name}`)

      if (!extension.path) {
        console.error('Extension path not available')
        return
      }

      // 检查可能的选项页面路径
      const possibleOptionsPaths: string[] = []
      if (extension.manifest?.options_page) {
        possibleOptionsPaths.push(extension.manifest.options_page)
      }
      if (extension.manifest?.action?.default_popup) {
        possibleOptionsPaths.push(extension.manifest.action.default_popup)
      }
      if (extension.manifest?.browser_action?.default_popup) {
        possibleOptionsPaths.push(extension.manifest.browser_action.default_popup)
      }

      // 添加常见的选项页面路径
      const commonPaths: string[] = [
        'options.html',
        'options/index.html',
        'assets/options.html',
        'popup.html',
        'index.html',
        'settings.html',
        'config.html'
      ]
      possibleOptionsPaths.push(...commonPaths)

      // 显示扩展信息
      const info = `
扩展信息:

名称: ${extension.name}
ID: ${extension.id}
版本: ${extension.version}
路径: ${extension.path}

可能的选项页面:
${possibleOptionsPaths.map((path) => `- ${path}`).join('\n')}

Manifest 信息:
- Options Page: ${extension.manifest?.options_page || '无'}
- Action Popup: ${extension.manifest?.action?.default_popup || '无'}
- Browser Action: ${extension.manifest?.browser_action?.default_popup || '无'}
- Description: ${extension.manifest?.description || '无'}

建议操作:
1. 点击"打开选项页面"按钮
2. 或者手动打开文件夹查找文件
      `

      const shouldOpenOptions = confirm(info + '\n\n是否要打开选项页面？')

      if (shouldOpenOptions) {
        // 尝试打开选项页面
        await handleOpenExtensionFile(extension, possibleOptionsPaths)
      }

      // 在控制台显示详细信息
      console.log('Extension path:', extension.path)
      console.log('Extension manifest:', extension.manifest)
      console.log('Possible options paths:', possibleOptionsPaths)
    } catch (error) {
      console.error('Failed to inspect extension:', error)
    }
  }

  // 打开扩展选项页面文件
  const handleOpenExtensionFile = async (
    extension: Extension,
    possiblePaths: string[]
  ): Promise<void> => {
    try {
      // 尝试打开每个可能的路径
      for (const path of possiblePaths) {
        const fullPath = `${extension.path}/${path}`

        try {
          // 使用 shell API 打开文件
          const result = await window.api.shell.openPath(fullPath)
          if (result.success) {
            console.log(`Opened extension file: ${fullPath}`)
            return
          } else {
            console.log(`Failed to open ${path}:`, result.error)
            continue
          }
        } catch (error) {
          console.log(`Failed to open ${path}:`, error)
          continue
        }
      }

      // 如果所有路径都失败，打开扩展文件夹
      if (extension.path) {
        const result = await window.api.shell.openPath(extension.path)
        if (result.success) {
          console.log(`Opened extension folder: ${extension.path}`)
        } else {
          console.error(`Failed to open extension folder:`, result.error)
        }
      }
    } catch (error) {
      console.error('Failed to open extension file:', error)
      alert(`无法打开扩展文件: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // 打开扩展选项页面
  const handleOpenExtensionOptions = async (extension: Extension): Promise<void> => {
    try {
      console.log(`Attempting to open options for extension: ${extension.name}`)

      // 优先尝试使用 chrome-extension:// URL 打开扩展自己的选项页面
      if (extension.manifest?.options_page) {
        const extensionId = extension.realId || extension.id
        const chromeExtensionUrl = `chrome-extension://${extensionId}/${extension.manifest.options_page}`
        console.log(`Opening extension options: ${chromeExtensionUrl}`)

        const result = await window.api.window.openExtensionInNewWindow(
          chromeExtensionUrl,
          `${extension.name} - Options`
        )
        if (result.success) {
          console.log(`Extension options opened in new window successfully`)
          return
        } else {
          console.log(`Failed to open in new window:`, result.error)
        }
      }

      // 尝试其他可能的页面，使用 chrome-extension:// URL
      const possiblePages = ['options.html', 'popup.html', 'index.html']

      for (const page of possiblePages) {
        try {
          const extensionId = extension.realId || extension.id
          const chromeExtensionUrl = `chrome-extension://${extensionId}/${page}`
          console.log(`Trying page: ${chromeExtensionUrl}`)

          const result = await window.api.window.openExtensionInNewWindow(
            chromeExtensionUrl,
            `${extension.name} - ${page}`
          )
          if (result.success) {
            console.log(`Page ${page} opened in new window successfully`)
            return
          } else {
            console.log(`Failed to open ${page}:`, result.error)
          }
        } catch (error) {
          console.log(`Failed to open ${page}:`, error)
          continue
        }
      }

      // 如果 chrome-extension:// 都失败，回退到我们创建的配置页面
      if (extension.path && extension.manifest) {
        const result = await window.api.extension.createConfigPage(
          extension.id,
          extension.name,
          extension.path,
          extension.manifest
        )

        if (result.success) {
          console.log(`Extension config page created: ${result.windowId}`)
          return
        } else {
          console.error('Failed to create config page:', result.error)
        }
      }

      // 最后回退到 file:// URL
      if (extension.manifest?.options_page && extension.path) {
        const optionsPath = `${extension.path}/${extension.manifest.options_page}`
        const fileUrl = `file://${optionsPath.replace(/\\/g, '/')}`
        console.log(`Falling back to file URL: ${fileUrl}`)

        const result = await window.api.window.openExtensionInNewWindow(
          fileUrl,
          `${extension.name} - Options`
        )
        if (result.success) {
          console.log(`Extension options opened successfully (file URL)`)
        } else {
          throw new Error(result.error || 'Failed to load extension options')
        }
        return
      }

      console.log('No suitable page found')
    } catch (error) {
      console.error('Failed to open extension options:', error)
      alert(`无法打开扩展选项页面: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <>
      <AddExtensionDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddExtension}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={t('extensions.confirmRemove')}
        description={t('extensions.confirmRemoveDescription')}
        onConfirm={() => confirmDelete && handleRemoveExtension(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      <div className="flex flex-col h-[60vh]">
        {/* 简化的统计信息 */}
        <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-muted/50 rounded-lg flex-shrink-0">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              {t('extensions.totalExtensions')}
            </h4>
            <div className="text-2xl font-bold text-foreground">{extensions.length}</div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Power className="h-4 w-4" />
              {t('extensions.enabledExtensions')}
            </h4>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {extensions.filter((ext) => ext.enabled).length}
            </div>
          </div>
        </div>

        {/* 添加扩展按钮 */}
        <div className="flex justify-end mb-4 flex-shrink-0">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('extensions.addExtension')}
          </Button>
        </div>

        {/* 扩展列表容器 - 添加滚动条 */}
        <div className="flex-1 min-h-0 extension-scrollbar overflow-y-auto pr-2">
          {/* 加载状态 */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">
                {t('extensions.loadingExtensions')}
              </span>
            </div>
          )}

          {/* 扩展列表 */}
          {!isLoading && extensions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t('extensions.noExtensions')}</p>
            </div>
          )}

          {!isLoading && extensions.length > 0 && (
            <div className="space-y-3 pb-4">
              {extensions.map((ext) => (
                <div
                  key={ext.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${
                    ext.enabled
                      ? 'border-border bg-background'
                      : 'border-border bg-muted/50 opacity-60'
                  }`}
                >
                  {/* 扩展图标 */}
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </div>

                  {/* 扩展信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        className="font-medium truncate text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                        onClick={() => handleOpenExtensionOptions(ext)}
                        title={`点击打开 ${ext.name} 的选项页面`}
                      >
                        {ext.name}
                      </button>
                      <span className="text-xs text-muted-foreground">v{ext.version}</span>
                      {ext.permissions && (
                        <div className="flex items-center gap-1">
                          {getRiskIcon(ext.permissions.riskLevel)}
                          <span className="text-xs text-muted-foreground">
                            {ext.permissions.riskLevel}
                          </span>
                        </div>
                      )}
                    </div>

                    {ext.manifest?.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {ext.manifest.description}
                      </p>
                    )}

                    {/* 隔离信息 */}
                    {ext.session && (
                      <div className="flex items-center gap-2 mt-2">
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {getIsolationLevelText(ext.session.isolationLevel)}
                        </span>
                        {ext.session.memoryUsage > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(ext.session.memoryUsage / 1024 / 1024)}MB)
                          </span>
                        )}
                      </div>
                    )}

                    {/* 错误信息 */}
                    {ext.error && (
                      <div className="flex items-center gap-2 mt-2">
                        <AlertTriangle
                          className={`h-3 w-3 ${
                            ext.error.severity === 'critical'
                              ? 'text-red-500'
                              : ext.error.severity === 'high'
                                ? 'text-orange-500'
                                : ext.error.severity === 'medium'
                                  ? 'text-yellow-500'
                                  : 'text-blue-500'
                          }`}
                        />
                        <span className="text-xs text-muted-foreground">{ext.error.message}</span>
                      </div>
                    )}

                    {/* 权限信息 */}
                    {ext.manifest?.permissions && ext.manifest.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {ext.manifest.permissions.slice(0, 3).map((permission, index) => (
                          <div key={index} className="flex items-center gap-1">
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {permission}
                            </span>
                            {ext.permissions?.settings && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4 p-0"
                                onClick={() =>
                                  handleUpdatePermission(
                                    ext.id,
                                    permission,
                                    !ext.permissions?.settings.includes(permission)
                                  )
                                }
                                title={
                                  ext.permissions?.settings.includes(permission)
                                    ? t('extensions.revokePermission')
                                    : t('extensions.grantPermission')
                                }
                              >
                                {ext.permissions?.settings.includes(permission) ? (
                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                ) : (
                                  <XCircle className="h-3 w-3 text-gray-400" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                        {ext.manifest.permissions.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{ext.manifest.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleExtension(ext.id, !ext.enabled)}
                      title={ext.enabled ? t('extensions.disable') : t('extensions.enable')}
                    >
                      {ext.enabled ? (
                        <Power className="h-4 w-4" />
                      ) : (
                        <PowerOff className="h-4 w-4" />
                      )}
                    </Button>

                    {/* 调试按钮 */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleInspectExtension(ext)}
                      title="调试扩展信息"
                    >
                      <Info className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete({ id: ext.id, name: ext.name })}
                      title={t('extensions.remove')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 扩展详情对话框 */}
        {selectedExtension && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-background border rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{selectedExtension.name}</h3>
                <Button variant="ghost" size="icon" onClick={() => setSelectedExtension(null)}>
                  ×
                </Button>
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <span className="text-muted-foreground">版本:</span>
                  <span className="ml-2">v{selectedExtension.version}</span>
                </div>

                {selectedExtension.session && (
                  <div>
                    <span className="text-muted-foreground">隔离级别:</span>
                    <span className="ml-2">
                      {getIsolationLevelText(selectedExtension.session.isolationLevel)}
                    </span>
                  </div>
                )}

                {selectedExtension.permissions && (
                  <div>
                    <span className="text-muted-foreground">风险等级:</span>
                    <div className="flex items-center gap-2 ml-2">
                      {getRiskIcon(selectedExtension.permissions.riskLevel)}
                      <span>{selectedExtension.permissions.riskLevel}</span>
                    </div>
                  </div>
                )}

                {selectedExtension.manifest?.permissions && (
                  <div>
                    <span className="text-muted-foreground">权限:</span>
                    <div className="mt-2 space-y-1">
                      {selectedExtension.manifest.permissions.map((permission, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span>{permission}</span>
                          {selectedExtension.permissions?.settings && (
                            <span
                              className={`text-xs ${
                                selectedExtension.permissions.settings.includes(permission)
                                  ? 'text-green-500'
                                  : 'text-gray-500'
                              }`}
                            >
                              {selectedExtension.permissions.settings.includes(permission)
                                ? t('extensions.granted')
                                : t('extensions.denied')}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
