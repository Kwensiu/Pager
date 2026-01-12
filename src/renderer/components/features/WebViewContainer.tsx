import { useRef, useEffect, useMemo, forwardRef, useCallback } from 'react'
import { NavigationToolbar } from './NavigationToolbar'

// 定义 Electron WebView 元素的类型
interface WebViewElement extends HTMLWebViewElement {
  executeJavaScript: (code: string) => Promise<unknown>
  getURL?: () => string
  canGoBack?: () => boolean
  canGoForward?: () => boolean
  goBack?: () => void
  goForward?: () => void
  reload?: () => void
  loadURL?: (url: string) => void
}

// 扩展 HTMLWebViewElement 接口以包含 Electron 特定属性
declare global {
  interface HTMLWebViewElement {
    allowpopups?: string
    partition?: string
  }
}

interface WebViewContainerProps {
  url: string
  isLoading: boolean
  onRefresh?: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onOpenExternal?: () => void
  onNavigate?: (url: string) => void
}

export const WebViewContainer = forwardRef<HTMLDivElement, WebViewContainerProps>(
  ({ url, isLoading, onRefresh, onGoBack, onGoForward, onOpenExternal, onNavigate }, ref) => {
    const webviewRef = useRef<WebViewElement>(null)

    // 创建唯一标识符，基于 URL 的主机名
    const partition = useMemo(() => `persist:webview-${new URL(url).hostname}`, [url])

    // 使用 URL 作为 key 的一部分，确保 URL 变化时重新创建 webview
    const webviewKey = useMemo(() => `${partition}-${url}`, [partition, url])

    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      const handleDomReady = (): void => {
        console.log('Webview DOM ready:', url)

        // 注入鼠标侧键处理脚本到 webview
        try {
          webview.executeJavaScript(`
            (function() {
              // 监听鼠标侧键事件
              document.addEventListener('mousedown', function(e) {
                // 检查是否在输入框中
                const target = e.target;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                  return;
                }
                
                // 鼠标侧键：button 3 = 后退，button 4 = 前进
                if (e.button === 3) {
                  e.preventDefault();
                  window.history.back();
                } else if (e.button === 4) {
                  e.preventDefault();
                  window.history.forward();
                }
              });
              
              return true;
            })();
          `).catch((err) => console.log('注入鼠标侧键脚本失败:', err))
        } catch (error) {
          console.error('注入鼠标侧键脚本时出错:', error)
        }

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

    // 仅保存 webview 引用
    const webviewCallbackRef = useCallback((element: WebViewElement | null) => {
      if (element) {
        webviewRef.current = element
      }
    }, [])

    // 处理后退 - 直接使用 webview API
    const handleGoBack = useCallback(() => {
      const webview = webviewRef.current
      if (webview && webview.goBack) {
        webview.goBack()
      } else if (onGoBack) {
        onGoBack()
      }
    }, [onGoBack])

    // 处理前进 - 直接使用 webview API
    const handleGoForward = useCallback(() => {
      const webview = webviewRef.current
      if (webview && webview.goForward) {
        webview.goForward()
      } else if (onGoForward) {
        onGoForward()
      }
    }, [onGoForward])

    // 处理刷新 - 直接使用 webview API
    const handleRefresh = useCallback(() => {
      const webview = webviewRef.current
      if (webview && webview.reload) {
        webview.reload()
      } else if (onRefresh) {
        onRefresh()
      }
    }, [onRefresh])

    // 处理导航到新 URL
    const handleNavigate = useCallback(
      (newUrl: string) => {
        const webview = webviewRef.current
        if (webview && webview.loadURL) {
          webview.loadURL(newUrl)
        } else if (onNavigate) {
          onNavigate(newUrl)
        } else {
          window.api.webview.loadUrl(newUrl)
        }
      },
      [onNavigate]
    )

    return (
      <div ref={ref} className="flex h-full w-full flex-col">
        <NavigationToolbar
          url={url}
          isLoading={isLoading}
          onRefresh={handleRefresh}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onOpenExternal={onOpenExternal}
          onNavigate={handleNavigate}
          canGoBack={true}
          canGoForward={true}
        />

        {/* 内容区域 - 修复顶部溢出问题 */}
        <div className="flex-1 relative overflow-hidden">
          <webview
            key={webviewKey}
            ref={webviewCallbackRef}
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            // eslint-disable-next-line react/no-unknown-property
            // @ts-ignore - allowpopups is a boolean attribute but DOM expects string
            allowpopups={true.toString()}
            // eslint-disable-next-line react/no-unknown-property
            partition={partition}
          />
        </div>
      </div>
    )
  }
)

WebViewContainer.displayName = 'WebViewContainer'
