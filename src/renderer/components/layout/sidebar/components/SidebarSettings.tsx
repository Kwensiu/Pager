import React, { useState, useEffect } from 'react'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { Button } from '@/ui/button'
import { useI18n } from '@/i18n/useI18n'

export interface SidebarSettingsProps {
  showDebugOptions: boolean
  setShowDebugOptions: (value: boolean) => void
  onClearData: () => void
  onResetToDefaults: () => void
  onClearSoftwareData: () => void
  onClearCache: () => void
}

export default function SidebarSettings({
  showDebugOptions,
  setShowDebugOptions,
  onClearData,
  onResetToDefaults,
  onClearSoftwareData,
  onClearCache
}: SidebarSettingsProps): React.ReactElement {
  const { t, changeLanguage, getCurrentLanguage } = useI18n()
  // 从 localStorage 加载初始设置
  const loadInitialSettings = (): {
    theme: 'light' | 'dark' | 'system'
    language: string
    clearCacheOnExit: boolean
    saveSession: boolean
    enableJavaScript: boolean
    allowPopups: boolean
  } => {
    const savedSettings = localStorage.getItem('settings')
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)
      return {
        theme: parsed.theme || 'system',
        language: parsed.language || 'zh',
        clearCacheOnExit: parsed.clearCacheOnExit || false,
        saveSession: parsed.saveSession !== undefined ? parsed.saveSession : true,
        enableJavaScript: parsed.enableJavaScript !== undefined ? parsed.enableJavaScript : true,
        allowPopups: parsed.allowPopups !== undefined ? parsed.allowPopups : true
      }
    }
    return {
      theme: 'system',
      language: 'zh',
      clearCacheOnExit: false,
      saveSession: true,
      enableJavaScript: true,
      allowPopups: true
    }
  }

  const initialSettings = loadInitialSettings()
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(initialSettings.theme)
  const [language, setLanguage] = useState<string>(initialSettings.language)
  const [clearCacheOnExit, setClearCacheOnExit] = useState(initialSettings.clearCacheOnExit)
  const [saveSession, setSaveSession] = useState(initialSettings.saveSession)
  const [enableJavaScript, setEnableJavaScript] = useState(initialSettings.enableJavaScript)
  const [allowPopups, setAllowPopups] = useState(initialSettings.allowPopups)

  // 应用主题和保存设置到localStorage
  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemPrefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }

    // 获取现有设置并更新
    const savedSettings = localStorage.getItem('settings')
    let settings = { language: 'zh' } // 默认值
    if (savedSettings) {
      settings = JSON.parse(savedSettings)
    }

    const updatedSettings = {
      ...settings,
      theme,
      language,
      clearCacheOnExit,
      saveSession,
      enableJavaScript,
      allowPopups
    }

    localStorage.setItem('settings', JSON.stringify(updatedSettings))
  }, [theme, language, clearCacheOnExit, saveSession, enableJavaScript, allowPopups])

  // 处理语言更改
  const handleLanguageChange = async (newLanguage: string): Promise<void> => {
    setLanguage(newLanguage)

    // 如果新语言不同于当前语言，则更改
    if (newLanguage !== getCurrentLanguage()) {
      await changeLanguage(newLanguage)

      // 同时更新localStorage中的语言设置
      const savedSettings = localStorage.getItem('settings')
      let settings = {}
      if (savedSettings) {
        settings = JSON.parse(savedSettings)
      }

      const updatedSettings = {
        ...settings,
        language: newLanguage
      }

      localStorage.setItem('settings', JSON.stringify(updatedSettings))
    }
  }

  // 处理重置为默认设置
  const handleResetToDefaults = (): void => {
    setClearCacheOnExit(false)
    setSaveSession(true)
    setEnableJavaScript(true)
    setAllowPopups(true)
    setTheme('system')
    setLanguage('zh')
  }

  return (
    <div className="p-6 h-full overflow-y-auto bg-background text-foreground">
      <h1 className="text-2xl font-bold mb-6 text-foreground">{t('settings.title')}</h1>

      <div className="mb-6 p-4 border rounded-lg bg-muted/50 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-foreground">{t('settings.debugMode')}</Label>
          </div>
          <Switch checked={showDebugOptions} onCheckedChange={setShowDebugOptions} />
        </div>
      </div>

      <div className="space-y-6">
        {/* 常规设置 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">{t('settings.general')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.autoCheckUpdates')}</Label>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.minimizeToTray')}</Label>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* 界面设置 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">{t('settings.interface')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.themeMode')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.themeDescription')}</p>
              </div>
              <Select
                value={theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
              >
                <SelectTrigger className="w-32 dark:border-gray-600 dark:bg-gray-800 dark:text-foreground">
                  <SelectValue
                    placeholder={t('settings.selectTheme')}
                    className="dark:text-foreground"
                  />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600 dark:text-foreground">
                  <SelectItem value="light" className="dark:text-foreground dark:focus:bg-gray-700">
                    {t('settings.light')}
                  </SelectItem>
                  <SelectItem value="dark" className="dark:text-foreground dark:focus:bg-gray-700">
                    {t('settings.dark')}
                  </SelectItem>
                  <SelectItem
                    value="system"
                    className="dark:text-foreground dark:focus:bg-gray-700"
                  >
                    {t('settings.followSystem')}
                  </SelectItem>
                  <SelectItem
                    value="follow-light-dark"
                    className="dark:text-foreground dark:focus:bg-gray-700"
                  >
                    {t('settings.followLightDark')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.languageMode')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.languageDescription')}</p>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-32 dark:border-gray-600 dark:bg-gray-800 dark:text-foreground">
                  <SelectValue
                    placeholder={t('settings.selectLanguage')}
                    className="dark:text-foreground"
                  />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800 dark:border-gray-600 dark:text-foreground">
                  <SelectItem value="zh" className="dark:text-foreground dark:focus:bg-gray-700">
                    {t('settings.chinese')}
                  </SelectItem>
                  <SelectItem value="en" className="dark:text-foreground dark:focus:bg-gray-700">
                    {t('settings.english')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 浏览器设置 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">{t('settings.browser')}</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.enableJs')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.jsDescription')}</p>
              </div>
              <Switch checked={enableJavaScript} onCheckedChange={setEnableJavaScript} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.allowPopups')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.popupDescription')}</p>
              </div>
              <Switch checked={allowPopups} onCheckedChange={setAllowPopups} />
            </div>
          </div>
        </div>

        {/* 隐私与数据 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            {t('settings.privacyData')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.saveSession')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.sessionDescription')}</p>
              </div>
              <Switch checked={saveSession} onCheckedChange={setSaveSession} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">{t('settings.clearCacheOnExit')}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.cacheDescription')}</p>
              </div>
              <Switch checked={clearCacheOnExit} onCheckedChange={setClearCacheOnExit} />
            </div>
          </div>
        </div>

        {/* 数据管理 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            {t('settings.dataManagement')}
          </h2>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={handleResetToDefaults}>
              {t('settings.resetToDefault')}
            </Button>

            <Button variant="destructive" className="w-full" onClick={onClearData}>
              {t('settings.clearAllData')}
            </Button>
          </div>
        </div>

        {/* Debug选项：仅在Debug模式开启时显示 */}
        {showDebugOptions && (
          <div className="border-red-500 border-2 rounded-lg p-4 bg-red-50 dark:bg-red-900/20 dark:border-red-700">
            <h2 className="text-lg font-semibold mb-2 text-red-700 dark:text-red-300">
              {t('settings.debugOptions')}
            </h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-red-600 dark:text-red-400">{t('settings.warning')}</p>

                <Button variant="destructive" className="w-full" onClick={onClearSoftwareData}>
                  {t('settings.clearSoftwareData')}
                </Button>

                <Button variant="secondary" className="w-full" onClick={onResetToDefaults}>
                  {t('settings.resetToDefaults')}
                </Button>

                <Button variant="destructive" className="w-full" onClick={onClearCache}>
                  {t('settings.clearCache')}
                </Button>

                <Button variant="destructive" className="w-full" onClick={onClearData}>
                  {t('settings.clearAllData')}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 关于 */}
        <div className="border rounded-lg p-4 dark:border-gray-700 bg-card text-card-foreground">
          <h2 className="text-lg font-semibold mb-4 text-foreground">{t('settings.about')}</h2>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t('settings.version')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.electronVersion')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.chromiumVersion')}</p>
            <p className="text-sm text-muted-foreground">{t('settings.nodeVersion')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
