import { useRef, useEffect, useMemo, forwardRef, useCallback } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Globe, ExternalLink } from 'lucide-react'
import { Button } from '@/ui/button'
import { cn } from '@/lib/utils'

interface WebViewContainerProps {
  url: string
  isLoading: boolean
  onRefresh?: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onOpenExternal?: () => void
}

// 定义 Electron WebView 元素的类型
interface WebViewElement extends HTMLWebViewElement {
  executeJavaScript: (code: string) => Promise<unknown>
}

// 扩展 HTMLWebViewElement 接口以包含 Electron 特定属性
declare global {
  interface HTMLWebViewElement {
    allowpopups: boolean
    partition: string
  }
}

export const WebViewContainer = forwardRef<HTMLDivElement, WebViewContainerProps>(
  ({ url, isLoading, onRefresh, onGoBack, onGoForward, onOpenExternal }, ref) => {
    const webviewRef = useRef<WebViewElement>(null)
    const partition = useMemo(() => `persist:webview-${new URL(url).hostname}`, [url])

    const webviewCallbackRef = useCallback(
      (element: WebViewElement | null) => {
        if (element) {
          // 设置 webview 属性
          element.allowpopups = true
          element.partition = partition
          webviewRef.current = element
        }
      },
      [partition]
    )

    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      const handleDomReady = (): void => {
        console.log('Webview DOM ready:', url)

        // 注入自定义滚动条样式到webview - 真正的悬浮效果
        try {
          const scrollbarStyles = `
            /* 自定义滚动条样式 - 真正的悬浮效果 */
            ::-webkit-scrollbar {
              width: 10px;
              height: 10px;
            }

            ::-webkit-scrollbar-track {
              background: transparent;
              margin: 0;
            }

            ::-webkit-scrollbar-thumb {
              background: rgba(100, 116, 139, 0.15);
              border-radius: 5px;
              border: 3px solid transparent;
              background-clip: content-box;
              transition: all 0.3s ease;
              opacity: 0;
            }

            /* 滚动时显示滚动条 */
            :hover::-webkit-scrollbar-thumb,
            :active::-webkit-scrollbar-thumb,
            :focus::-webkit-scrollbar-thumb {
              opacity: 1;
            }

            ::-webkit-scrollbar-thumb:hover {
              background: rgba(100, 116, 139, 0.4);
              border: 2px solid transparent;
            }

            ::-webkit-scrollbar-thumb:active {
              background: rgba(100, 116, 139, 0.6);
            }

            ::-webkit-scrollbar-corner {
              background: transparent;
            }

            /* 暗色模式检测 */
            @media (prefers-color-scheme: dark) {
              ::-webkit-scrollbar-thumb {
                background: rgba(148, 163, 184, 0.15);
              }

              ::-webkit-scrollbar-thumb:hover {
                background: rgba(148, 163, 184, 0.4);
              }

              ::-webkit-scrollbar-thumb:active {
                background: rgba(148, 163, 184, 0.6);
              }
            }

            /* Firefox滚动条样式 */
            * {
              scrollbar-width: thin;
              scrollbar-color: rgba(100, 116, 139, 0.15) transparent;
            }

            /* Firefox悬停效果 */
            :hover {
              scrollbar-color: rgba(100, 116, 139, 0.4) transparent;
            }

            @media (prefers-color-scheme: dark) {
              * {
                scrollbar-color: rgba(148, 163, 184, 0.15) transparent;
              }
              
              :hover {
                scrollbar-color: rgba(148, 163, 184, 0.4) transparent;
              }
            }

            /* 强制滚动条覆盖在内容之上 */
            html, body {
              overflow: overlay !important;
            }

            /* 为不支持overlay的浏览器提供回退 */
            @supports not (overflow: overlay) {
              html, body {
                overflow: auto;
                padding-right: 0 !important;
              }
            }
          `

          // 创建style元素并注入到webview的document中
          webview
            .executeJavaScript(
              `
            (function() {
              const styleId = 'custom-scrollbar-styles';
              let style = document.getElementById(styleId);
              if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                style.textContent = \`${scrollbarStyles}\`;
                document.head.appendChild(style);
              }
              return true;
            })();
          `
            )
            .catch((err) => console.log('注入滚动条样式失败:', err))
        } catch (error) {
          console.error('注入滚动条样式时出错:', error)
        }
      }

      webview.addEventListener('dom-ready', handleDomReady)

      return () => {
        webview.removeEventListener('dom-ready', handleDomReady)
      }
    }, [url])

    return (
      <div ref={ref} className="flex h-full w-full flex-col">
        {/* 工具栏 - 调整高度以匹配SidebarHeader */}
        <div className="flex items-center gap-2 border-b bg-background px-4 py-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!url}
            onClick={onGoBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            disabled={!url}
            onClick={onGoForward}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={!url}
            onClick={onRefresh}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>

          {/* URL 显示 */}
          <div className="flex flex-1 items-center gap-2 overflow-hidden rounded-md bg-muted px-3 py-1">
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm text-muted-foreground">{url || '未选择网站'}</span>
          </div>

          {url && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onOpenExternal}>
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* 内容区域 - 修复顶部溢出问题 */}
        <div className="flex-1 relative overflow-hidden">
          <webview
            ref={webviewCallbackRef}
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </div>
    )
  }
)

WebViewContainer.displayName = 'WebViewContainer'
