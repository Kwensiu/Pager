import { useEffect } from 'react'
import SidebarLayout from '@/components/layout/SidebarLayout'
import Dashboard from '@/pages/Dashboard'
import { I18nProviderWrapper } from './core/i18n/I18nProvider'

function App(): JSX.Element {
  useEffect(() => {
    const bridgeLegacyState = async (): Promise<void> => {
      try {
        const rawSettings = localStorage.getItem('settings')
        let parsedSettings: Record<string, unknown> = {}
        if (rawSettings) {
          parsedSettings = JSON.parse(rawSettings)
        }

        await window.api.store.bridgeLegacyRendererState({
          hasInitialized: localStorage.getItem('hasInitialized') === 'true',
          settings: {
            theme:
              typeof parsedSettings.theme === 'string'
                ? (parsedSettings.theme as string)
                : undefined,
            sidebarOpen:
              typeof parsedSettings.sidebarOpen === 'boolean'
                ? (parsedSettings.sidebarOpen as boolean)
                : undefined
          }
        })
      } catch (error) {
        console.error('[App] Failed to bridge legacy renderer state:', error)
      }
    }

    void bridgeLegacyState()
  }, [])

  // 极简主题应用
  useEffect(() => {
    const applyTheme = (): void => {
      const savedSettings = localStorage.getItem('settings')
      let theme = 'dark' // 默认深色

      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          theme = parsed.theme || 'dark'
        } catch (error) {
          console.error('Failed to parse settings:', error)
        }
      }

      console.log('[App] Applying content theme:', theme)

      const root = document.documentElement

      // 完全清除 dark class
      root.classList.remove('dark')

      // 只处理深色模式
      if (theme === 'dark') {
        root.classList.add('dark')
      }
      // 浅色模式：什么都不做

      console.log('[App] Root classes:', root.className)
    }

    // 初始应用
    applyTheme()

    // 监听设置变化
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'settings') {
        console.log('[App] Settings changed')
        applyTheme()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  return (
    <I18nProviderWrapper>
      <SidebarLayout>
        {(currentWebsite) => <Dashboard currentWebsite={currentWebsite} />}
      </SidebarLayout>
    </I18nProviderWrapper>
  )
}

export default App
