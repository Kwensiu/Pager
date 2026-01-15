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
  getWebContents?: () => unknown
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
  onExtensionClick?: () => void
  // 指纹伪装设置
  fingerprintEnabled?: boolean
  fingerprintMode?: 'basic' | 'balanced' | 'advanced'
}

export const WebViewContainer = forwardRef<HTMLDivElement, WebViewContainerProps>(
  (
    {
      url,
      isLoading,
      onRefresh,
      onGoBack,
      onGoForward,
      onOpenExternal,
      onNavigate,
      onExtensionClick,
      fingerprintEnabled = false,
      fingerprintMode = 'balanced'
    },
    ref
  ) => {
    const webviewRef = useRef<WebViewElement>(null)

    // 使用固定的共享 session，以便扩展可以在所有 webview 中工作
    const partition = 'persist:webview-shared'

    // 使用 URL 作为 key 的一部分，确保 URL 变化时重新创建 webview
    const webviewKey = useMemo(() => `${partition}-${url}`, [partition, url])

    // 监听来自主进程的webview操作命令
    useEffect(() => {
      const handleNavigateBack = (): void => {
        const webview = webviewRef.current
        if (webview && webview.goBack) {
          webview.goBack()
        } else if (onGoBack) {
          onGoBack()
        }
      }

      const handleNavigateForward = (): void => {
        const webview = webviewRef.current
        if (webview && webview.goForward) {
          webview.goForward()
        } else if (onGoForward) {
          onGoForward()
        }
      }

      const handleReload = (): void => {
        const webview = webviewRef.current
        if (webview && webview.reload) {
          webview.reload()
        } else if (onRefresh) {
          onRefresh()
        }
      }

      const handleReloadForce = (): void => {
        const webview = webviewRef.current
        if (webview && webview.reload) {
          // 忽略缓存重新加载
          webview.reload()
        } else if (onRefresh) {
          onRefresh()
        }
      }

      const handleCopy = (): void => {
        const webview = webviewRef.current
        if (webview) {
          webview.executeJavaScript('document.execCommand("copy")')
        }
      }

      const handlePaste = (): void => {
        const webview = webviewRef.current
        if (webview) {
          webview.executeJavaScript('document.execCommand("paste")')
        }
      }

      const handleSelectAll = (): void => {
        const webview = webviewRef.current
        if (webview) {
          webview.executeJavaScript('document.execCommand("selectAll")')
        }
      }

      const handleViewSource = (): void => {
        const webview = webviewRef.current
        if (webview && webview.getURL) {
          const currentUrl = webview.getURL()
          if (currentUrl) {
            window.open(`view-source:${currentUrl}`)
          }
        }
      }

      const handleInspectElement = (): void => {
        const webview = webviewRef.current
        if (webview) {
          webview.executeJavaScript(`
            // 尝试打开开发者工具
            if (window.devTools) {
              window.devTools.show()
            }
          `)
        }
      }

      // 注册IPC监听器
      if (window.api?.ipcRenderer) {
        window.api.ipcRenderer.on('webview:navigate-back', handleNavigateBack)
        window.api.ipcRenderer.on('webview:navigate-forward', handleNavigateForward)
        window.api.ipcRenderer.on('webview:reload', handleReload)
        window.api.ipcRenderer.on('webview:reload-force', handleReloadForce)
        window.api.ipcRenderer.on('webview:copy', handleCopy)
        window.api.ipcRenderer.on('webview:paste', handlePaste)
        window.api.ipcRenderer.on('webview:select-all', handleSelectAll)
        window.api.ipcRenderer.on('webview:view-source', handleViewSource)
        window.api.ipcRenderer.on('webview:inspect-element', handleInspectElement)

        return () => {
          // 清理IPC监听器
          window.api.ipcRenderer.removeAllListeners('webview:navigate-back')
          window.api.ipcRenderer.removeAllListeners('webview:navigate-forward')
          window.api.ipcRenderer.removeAllListeners('webview:reload')
          window.api.ipcRenderer.removeAllListeners('webview:reload-force')
          window.api.ipcRenderer.removeAllListeners('webview:copy')
          window.api.ipcRenderer.removeAllListeners('webview:paste')
          window.api.ipcRenderer.removeAllListeners('webview:select-all')
          window.api.ipcRenderer.removeAllListeners('webview:view-source')
          window.api.ipcRenderer.removeAllListeners('webview:inspect-element')
        }
      }

      return undefined
    }, [onGoBack, onGoForward, onRefresh])

    // 应用指纹伪装到 webview
    const applyFingerprint = useCallback(async (): Promise<void> => {
      if (!fingerprintEnabled) {
        console.log('指纹伪装未启用，跳过应用')
        return
      }

      try {
        console.log('应用指纹伪装，模式:', fingerprintMode)

        // 生成指纹
        const fingerprintResult = await window.api.enhanced.fingerprint.generate({
          mode: fingerprintMode
        })

        console.log('指纹生成成功:', fingerprintResult)

        // 应用指纹到网站
        // 注意：这里需要获取 webContents，但 webview API 不直接暴露
        // 我们通过注入脚本的方式修改浏览器指纹
        const webview = webviewRef.current
        if (!webview) {
          console.warn('Webview 未找到，无法应用指纹')
          return
        }

        // 类型断言，确保我们可以访问 fingerprint 属性
        const fingerprintData = fingerprintResult.fingerprint as Record<string, unknown>

        // 注入指纹伪装脚本
        const fingerprintScript = `
          (function() {
            // 修改 User-Agent
            Object.defineProperty(navigator, 'userAgent', {
              value: '${fingerprintData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}',
              writable: false,
              configurable: false
            });
            
            // 修改平台
            Object.defineProperty(navigator, 'platform', {
              value: '${fingerprintData.platform || 'Win32'}',
              writable: false,
              configurable: false
            });
            
            // 修改语言
            Object.defineProperty(navigator, 'languages', {
              value: ${JSON.stringify(fingerprintData.languages || ['zh-CN', 'zh', 'en-US', 'en'])},
              writable: false,
              configurable: false
            });
            
            // 修改硬件并发数
            Object.defineProperty(navigator, 'hardwareConcurrency', {
              value: ${fingerprintData.hardwareConcurrency || 8},
              writable: false,
              configurable: false
            });
            
            // 修改设备内存
            Object.defineProperty(navigator, 'deviceMemory', {
              value: ${fingerprintData.deviceMemory || 8},
              writable: false,
              configurable: false
            });
            
            // 修改屏幕分辨率
            const screenResolution = '${fingerprintData.screenResolution || '1920x1080'}';
            const [width, height] = screenResolution.split('x').map(Number);
            
            // 修改屏幕属性
            Object.defineProperty(screen, 'width', {
              value: width,
              writable: false,
              configurable: false
            });
            
            Object.defineProperty(screen, 'height', {
              value: height,
              writable: false,
              configurable: false
            });
            
            Object.defineProperty(screen, 'availWidth', {
              value: width,
              writable: false,
              configurable: false
            });
            
            Object.defineProperty(screen, 'availHeight', {
              value: height,
              writable: false,
              configurable: false
            });
            
            // 修改时区
            Object.defineProperty(Intl.DateTimeFormat().resolvedOptions(), 'timeZone', {
              value: '${fingerprintData.timezone || 'Asia/Shanghai'}',
              writable: false,
              configurable: false
            });
            
            console.log('指纹伪装已应用，模式: ${fingerprintMode}');
          })();
        `

        await webview.executeJavaScript(fingerprintScript)
        console.log('指纹伪装脚本注入成功')
      } catch (error) {
        console.error('应用指纹伪装失败:', error)
      }
    }, [fingerprintEnabled, fingerprintMode])

    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      const handleDomReady = (): void => {
        console.log('Webview DOM ready:', url)

        // 应用指纹伪装
        applyFingerprint()

        // 设置右键菜单监听器
        try {
          // 右键菜单现在通过主进程的 did-attach-webview 事件处理
          // 不需要在渲染进程中设置监听器
          console.log('WebView context menu will be handled by main process')
        } catch (error) {
          console.error('设置webview右键菜单监听器失败:', error)
        }

        // 注入鼠标侧键处理脚本到 webview
        try {
          webview
            .executeJavaScript(
              `
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
          `
            )
            .catch((err) => console.log('注入鼠标侧键脚本失败:', err))
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
    }, [url, applyFingerprint])

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
          onExtensionClick={onExtensionClick}
        />

        {/* 内容区域 - 修复顶部溢出问题 */}
        <div className="flex-1 relative overflow-hidden">
          <webview
            key={webviewKey}
            ref={webviewCallbackRef}
            src={url}
            style={{ width: '100%', height: '100%', border: 'none' }}
            // @ts-ignore - allowpopups is a boolean attribute but DOM expects string
            allowpopups={true.toString()}
            // eslint-disable-next-line react/no-unknown-property
            partition={partition}
            // 启用扩展支持
            // @ts-ignore - webpreferences is a valid webview attribute
            webpreferences="contextIsolation=yes, nodeIntegration=no, javascript=yes"
          />
        </div>
      </div>
    )
  }
)

WebViewContainer.displayName = 'WebViewContainer'
