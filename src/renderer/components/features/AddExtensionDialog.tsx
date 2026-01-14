import { useState, useEffect } from 'react'
import { FolderOpen, FileArchive, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { useI18n } from '@/core/i18n/useI18n'

interface AddExtensionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (path: string) => void
}

interface ExtensionPreview {
  name: string
  version: string
  description?: string
  permissions?: string[]
}

export function AddExtensionDialog({
  open,
  onOpenChange,
  onAdd
}: AddExtensionDialogProps): JSX.Element {
  const { t } = useI18n()
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    valid: boolean
    error?: string
    manifest?: ExtensionPreview
  } | null>(null)
  const [installMode, setInstallMode] = useState<'folder' | 'zip' | 'crx'>('folder')

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSelectedPath('')
      setValidationResult(null)
      setInstallMode('folder')
    }
  }, [open])

  // 选择文件夹
  const handleSelectFolder = async (): Promise<void> => {
    try {
      const result = await window.api.dialog.openDirectory({
        title: t('extensions.selectExtensionFolder')
      })

      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0]
        setSelectedPath(path)
        await validateExtension(path)
      }
    } catch (error) {
      console.error('Failed to select folder:', error)
    }
  }

  // 选择 ZIP 文件
  const handleSelectZip = async (): Promise<void> => {
    try {
      const result = await window.api.dialog.openFile({
        title: t('extensions.selectExtensionZip'),
        properties: ['openFile'],
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      })

      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0]
        setSelectedPath(path)
        await validateExtension(path)
      }
    } catch (error) {
      console.error('Failed to select ZIP file:', error)
    }
  }

  // 选择 CRX 文件
  const handleSelectCrx = async (): Promise<void> => {
    try {
      const result = await window.api.dialog.openFile({
        title: t('extensions.selectExtensionCrx'),
        properties: ['openFile'],
        filters: [{ name: 'CRX Files', extensions: ['crx'] }]
      })

      if (result && !result.canceled && result.filePaths.length > 0) {
        const path = result.filePaths[0]
        setSelectedPath(path)
        await validateExtension(path)
      }
    } catch (error) {
      console.error('Failed to select CRX file:', error)
    }
  }

  // 翻译错误消息
  const translateError = (errorMessage: string): string => {
    // CRX 相关错误
    if (errorMessage.includes('Invalid CRX file: magic number mismatch')) {
      return t('extensions.errors.crxMagicMismatch')
    }
    if (errorMessage.includes('Unsupported CRX version')) {
      return t('extensions.errors.unsupportedCrxVersion')
    }
    if (errorMessage.includes('Invalid CRX file: header size exceeds file size')) {
      return t('extensions.errors.crxHeaderTooLarge')
    }
    if (errorMessage.includes('Failed to validate CRX extension')) {
      return t('extensions.errors.failedToValidateCrx')
    }
    if (errorMessage.includes('Failed to add extension from CRX')) {
      return t('extensions.errors.failedToAddCrx')
    }
    if (errorMessage.includes('ADM-ZIP: Invalid or unsupported zip format')) {
      return t('extensions.errors.invalidCrxFile')
    }

    // ZIP 相关错误
    if (errorMessage.includes('Failed to validate ZIP extension')) {
      return t('extensions.errors.invalidExtension')
    }
    if (errorMessage.includes('Failed to add extension from ZIP')) {
      return t('extensions.errors.loadFailed')
    }

    // 通用错误
    if (errorMessage.includes('Extension path does not exist')) {
      return t('extensions.validation.pathNotExist')
    }
    if (errorMessage.includes('manifest.json not found')) {
      return t('extensions.validation.manifestNotFound')
    }
    if (errorMessage.includes('Extension name is required')) {
      return t('extensions.validation.nameRequired')
    }
    if (errorMessage.includes('Extension version is required')) {
      return t('extensions.validation.versionRequired')
    }
    if (errorMessage.includes('manifest_version is required')) {
      return t('extensions.validation.manifestVersionRequired')
    }
    if (errorMessage.includes('Extension already exists')) {
      return t('extensions.validation.alreadyExists')
    }

    // 默认返回原始错误消息
    return errorMessage
  }

  // 验证扩展
  const validateExtension = async (path: string): Promise<void> => {
    setIsValidating(true)
    setValidationResult(null)

    try {
      const result = await window.api.extension.validate(path)

      if (result.valid && result.manifest) {
        setValidationResult({
          valid: true,
          manifest: {
            name: result.manifest.name,
            version: result.manifest.version,
            description: result.manifest.description,
            permissions: result.manifest.permissions
          }
        })
      } else {
        setValidationResult({
          valid: false,
          error: translateError(result.error || t('extensions.invalidExtension'))
        })
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        error: translateError(
          error instanceof Error ? error.message : t('extensions.invalidExtension')
        )
      })
    } finally {
      setIsValidating(false)
    }
  }

  // 添加扩展
  const handleAdd = async (): Promise<void> => {
    if (selectedPath && validationResult?.valid) {
      try {
        // 等待扩展添加完成后再关闭对话框
        await onAdd(selectedPath)
        // 确保操作成功后再关闭对话框
        onOpenChange(false)
      } catch (error) {
        console.error('Failed to add extension:', error)
      }
    }
  }

  const isValid = validationResult?.valid && selectedPath.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('extensions.addExtension')}</DialogTitle>
          <DialogDescription>{t('extensions.addExtensionDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1">
          {/* 安装模式选择 */}
          <div className="space-y-2">
            <Label>{t('extensions.installMode')}</Label>
            <div className="flex gap-2">
              <Button
                variant={installMode === 'folder' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setInstallMode('folder')}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {t('extensions.installFromFolder')}
              </Button>
              <Button
                variant={installMode === 'zip' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setInstallMode('zip')}
              >
                <FileArchive className="h-4 w-4 mr-2" />
                {t('extensions.installFromZip')}
              </Button>
              <Button
                variant={installMode === 'crx' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setInstallMode('crx')}
              >
                <FileArchive className="h-4 w-4 mr-2" />
                {t('extensions.installFromCrx')}
              </Button>
            </div>
          </div>

          {/* 文件/文件夹选择 */}
          <div className="space-y-2">
            <Label>
              {installMode === 'folder'
                ? t('extensions.extensionPath')
                : installMode === 'zip'
                  ? t('extensions.extensionZip')
                  : t('extensions.extensionCrx')}
            </Label>
            <div
              className="inline-flex items-start justify-start gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground cursor-pointer w-full"
              onClick={
                installMode === 'folder'
                  ? handleSelectFolder
                  : installMode === 'zip'
                    ? handleSelectZip
                    : handleSelectCrx
              }
            >
              {installMode === 'folder' ? (
                <FolderOpen className="h-4 w-4 shrink-0 mt-0.5" />
              ) : (
                <FileArchive className="h-4 w-4 shrink-0 mt-0.5" />
              )}
              <span className="break-all text-left flex-1">
                {selectedPath ||
                  (installMode === 'folder'
                    ? t('extensions.selectExtensionFolder')
                    : installMode === 'zip'
                      ? t('extensions.selectExtensionZip')
                      : t('extensions.selectExtensionCrx'))}
              </span>
            </div>
          </div>

          {/* 验证状态 */}
          {isValidating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('extensions.loadingExtensions')}
            </div>
          )}

          {/* 验证结果 */}
          {validationResult && !isValidating && (
            <div
              className={`rounded-lg border p-4 ${
                validationResult.valid
                  ? 'border-green-200 bg-green-50 dark:bg-green-950/20'
                  : 'border-red-200 bg-red-50 dark:bg-red-950/20'
              }`}
            >
              {validationResult.valid ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium text-foreground">
                      {t('extensions.extensionName')}
                    </span>
                  </div>
                  {validationResult.manifest && (
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium text-foreground">
                          {validationResult.manifest.name}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          v{validationResult.manifest.version}
                        </span>
                      </div>
                      {validationResult.manifest.description && (
                        <p className="text-muted-foreground line-clamp-3">
                          {validationResult.manifest.description}
                        </p>
                      )}
                      {validationResult.manifest.permissions &&
                        validationResult.manifest.permissions.length > 0 && (
                          <div>
                            <div className="font-medium text-foreground">
                              {t('extensions.permissions')}:
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {validationResult.manifest.permissions.map((permission, index) => (
                                <span
                                  key={index}
                                  className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                  {permission}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                  <span className="text-sm">{validationResult.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={!isValid}>
            {t('add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
