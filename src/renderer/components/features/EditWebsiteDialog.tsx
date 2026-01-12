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
import { Website } from '@/types/website'
import { Favicon } from './Favicon'
import { useI18n } from '@/i18n/useI18n'

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
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [faviconUrl, setFaviconUrl] = useState('')

  useEffect(() => {
    if (website) {
      setName(website.name)
      setUrl(website.url)
      setFaviconUrl(website.favicon || website.url || '')
    } else {
      // 重置表单
      setName('')
      setUrl('')
      setFaviconUrl('')
    }
  }, [website])

  const handleSave = (): void => {
    if (!website) return

    const updatedWebsite = {
      ...website,
      name,
      url,
      favicon: faviconUrl || undefined
    }

    onSave(updatedWebsite)
    onOpenChange(false)
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
              <span className="text-sm truncate max-w-[200px]">{faviconUrl || t('noFavicon')}</span>
            </div>
          </div>
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
            disabled={!name.trim() || !url.trim()}
            aria-label={
              !name.trim() || !url.trim() ? t('enterNameAndUrlToSave') : t('saveWebsiteChanges')
            }
          >
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
