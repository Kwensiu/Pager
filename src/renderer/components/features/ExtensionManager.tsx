import { useState, useEffect } from 'react'
import { Plus, Trash2, Power, PowerOff, Loader2, Package } from 'lucide-react'
import { Button } from '@/ui/button'
import { useI18n } from '@/core/i18n/useI18n'
import { AddExtensionDialog } from './AddExtensionDialog'
import { ConfirmDialog } from './ConfirmDialog'

interface Extension {
  id: string
  name: string
  version: string
  path: string
  enabled: boolean
  manifest?: {
    description?: string
    permissions?: string[]
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

  // 当对话框打开时加载扩展
  useEffect(() => {
    if (open) {
      loadExtensions()
    }
  }, [open])

  // 添加扩展
  const handleAddExtension = async (path: string): Promise<void> => {
    try {
      await window.api.extension.add(path)
      await loadExtensions()
      setIsAddDialogOpen(false)
    } catch (error) {
      console.error('Failed to add extension:', error)
      throw error
    }
  }

  // 删除扩展
  const handleRemoveExtension = async (id: string): Promise<void> => {
    try {
      await window.api.extension.remove(id)
      await loadExtensions()
      setConfirmDelete(null)
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
                  </div>
                  {ext.manifest?.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {ext.manifest.description}
                    </p>
                  )}
                  {ext.manifest?.permissions && ext.manifest.permissions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ext.manifest.permissions.slice(0, 3).map((permission, index) => (
                        <span
                          key={index}
                          className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {permission}
                        </span>
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
    </>
  )
}
