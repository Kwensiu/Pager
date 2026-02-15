import { useState, useEffect, useRef } from 'react'
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
import { Fingerprint, Code2, X } from 'lucide-react'
import { useI18n } from '@/core/i18n/useI18n'
import { useSettings } from '@/hooks/useSettings'
import { ScriptManager, UserScript } from './ScriptManager'

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
  const [, setJsCode] = useState<string[]>([])
  const [showScriptManager, setShowScriptManager] = useState(false)
  const [showScriptManagerManage, setShowScriptManagerManage] = useState(false)
  const [selectedScripts, setSelectedScripts] = useState<UserScript[]>([])

  // 开发模式日志开关
  const isDev = process.env.NODE_ENV === 'development'

  // 使用 ref 来跟踪上一次处理的 website，避免重复初始化
  const lastWebsiteRef = useRef<string | null>(null)

  // 从 jsCode 转换为 selectedScripts - 在对话框打开或编辑不同网站时初始化
  useEffect(() => {
    if (!open || !website) return

    // 只有当网站 ID 变化或首次打开时才重新初始化
    const websiteKey = `${website.id}_${website.jsCode?.length || 0}_${website.fingerprintEnabled}_${website.fingerprintMode}`
    if (lastWebsiteRef.current === websiteKey) return
    lastWebsiteRef.current = websiteKey

    if (isDev)
      console.log('[EditDialog] Loading website data:', {
        name: website.name,
        fingerprintEnabled: website.fingerprintEnabled,
        fingerprintMode: website.fingerprintMode,
        jsCodeLength: website.jsCode?.length || 0
      })

    setName(website.name)
    setUrl(website.url)
    setFaviconUrl(website.favicon || website.url || '')
    setFingerprintEnabled(website.fingerprintEnabled || false)
    setFingerprintMode(website.fingerprintMode || 'balanced')
    setJsCode(website.jsCode || [])

    // 从 localStorage 加载脚本库，将 jsCode 转换为 selectedScripts
    if (website.jsCode && website.jsCode.length > 0) {
      try {
        const stored = localStorage.getItem('pager_user_scripts')
        if (stored) {
          const allScripts: UserScript[] = JSON.parse(stored)
          // 使用精确匹配避免误匹配
          const matchedScripts = allScripts.filter((script) =>
            website.jsCode!.some((code) => code === script.code)
          )
          if (isDev)
            console.log(
              '[EditDialog] Matched scripts:',
              matchedScripts.map((s) => s.name)
            )
          setSelectedScripts(matchedScripts)
        }
      } catch (error) {
        console.error('[EditDialog] Failed to load scripts for selection:', error)
        setSelectedScripts([])
      }
    } else {
      if (isDev) console.log('[EditDialog] No jsCode, clearing selected scripts')
      setSelectedScripts([])
    }
  }, [open, website, isDev])

  const handleSave = (): void => {
    if (!website) return

    if (isDev)
      console.log('[EditDialog] handleSave called, current local state:', {
        fingerprintEnabled,
        fingerprintMode,
        selectedScriptsCount: selectedScripts.length,
        selectedScripts: selectedScripts.map((s) => s.name)
      })

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
      fingerprintMode,
      jsCode: selectedScripts.map((s) => s.code)
    }

    if (isDev)
      console.log('[EditDialog] Sending to onSave:', {
        fingerprintEnabled: updatedWebsite.fingerprintEnabled,
        fingerprintMode: updatedWebsite.fingerprintMode,
        jsCodeLength: updatedWebsite.jsCode?.length || 0
      })

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
    if (!url) {
      console.warn('🔄 Favicon refresh: No URL provided')
      return
    }

    console.log(`🔄 Starting favicon refresh for: ${url}`)
    setIsRefreshing(true)

    try {
      const response = await window.api.getFavicon(url, { force: true })

      if (response) {
        console.log(`✅ Favicon refresh successful for ${url}: ${response}`)
        setFaviconUrl(response)
      } else {
        console.warn(`⚠️ Favicon refresh failed for ${url}`)
        console.warn('💡 可能的原因:')
        console.warn('   • 网站没有favicon图标')
        console.warn('   • 网络连接问题')
        console.warn('   • 第三方favicon服务被屏蔽')
        console.warn('   • Electron应用网络限制')
        alert(
          `无法获取 ${url} 的favicon图标\n\n可能的原因：\n• 网站没有图标\n• 网络连接问题\n• 应用网络限制\n\n请检查网站是否可以正常访问`
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`❌ Favicon refresh failed for ${url}:`, errorMessage)
      alert(`获取图标时发生错误: ${errorMessage}`)
    } finally {
      setIsRefreshing(false)
      console.log(`🔄 Favicon refresh completed for: ${url}`)
    }
  }

  const handleRemoveScript = (scriptId: string): void => {
    setSelectedScripts(selectedScripts.filter((s) => s.id !== scriptId))
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

          {/* 脚本注入部分 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                JS 脚本注入
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowScriptManager(true)}
              >
                <Code2 className="h-4 w-4 mr-1" />
                选择脚本
              </Button>
            </div>

            {selectedScripts.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  已选择 {selectedScripts.length} 个脚本
                </div>
                <div className="space-y-2">
                  {selectedScripts.map((script) => (
                    <div
                      key={script.id}
                      className="flex items-center justify-between p-2 border rounded-md text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{script.name}</div>
                        {script.description && (
                          <div className="text-xs text-muted-foreground truncate">
                            {script.description}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveScript(script.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedScripts.length === 0 && (
              <div className="text-sm text-muted-foreground p-3 border border-dashed rounded-md">
                未选择任何脚本，点击&quot;选择脚本&quot;按钮添加
              </div>
            )}
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

        {/* 脚本选择对话框 */}
        <ScriptManager
          open={showScriptManager}
          onOpenChange={setShowScriptManager}
          mode="select"
          selectedScriptIds={selectedScripts.map((s) => s.id)}
          onSaveSelection={(scripts) => {
            setSelectedScripts(scripts)
          }}
          onManageScripts={() => {
            setShowScriptManager(false)
            setShowScriptManagerManage(true)
          }}
        />

        {/* 脚本管理对话框 */}
        <ScriptManager
          open={showScriptManagerManage}
          onOpenChange={setShowScriptManagerManage}
          mode="manage"
        />
      </DialogContent>
    </Dialog>
  )
}
