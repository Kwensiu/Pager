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
  Info,
  Settings
} from 'lucide-react'
import { Button } from '@/ui/button'
import { useI18n } from '@/core/i18n/useI18n'
import { AddExtensionDialog } from './AddExtensionDialog'
import { ConfirmDialog } from './ConfirmDialog'

interface Extension {
  id: string
  name: string
  version: string
  path?: string
  enabled: boolean
  manifest?: {
    description?: string
    permissions?: string[]
  }
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
  const [errorStats, setErrorStats] = useState<any>(null)
  const [permissionStats, setPermissionStats] = useState<any>(null)
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

  // 加载统计信息
  const loadStats = async (): Promise<void> => {
    try {
      const [errorResult, permissionResult] = await Promise.all([
        window.api.extension.getErrorStats(),
        window.api.extension.getPermissionStats()
      ])

      if (errorResult.success) {
        setErrorStats(errorResult.stats)
      }

      if (permissionResult.success) {
        setPermissionStats(permissionResult.stats)
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }

  // 当对话框打开时加载扩展
  useEffect(() => {
    if (open) {
      loadExtensions()
      loadStats()
    }
  }, [open])

  // 添加扩展（使用隔离和权限验证）
  const handleAddExtension = async (path: string): Promise<void> => {
    try {
      const result = await window.api.extension.loadWithIsolation(path)
      if (result.success) {
        await loadExtensions()
        await loadStats()
        setIsAddDialogOpen(false)

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
        await loadStats()
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
        return t('extensions.isolation.none')
      default:
        return level
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

      <div className="p-4">
        {/* 统计信息 */}
        {(errorStats || permissionStats) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
            {errorStats && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('extensions.errorStats')}
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    {t('extensions.totalErrors')}: {errorStats.totalErrors}
                  </div>
                  <div>
                    {t('extensions.recentErrors')}: {errorStats.recentErrors.length}
                  </div>
                </div>
              </div>
            )}
            {permissionStats && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t('extensions.permissionStats')}
                </h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    {t('extensions.totalPermissions')}: {permissionStats.totalPermissions}
                  </div>
                  <div>
                    {t('extensions.highRiskPermissions')}:{' '}
                    {permissionStats.permissionsByRisk.high || 0}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 添加扩展按钮 */}
        <div className="flex justify-end mb-4">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('extensions.addExtension')}
          </Button>
        </div>

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">{t('extensions.loadingExtensions')}</span>
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
          <div className="space-y-3">
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
                    <h3 className="font-medium truncate text-foreground">{ext.name}</h3>
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
                    {ext.enabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSelectedExtension(ext)}
                    title={t('extensions.details')}
                  >
                    <Settings className="h-4 w-4" />
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
