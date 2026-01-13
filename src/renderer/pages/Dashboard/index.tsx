import { useState, useCallback, useEffect, useReducer } from 'react'
import { WebViewContainer } from '@/components/features/WebViewContainer'
import { Website } from '@/types/website'
import { ExtensionManager } from '@/components/features/ExtensionManager'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ui/dialog'
import { useI18n } from '@/core/i18n/useI18n'

interface DashboardProps {
  currentWebsite: Website | null
}

function Dashboard({ currentWebsite }: DashboardProps): React.ReactElement {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [showExtensionManager, setShowExtensionManager] = useState(false)

  // 使用 reducer 管理 openedWebsites 状态
  const openedWebsitesReducer = (
    state: Website[],
    action: { type: string; payload?: { website: Website } }
  ): Website[] => {
    switch (action.type) {
      case 'ADD_IF_NOT_EXISTS': {
        if (!action.payload) return state
        const website = action.payload.website
        if (!state.some((w) => w.url === website.url)) {
          return [...state, website]
        }
        return state
      }
      default:
        return state
    }
  }

  const [openedWebsites, dispatch] = useReducer(openedWebsitesReducer, [])

  // 记录所有打开过的网站
  useEffect(() => {
    if (currentWebsite) {
      dispatch({ type: 'ADD_IF_NOT_EXISTS', payload: { website: currentWebsite } })
    }
  }, [currentWebsite])

  const handleRefresh = useCallback(() => {
    window.api.webview.reload()
    setIsLoading(true)
    setTimeout(() => setIsLoading(false), 1000)
  }, [])

  const handleGoBack = useCallback(() => {
    window.api.webview.goBack()
  }, [])

  const handleGoForward = useCallback(() => {
    window.api.webview.goForward()
  }, [])

  const handleOpenExternal = useCallback((url: string) => {
    // 使用window.open打开外部链接
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const handleExtensionClick = useCallback(() => {
    setShowExtensionManager(true)
  }, [])

  return (
    <div className="h-full w-full relative">
      {/* 渲染所有打开过的网站，但只显示当前选中的 */}
      {openedWebsites.map((website) => (
        <div
          key={website.url}
          className="absolute inset-0"
          style={{ display: currentWebsite?.url === website.url ? 'block' : 'none' }}
        >
          <WebViewContainer
            url={website.url}
            isLoading={isLoading}
            onRefresh={handleRefresh}
            onGoBack={handleGoBack}
            onGoForward={handleGoForward}
            onOpenExternal={() => handleOpenExternal(website.url)}
            onExtensionClick={handleExtensionClick}
          />
        </div>
      ))}

      {/* 扩展管理器对话框 */}
      <Dialog open={showExtensionManager} onOpenChange={setShowExtensionManager}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('extensions.title')}</DialogTitle>
            <DialogDescription>{t('extensions.description')}</DialogDescription>
          </DialogHeader>
          <ExtensionManager open={showExtensionManager} onOpenChange={setShowExtensionManager} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Dashboard
