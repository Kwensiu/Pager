import { useState } from 'react'
import { Globe, Fingerprint } from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { Switch } from '@/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Website } from '@/types/website'
import { useI18n } from '@/core/i18n/useI18n'
import { useSettings } from '@/hooks/useSettings'

interface AddWebsiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddWebsite: (website: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>) => void
  groupId: string
}

export function AddWebsiteDialog({
  open,
  onOpenChange,
  onAddWebsite
}: AddWebsiteDialogProps): JSX.Element {
  const { t } = useI18n()
  const { settings } = useSettings()
  const [formData, setFormData] = useState(() => {
    // 初始化表单数据
    return {
      name: '',
      url: '',
      description: '',
      fingerprintEnabled: false,
      fingerprintMode: 'balanced' as 'basic' | 'balanced' | 'advanced',
      errors: {} as { name?: string; url?: string }
    }
  })

  // 当对话框关闭再打开时，组件会重新挂载，因此状态会自动重置

  const { name, url, description, fingerprintEnabled, fingerprintMode, errors } = formData

  const validate = (): boolean => {
    const newErrors: { name?: string; url?: string } = {}

    if (!name.trim()) {
      newErrors.name = t('websiteNameRequired')
    }

    if (!url.trim()) {
      newErrors.url = t('websiteUrlRequired')
    } else if (!isValidUrl(url.trim())) {
      newErrors.url = t('invalidUrl')
    }

    const hasErrors = Object.keys(newErrors).length > 0
    if (hasErrors) {
      setFormData((prev) => ({ ...prev, errors: newErrors }))
    } else {
      setFormData((prev) => ({ ...prev, errors: {} }))
    }

    return !hasErrors
  }

  const isValidUrl = (urlString: string): boolean => {
    // 自动添加协议前缀（如果没有协议）
    let normalizedUrl = urlString.trim()
    if (
      !normalizedUrl.startsWith('http://') &&
      !normalizedUrl.startsWith('https://') &&
      !normalizedUrl.startsWith('file://')
    ) {
      // 检查是否为文件路径（仅在设置允许时）
      if (
        settings.allowLocalFileAccess &&
        (normalizedUrl.includes('\\') ||
          normalizedUrl.startsWith('/') ||
          normalizedUrl.includes(':'))
      ) {
        // Windows路径或Unix路径，转换为file://
        if (normalizedUrl.includes(':') && !normalizedUrl.startsWith('/')) {
          // Windows路径: C:\path\to\file
          normalizedUrl = 'file:///' + normalizedUrl.replace(/\\/g, '/').replace(/^C:/i, 'C:')
        } else {
          // Unix路径或已格式化的Windows路径
          normalizedUrl = 'file://' + normalizedUrl
        }
      } else if (
        normalizedUrl.startsWith('localhost') ||
        /^\d+\.\d+\.\d+\.\d+/.test(normalizedUrl)
      ) {
        // 对于localhost和IP地址，优先使用http
        normalizedUrl = 'http://' + normalizedUrl
      } else {
        // 普通域名使用https
        normalizedUrl = 'https://' + normalizedUrl
      }
    }

    try {
      const url = new URL(normalizedUrl)
      // 根据设置决定是否允许file协议
      if (url.protocol === 'file:' && !settings.allowLocalFileAccess) {
        return false
      }
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'file:'
    } catch {
      return false
    }
  }

  const handleSubmit = (): void => {
    if (validate()) {
      // 智能添加协议前缀（如果没有协议）
      let normalizedUrl = url.trim()
      if (
        !normalizedUrl.startsWith('http://') &&
        !normalizedUrl.startsWith('https://') &&
        !normalizedUrl.startsWith('file://')
      ) {
        // 检查是否为文件路径（仅在设置允许时）
        if (
          settings.allowLocalFileAccess &&
          (normalizedUrl.includes('\\') ||
            normalizedUrl.startsWith('/') ||
            normalizedUrl.includes(':'))
        ) {
          // Windows路径或Unix路径，转换为file://
          if (normalizedUrl.includes(':') && !normalizedUrl.startsWith('/')) {
            // Windows路径: C:\path\to\file
            normalizedUrl = 'file:///' + normalizedUrl.replace(/\\/g, '/').replace(/^C:/i, 'C:')
          } else {
            // Unix路径或已格式化的Windows路径
            normalizedUrl = 'file://' + normalizedUrl
          }
        } else if (
          normalizedUrl.startsWith('localhost') ||
          /^\d+\.\d+\.\d+\.\d+/.test(normalizedUrl)
        ) {
          // 对于localhost和IP地址，优先使用http
          normalizedUrl = 'http://' + normalizedUrl
        } else {
          // 普通域名使用https
          normalizedUrl = 'https://' + normalizedUrl
        }
      }

      onAddWebsite({
        name: name.trim(),
        url: normalizedUrl,
        description: description.trim() || undefined,
        fingerprintEnabled: fingerprintEnabled,
        fingerprintMode: fingerprintMode,
        order: 0
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" key={open.toString()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('addWebsite.title')}
          </DialogTitle>
          <DialogDescription>{t('addWebsite.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="website-name">
              {t('websiteName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="website-name"
              placeholder={t('websiteNamePlaceholder')}
              value={name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website-url">
              {t('websiteUrl')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="website-url"
              placeholder={t('urlPlaceholder')}
              value={url}
              onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
              className={errors.url ? 'border-destructive' : ''}
            />
            {errors.url && <p className="text-sm text-destructive">{errors.url}</p>}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website-description">{t('websiteDescription')}</Label>
            <Input
              id="website-description"
              placeholder={t('websiteDescriptionPlaceholder')}
              value={description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="fingerprint-enabled" className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" />
                  {t('enhancedFeatures.websiteFingerprint.enabled')}
                </Label>
              </div>
              <Switch
                id="fingerprint-enabled"
                checked={fingerprintEnabled}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, fingerprintEnabled: checked }))
                }
              />
            </div>
          </div>

          {fingerprintEnabled && (
            <div className="grid gap-2">
              <Label htmlFor="fingerprint-mode">
                {t('enhancedFeatures.websiteFingerprint.mode')}
              </Label>
              <Select
                value={fingerprintMode}
                onValueChange={(value: 'basic' | 'balanced' | 'advanced') =>
                  setFormData((prev) => ({ ...prev, fingerprintMode: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    {t('enhancedFeatures.websiteFingerprint.modeBasic')}
                  </SelectItem>
                  <SelectItem value="balanced">
                    {t('enhancedFeatures.websiteFingerprint.modeBalanced')}
                  </SelectItem>
                  <SelectItem value="advanced">
                    {t('enhancedFeatures.websiteFingerprint.modeAdvanced')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
