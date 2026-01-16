import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Website } from '@/types/website'
import { Favicon } from './Favicon'
import { Fingerprint } from 'lucide-react'
import { useI18n } from '@/core/i18n/useI18n'
import { useSettings } from '@/hooks/useSettings'

interface EditWebsiteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  website: Website | null
  onSave: (updatedWebsite: Website) => void
}

export function EditWebsiteDialog({
  open,
  onOpenChange,
  website,
  onSave
}: EditWebsiteDialogProps): JSX.Element {
  const { t } = useI18n()
  const { settings } = useSettings()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState('')
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false)
  const [fingerprintMode, setFingerprintMode] = useState<'basic' | 'balanced' | 'advanced'>(
    'balanced'
  )

  useEffect(() => {
    if (website) {
      setName(website.name)
      setUrl(website.url)
      setFaviconUrl(website.favicon || website.url || '')
      setFingerprintEnabled(website.fingerprintEnabled || false)
      setFingerprintMode(website.fingerprintMode || 'balanced')
    } else {
      // 重置表单
      setName('')
      setUrl('')
      setFaviconUrl('')
      setFingerprintEnabled(false)
      setFingerprintMode('balanced')
    }
  }, [website])

  const handleSave = (): void => {
    if (!website) return

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

    const updatedWebsite = {
      ...website,
      name,
      url: normalizedUrl,
      favicon: faviconUrl || undefined,
      fingerprintEnabled,
      fingerprintMode
    }

    onSave(updatedWebsite)

    // 延迟关闭对话框，确保状态更新完成
    setTimeout(() => {
      onOpenChange(false)
    }, 100)
  }

  // 验证URL是否有效
  const isValidUrl = (urlString: string): boolean => {
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

  const handleRefreshFavicon = async (): Promise<void> => {
    if (!url) return

    setIsRefreshing(true)
    try {
      const response = await window.api.getFavicon(url)
      if (response) {
        setFaviconUrl(response)
      } else {
        alert(t('failedToGetFavicon'))
      }
    } catch (error) {
      console.error('Error refreshing favicon:', error)
      alert(t('errorRefreshingFavicon'))
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editWebsite.title')}</DialogTitle>
          <DialogDescription>{t('editWebsite.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="name">{t('websiteName')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('websiteNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">{t('websiteUrl')}</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('urlPlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('websiteIcon')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefreshFavicon}
                disabled={isRefreshing || !url}
                aria-label={isRefreshing ? t('refreshingFavicon') : t('clickToRefreshFavicon')}
              >
                {isRefreshing ? t('refreshing') : t('refreshIcon')}
              </Button>
            </div>

            <div
              className="flex items-center gap-3 p-2 border rounded-md min-h-[40px]"
              role="img"
              aria-label={
                faviconUrl ? `${t('websiteFaviconFrom')}${faviconUrl}` : t('noWebsiteFavicon')
              }
            >
              <Favicon url={faviconUrl} className="h-5 w-5" />
              <span className="text-sm truncate max-w-[200px] text-foreground">
                {faviconUrl || t('noFavicon')}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" />
                  {t('enhancedFeatures.websiteFingerprint.enabled')}
                </Label>
              </div>
              <Switch checked={fingerprintEnabled} onCheckedChange={setFingerprintEnabled} />
            </div>
          </div>

          {fingerprintEnabled && (
            <div className="space-y-2">
              <Label htmlFor="fingerprint-mode">
                {t('enhancedFeatures.websiteFingerprint.mode')}
              </Label>
              <Select
                value={fingerprintMode}
                onValueChange={(value: 'basic' | 'balanced' | 'advanced') =>
                  setFingerprintMode(value)
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            aria-label={t('cancelEditWebsite')}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim() || !url.trim() || !isValidUrl(url)}
            aria-label={
              !name.trim() || !url.trim() || !isValidUrl(url)
                ? t('enterNameAndUrlToSave')
                : t('saveWebsiteChanges')
            }
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
