import { useState, useEffect } from 'react'
import SidebarLayout from '@/components/layout/SidebarLayout'
import Dashboard from '@/pages/Dashboard'
import { Website } from '@/types/website'
import { I18nProviderWrapper } from './i18n/I18nProvider'

function App(): JSX.Element {
  const [activeWebsiteId, setActiveWebsiteId] = useState<string | null>(null)

  // 初始化主题
  useEffect(() => {
    const savedSettings = localStorage.getItem('settings')
    let theme = 'system' // 默认值

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        theme = parsed.theme || 'system'
      } catch (error) {
        console.error('Failed to parse settings:', error)
      }
    }

    const root = document.documentElement

    if (theme === 'system' || theme === 'follow-light-dark') {
      // 处理亮暗跟随模式
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemPrefersDark)

      // 监听系统主题变化
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent): void => {
        root.classList.toggle('dark', e.matches)
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }

    // 确保所有代码路径都有返回值
    return undefined
  }, [])

  const handleWebsiteClick = (website: Website): void => {
    setActiveWebsiteId(website.id)
  }

  return (
    <I18nProviderWrapper>
      <SidebarLayout activeWebsiteId={activeWebsiteId} onWebsiteClick={handleWebsiteClick}>
        {(currentWebsite) => <Dashboard currentWebsite={currentWebsite} />}
      </SidebarLayout>
    </I18nProviderWrapper>
  )
}

export default App
