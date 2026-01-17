import { useRef, useEffect, useMemo, forwardRef, useCallback, useState } from 'react'
import { NavigationToolbar } from './NavigationToolbar'
import { useSettings } from '@/hooks/useSettings'
import { matchesPredefinedShortcut } from '@/utils/keyboardShortcuts'
import { showSuccessNotification, showErrorNotification } from '@/utils/notifications'

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
    allowpopups?: boolean
    partition?: string
  }
}

interface WebViewContainerProps {
  url: string
  websiteId?: string
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
      websiteId,
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
    const { settings } = useSettings()
    const webviewRef = useRef<WebViewElement>(null)
    const [currentUrl, setCurrentUrl] = useState(url) // 跟踪实际URL

    // 根据设置和URL动态生成partition
    const partition = useMemo(() => {
      if (!settings.sessionIsolationEnabled) {
        // 如果未启用Session隔离，使用共享session以便扩展工作
        return 'persist:webview-shared'
      }

      try {
        // 从URL提取域名作为隔离标识
        const urlObj = new URL(url)
        const domain = urlObj.hostname.replace(/[^\w-]/g, '-')
        return `persist:website-${domain}`
      } catch (error) {
        console.warn('Invalid URL for session isolation:', url, error)
        // URL解析失败时回退到共享session
        return 'persist:webview-shared'
      }
    }, [url, settings.sessionIsolationEnabled])

    // 使用 partition 和设置作为 key 的一部分，但不包含URL，避免导航时重新创建webview
    const webviewKey = useMemo(
      () => `${partition}-js-${settings.enableJavaScript}-popups-${settings.allowPopups}`,
      [partition, settings.enableJavaScript, settings.allowPopups]
    )

    // 同步URL状态
    useEffect(() => {
      setCurrentUrl(url)
    }, [url])

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

      const handleLoadUrl = (url: string): void => {
        const webview = webviewRef.current

        if (webview && webview.loadURL) {
          setTimeout(() => {
            if (webview && webview.loadURL) {
              webview.loadURL(url)
            }
          }, 100)
        } else if (onNavigate) {
          onNavigate(url)
        } else {
          window.api.webview.loadUrl(url)
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
        window.api.ipcRenderer.on('webview:load-url', (...args: unknown[]) => {
          // URL是第二个参数（第一个是事件对象）
          let url = args[1] as string
          if (typeof url !== 'string') {
            url = args[0] as string
          }
          if (typeof url === 'string') {
            handleLoadUrl(url)
          }
        })

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
          window.api.ipcRenderer.removeAllListeners('webview:load-url')
        }
      }

      return undefined
    }, [onGoBack, onGoForward, onRefresh, onNavigate])

    // 应用指纹伪装到 webview
    const applyFingerprint = useCallback(async (): Promise<void> => {
      if (!fingerprintEnabled) {
        return
      }

      try {
        // 生成指纹
        const fingerprintResult = await window.api.enhanced.fingerprint.generate({
          mode: fingerprintMode
        })

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
            try {
              const fingerprintData = {
                userAgent: '${fingerprintData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}',
                platform: '${fingerprintData.platform || 'Win32'}',
                languages: ${JSON.stringify(fingerprintData.languages || ['zh-CN', 'zh', 'en-US', 'en'])},
                hardwareConcurrency: ${fingerprintData.hardwareConcurrency || 8},
                deviceMemory: ${fingerprintData.deviceMemory || 8},
                screenResolution: '${fingerprintData.screenResolution || '1920x1080'}',
                timezone: '${fingerprintData.timezone || 'Asia/Shanghai'}'
              };

              // 修改 User-Agent
              Object.defineProperty(navigator, 'userAgent', {
                value: fingerprintData.userAgent,
                writable: false,
                configurable: false
              });
              
              // 修改平台
              Object.defineProperty(navigator, 'platform', {
                value: fingerprintData.platform,
                writable: false,
                configurable: false
              });
              
              // 跳过语言修改，因为某些浏览器不允许重新定义
              
              // 修改硬件并发数
              Object.defineProperty(navigator, 'hardwareConcurrency', {
                value: fingerprintData.hardwareConcurrency,
                writable: false,
                configurable: false
              });
              
              // 修改设备内存
              Object.defineProperty(navigator, 'deviceMemory', {
                value: fingerprintData.deviceMemory,
                writable: false,
                configurable: false
              });
              
              // 修改屏幕分辨率
              const [width, height] = fingerprintData.screenResolution.split('x').map(Number);
              
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
              try {
                const originalDateTimeFormat = Intl.DateTimeFormat;
                Intl.DateTimeFormat = function(locales, options) {
                  const result = originalDateTimeFormat.call(this, locales, options);
                  const originalResolvedOptions = result.resolvedOptions;
                  result.resolvedOptions = function() {
                    const opts = originalResolvedOptions.call(this);
                    opts.timeZone = fingerprintData.timezone;
                    return opts;
                  };
                  return result;
                };
              } catch (e) {
                // 时区修改失败，忽略
              }
            } catch (error) {
              console.error('指纹伪装脚本执行失败:', error);
            }
          })();
        `

        await webview.executeJavaScript(fingerprintScript)
      } catch (error) {
        console.error('应用指纹伪装失败:', error)
      }
    }, [fingerprintEnabled, fingerprintMode])

    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      const handleDomReady = (): void => {
        // 应用指纹伪装
        applyFingerprint()

        // 设置右键菜单监听器
        try {
          // 右键菜单现在通过主进程的 did-attach-webview 事件处理
          // 不需要在渲染进程中设置监听器
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
            .catch(() => {
              // 忽略注入失败
            })
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
            .catch(() => {
              // 忽略注入失败
            })
        } catch (error) {
          console.error('注入滚动条样式时出错:', error)
        }
      }

      webview.addEventListener('dom-ready', handleDomReady)

      return () => {
        webview.removeEventListener('dom-ready', handleDomReady)
      }
    }, [url, applyFingerprint])

    // 监听指纹设置变化并重新应用指纹
    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      // 检查 WebView 是否已经准备好
      const checkAndApplyFingerprint = (): void => {
        try {
          // 尝试执行一个简单的 JavaScript 来检查 WebView 是否准备好
          webview
            .executeJavaScript('true')
            .then(() => {
              applyFingerprint()
            })
            .catch(() => {
              // WebView 还没准备好，等待一段时间后再试
              setTimeout(checkAndApplyFingerprint, 500)
            })
        } catch {
          // WebView 还没准备好，等待一段时间后再试
          setTimeout(checkAndApplyFingerprint, 500)
        }
      }

      // 延迟执行，确保 WebView 已经挂载到 DOM
      setTimeout(checkAndApplyFingerprint, 100)
    }, [fingerprintEnabled, fingerprintMode, applyFingerprint])

    const webviewCallbackRef = useCallback(
      (element: WebViewElement | null) => {
        if (element) {
          webviewRef.current = element

          // 添加导航事件监听器
          const handleDidNavigate = (event: Event): void => {
            const navigateEvent = event as unknown as { url: string }
            if (navigateEvent.url && navigateEvent.url !== currentUrl) {
              setCurrentUrl(navigateEvent.url)

              if (onNavigate) {
                onNavigate(navigateEvent.url)
              }
            }
          }

          const handleDidNavigateInPage = (event: Event): void => {
            const navigateEvent = event as unknown as { url: string }
            if (navigateEvent.url && navigateEvent.url !== currentUrl) {
              setCurrentUrl(navigateEvent.url)

              // 保存会话信息
              if (websiteId && window.api?.enhanced?.session) {
                window.api.enhanced.session
                  .addOrUpdate(websiteId, navigateEvent.url, '')
                  .catch((error) => console.error('Failed to save session:', error))
              }
            }
          }

          // 监听页面标题更新
          const handlePageTitleUpdated = (event: Event): void => {
            const titleEvent = event as unknown as { title: string }
            // 保存会话信息
            if (titleEvent.title && websiteId && window.api?.enhanced?.session) {
              window.api.enhanced.session
                .addOrUpdate(websiteId, currentUrl, titleEvent.title)
                .catch((error) => console.error('Failed to update session title:', error))
            }
          }

          // 监听页面导航事件
          element.addEventListener('did-navigate', handleDidNavigate)
          element.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
          element.addEventListener('page-title-updated', handlePageTitleUpdated)

          // 清理函数
          return () => {
            element.removeEventListener('did-navigate', handleDidNavigate)
            element.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
            element.removeEventListener('page-title-updated', handlePageTitleUpdated)
          }
        }
        return undefined
      },
      [currentUrl, onNavigate, websiteId]
    )

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

    // 处理复制URL - 直接使用 webview API
    const handleCopyUrl = useCallback(async (): Promise<void> => {
      const webview = webviewRef.current
      if (!webview?.getURL) {
        return
      }

      const currentUrl = webview.getURL()
      if (!currentUrl) {
        return
      }

      try {
        // 使用Electron的IPC复制到剪贴板
        if (window.electron?.ipcRenderer) {
          await window.electron.ipcRenderer.invoke('window-manager:copy-to-clipboard', currentUrl)
          await showSuccessNotification({
            title: 'URL已复制',
            body: currentUrl
          })
        }
      } catch (error) {
        await showErrorNotification('URL复制失败', error)
      }
    }, [])

    // 创建统一的键盘事件处理器
    const createKeyboardHandler = useCallback(
      (event: KeyboardEvent, handlers: Record<string, () => void>) => {
        if (matchesPredefinedShortcut(event, 'REFRESH_PAGE')) {
          event.preventDefault()
          handlers.refresh?.()
        }

        if (matchesPredefinedShortcut(event, 'COPY_URL')) {
          event.preventDefault()
          handlers.copyUrl?.()
        }
      },
      []
    )

    // 监听WebView的键盘事件（应用内模式）
    useEffect(() => {
      const webview = webviewRef.current
      if (!webview) return

      const handleKeyDown = (event: KeyboardEvent): void => {
        createKeyboardHandler(event, {
          refresh: handleRefresh,
          copyUrl: handleCopyUrl
        })
      }

      // 监听WebView的键盘事件
      webview.addEventListener('keydown', handleKeyDown)

      return (): void => {
        webview.removeEventListener('keydown', handleKeyDown)
      }
    }, [handleRefresh, handleCopyUrl, createKeyboardHandler])

    // 监听文档级别的键盘事件（应用内快捷键）
    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent): void => {
        createKeyboardHandler(event, {
          copyUrl: handleCopyUrl
        })
      }

      // 监听文档级别的键盘事件
      document.addEventListener('keydown', handleKeyDown)

      return (): void => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }, [handleCopyUrl, createKeyboardHandler])

    // 监听快捷键刷新消息（全局模式）
    useEffect(() => {
      const handleRefreshShortcut = (): void => {
        // 检查当前WebView是否是活跃的
        const webview = webviewRef.current
        if (webview && webview.getURL && webview.getURL()) {
          // 检查这个WebView是否是当前显示的
          const isVisible = webview.style.display !== 'none'
          if (isVisible) {
            handleRefresh()
          }
        }
      }

      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.on('window-manager:refresh-page', handleRefreshShortcut)
      }

      return (): void => {
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.removeListener(
            'window-manager:refresh-page',
            handleRefreshShortcut
          )
        }
      }
    }, [handleRefresh])

    // 监听复制URL消息（全局模式）
    useEffect(() => {
      const handleCopyUrlShortcut = (): void => {
        // 检查当前WebView是否是活跃的
        const webview = webviewRef.current
        if (webview && webview.getURL && webview.getURL()) {
          const currentUrl = webview.getURL()
          // 检查这个WebView是否是当前显示的
          const isVisible = webview.style.display !== 'none'
          if (isVisible) {
            // 使用Electron的IPC复制到剪贴板
            if (window.electron?.ipcRenderer) {
              window.electron.ipcRenderer
                .invoke('window-manager:copy-to-clipboard', currentUrl)
                .then(() => {
                  // 显示通知
                  window.electron.ipcRenderer.invoke('window-manager:show-notification', {
                    title: 'URL已复制',
                    body: currentUrl
                  })
                })
                .catch((error) => {
                  // 显示错误通知
                  window.electron.ipcRenderer.invoke('window-manager:show-notification', {
                    title: 'URL复制失败',
                    body: error.message || '未知错误'
                  })
                })
            }
          }
        }
      }

      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.on('window-manager:copy-url', handleCopyUrlShortcut)
      }

      return (): void => {
        if (window.electron?.ipcRenderer) {
          window.electron.ipcRenderer.removeListener(
            'window-manager:copy-url',
            handleCopyUrlShortcut
          )
        }
      }
    }, [])

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
          url={currentUrl}
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
            {...({
              allowpopups: settings.allowPopups ? 'true' : 'false'
            } as React.HTMLAttributes<HTMLElement>)}
            {...({ partition } as React.HTMLAttributes<HTMLElement>)}
            {...({
              webpreferences: `contextIsolation=yes, nodeIntegration=no, javascript=${settings.enableJavaScript ? 'yes' : 'no'}`
            } as React.HTMLAttributes<HTMLElement>)}
          />
        </div>
      </div>
    )
  }
)

WebViewContainer.displayName = 'WebViewContainer'
