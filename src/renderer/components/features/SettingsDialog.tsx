import { useState, useEffect } from 'react'
import { Settings, Save, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { ConfirmDialog } from '@/components/features/ConfirmDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { useI18n } from '@/i18n/useI18n'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): JSX.Element {
  const { t, changeLanguage, getCurrentLanguage } = useI18n()

  // 从 localStorage 加载初始设置
  const loadInitialSettings = (): {
    clearCacheOnExit: boolean
    saveSession: boolean
    enableJavaScript: boolean
    allowPopups: boolean
    theme: 'light' | 'dark' | 'system'
    language: string
  } => {
    const savedSettings = localStorage.getItem('settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        return {
          clearCacheOnExit: parsed.clearCacheOnExit || false,
          saveSession: parsed.saveSession || true,
          enableJavaScript: parsed.enableJavaScript || true,
          allowPopups: parsed.allowPopups || true,
          theme: parsed.theme || 'system',
          language: parsed.language || 'zh'
        }
      } catch {
        // 如果解析失败，返回默认值
      }
    }
    return {
      clearCacheOnExit: false,
      saveSession: true,
      enableJavaScript: true,
      allowPopups: true,
      theme: 'system',
      language: 'zh'
    }
  }

  const initialSettings = loadInitialSettings()
  const [clearCacheOnExit, setClearCacheOnExit] = useState(initialSettings.clearCacheOnExit)
  const [saveSession, setSaveSession] = useState(initialSettings.saveSession)
  const [enableJavaScript, setEnableJavaScript] = useState(initialSettings.enableJavaScript)
  const [allowPopups, setAllowPopups] = useState(initialSettings.allowPopups)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialSettings.theme)
  const [language, setLanguage] = useState<string>(initialSettings.language)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // 应用主题
  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemPrefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }

    // 确保文字可读性
    const updateTextColors = (): void => {
      const isDarkMode = root.classList.contains('dark')
      const textElements = document.querySelectorAll('.text-muted-foreground')

      textElements.forEach((el) => {
        ;(el as HTMLElement).style.color = isDarkMode ? '#ffffff' : '#000000'
      })
    }

    updateTextColors()
  }, [theme])

  const handleSave = async (): Promise<void> => {
    // 保存设置到本地存储
    localStorage.setItem(
      'settings',
      JSON.stringify({
        clearCacheOnExit,
        saveSession,
        enableJavaScript,
        allowPopups,
        theme,
        language
      })
    )

    // 切换语言
    if (language !== getCurrentLanguage()) {
      await changeLanguage(language)
    }

    onOpenChange(false)
  }

  const handleReset = (): void => {
    setClearCacheOnExit(false)
    setSaveSession(true)
    setEnableJavaScript(true)
    setAllowPopups(true)
    setTheme('system')
    setLanguage('zh')
  }

  const handleClearAllData = (): void => {
    setShowConfirmDialog(true)
  }

  const handleConfirmClearData = (): void => {
    localStorage.clear()
    location.reload()
    setShowConfirmDialog(false)
  }

  const handleCancelClearData = (): void => {
    setShowConfirmDialog(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t('settings.title')}
          </DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* 外观设置 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('settings.appearance')}</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.themeMode')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.themeDescription')}</p>
              </div>
              <Select
                value={theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('settings.selectTheme')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('settings.light')}</SelectItem>
                  <SelectItem value="dark">{t('settings.dark')}</SelectItem>
                  <SelectItem value="system">{t('settings.followSystem')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 语言设置 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('settings.language')}</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.languageMode')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
              </div>
              <Select value={language} onValueChange={(value: string) => setLanguage(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder={t('settings.selectLanguage')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">{t('settings.chinese')}</SelectItem>
                  <SelectItem value="en">{t('settings.english')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 浏览器设置 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('settings.browser')}</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.enableJs')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.jsDescription')}</p>
              </div>
              <Switch checked={enableJavaScript} onCheckedChange={setEnableJavaScript} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.allowPopups')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.popupDescription')}</p>
              </div>
              <Switch checked={allowPopups} onCheckedChange={setAllowPopups} />
            </div>
          </div>

          {/* 隐私与数据 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('settings.privacyData')}</h3>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.saveSession')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.sessionDescription')}</p>
              </div>
              <Switch checked={saveSession} onCheckedChange={setSaveSession} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('settings.clearCacheOnExit')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.cacheDescription')}</p>
              </div>
              <Switch checked={clearCacheOnExit} onCheckedChange={setClearCacheOnExit} />
            </div>
          </div>

          {/* 数据管理 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{t('settings.dataManagement')}</h3>

            <Button variant="outline" className="w-full justify-start gap-2" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              {t('settings.resetToDefault')}
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start gap-2"
              onClick={handleClearAllData}
            >
              <Trash2 className="h-4 w-4" />
              {t('settings.clearAllData')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            {t('settings.saveSettings')}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={t('confirmDialog.clearDataTitle')}
        description={t(
          'confirmDialog.clearDataDescription',
          '确定要清除所有数据吗？这将删除所有保存的网站和分组。此操作不可撤销。'
        )}
        onConfirm={handleConfirmClearData}
        onCancel={handleCancelClearData}
      />
    </Dialog>
  )
}
