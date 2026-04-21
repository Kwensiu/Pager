import { useState, useCallback, useEffect, useReducer } from 'react'
import { WebViewContainer } from '@/components/features/WebViewContainer'
import { Website } from '@/types/website'
import { ExtensionManager } from '@/components/features/ExtensionManager'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ui/dialog'
import { useI18n } from '@/core/i18n/useI18n'

interface DashboardProps {
  currentWebsite: Website | null
}

type OpenedWebsitesAction =
  | { type: 'UPSERT'; payload: { website: Website } }
  | { type: 'REMOVE'; payload: { websiteId: string } }

const openedWebsitesReducer = (state: Website[], action: OpenedWebsitesAction): Website[] => {
  switch (action.type) {
    case 'UPSERT': {
      const website = action.payload.website
      const existingIndex = state.findIndex((item) => item.id === website.id)

      if (existingIndex === -1) {
        return [...state, website]
      }

      const nextState = [...state]
      nextState[existingIndex] = website
      return nextState
    }
    case 'REMOVE':
      return state.filter((website) => website.id !== action.payload.websiteId)
    default:
      return state
  }
}

function Dashboard({ currentWebsite }: DashboardProps): React.ReactElement {
  const { t } = useI18n()
  const [isLoading, setIsLoading] = useState(false)
  const [showExtensionManager, setShowExtensionManager] = useState(false)
  const [sessionUrlOverrides, setSessionUrlOverrides] = useState<Record<string, string>>({})

  // 会话恢复功能
  const restoreSessions = useCallback(async (): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionAPI = (window.api as any).session

      if (sessionAPI && sessionAPI.getAll) {
        const sessions = await sessionAPI.getAll()

        // 创建websiteId到URL的映射
        const overrides: Record<string, string> = {}
        sessions.forEach((session: { websiteId?: string; url?: string }) => {
          if (session.websiteId && session.url) {
            overrides[session.websiteId] = session.url
          }
        })

        setSessionUrlOverrides(overrides)
      }
    } catch (error) {
      console.error('恢复会话失败:', error)
    }
  }, [])

  const [openedWebsites, dispatch] = useReducer(openedWebsitesReducer, [])

  // 记录并同步所有打开过的网站（按 website.id 维护）
  useEffect(() => {
    if (currentWebsite) {
      dispatch({ type: 'UPSERT', payload: { website: currentWebsite } })
    }
  }, [currentWebsite])

  useEffect(() => {
    const handleWebsiteUpdated = (event: Event): void => {
      const customEvent = event as CustomEvent<{ website?: Website }>
      const updatedWebsite = customEvent.detail?.website

      if (!updatedWebsite) {
        return
      }

      dispatch({ type: 'UPSERT', payload: { website: updatedWebsite } })
    }

    const handleWebsiteDeleted = (event: Event): void => {
      const customEvent = event as CustomEvent<{ websiteId?: string }>
      const websiteId = customEvent.detail?.websiteId

      if (!websiteId) {
        return
      }

      dispatch({ type: 'REMOVE', payload: { websiteId } })
      setSessionUrlOverrides((prev) => {
        if (!(websiteId in prev)) {
          return prev
        }

        const next = { ...prev }
        delete next[websiteId]
        return next
      })
    }

    window.addEventListener('pager:website-updated', handleWebsiteUpdated as EventListener)
    window.addEventListener('pager:website-deleted', handleWebsiteDeleted as EventListener)

    return () => {
      window.removeEventListener('pager:website-updated', handleWebsiteUpdated as EventListener)
      window.removeEventListener('pager:website-deleted', handleWebsiteDeleted as EventListener)
    }
  }, [])

  // 应用启动时恢复会话（只执行一次）
  useEffect(() => {
    let mounted = true

    const restore = async (): Promise<void> => {
      try {
        await restoreSessions()
      } catch (error) {
        if (mounted) {
          console.error('应用启动时恢复会话失败:', error)
        }
      }
    }

    restore()

    return () => {
      mounted = false
    }
  }, [restoreSessions])

  // 计算网站的指纹设置
  const getWebsiteFingerprintSettings = useCallback(
    (
      website: Website
    ): {
      fingerprintEnabled: boolean
      fingerprintMode: 'basic' | 'balanced' | 'advanced'
    } => {
      // 网站级别指纹设置完全独立
      // 如果网站没有设置，使用默认值
      return {
        fingerprintEnabled: website.fingerprintEnabled ?? false,
        fingerprintMode: website.fingerprintMode ?? 'balanced'
      }
    },
    []
  )

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

  const activeWebsiteId = currentWebsite?.id ?? null

  return (
    <div className="h-full w-full relative">
      {/* 渲染所有打开过的网站，但只显示当前选中的 */}
      {openedWebsites.map((website) => {
        const fingerprintSettings = getWebsiteFingerprintSettings(website)
        // 使用会话覆盖的URL，如果没有则使用默认URL
        const actualUrl = sessionUrlOverrides[website.id] || website.url
        const isActive = activeWebsiteId === website.id

        return (
          <div
            key={website.id}
            className="absolute inset-0"
            style={{ display: isActive ? 'block' : 'none' }}
          >
            <WebViewContainer
              url={actualUrl}
              websiteId={website.id}
              isActive={isActive}
              isLoading={isLoading}
              onRefresh={handleRefresh}
              onGoBack={handleGoBack}
              onGoForward={handleGoForward}
              onOpenExternal={() => handleOpenExternal(actualUrl)}
              onExtensionClick={handleExtensionClick}
              // 传递指纹设置
              fingerprintEnabled={fingerprintSettings.fingerprintEnabled}
              fingerprintMode={fingerprintSettings.fingerprintMode}
            />
          </div>
        )
      })}

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
