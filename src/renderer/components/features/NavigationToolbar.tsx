import { useState, useEffect, useRef, KeyboardEvent, ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, RefreshCw, Globe, ExternalLink, Plug } from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { cn } from '@/lib/utils'
import { useMouseSideButtons } from '@/hooks/useMouseSideButtons'
import { useI18n } from '@/core/i18n/useI18n'
import { useSettings } from '@/hooks/useSettings'

interface NavigationToolbarProps {
  /** 当前显示的 URL */
  url: string
  /** 是否正在加载 */
  isLoading: boolean
  /** 刷新回调 */
  onRefresh?: () => void
  /** 后退回调 */
  onGoBack?: () => void
  /** 前进回调 */
  onGoForward?: () => void
  /** 外部打开回调 */
  onOpenExternal?: () => void
  /** 导航到新 URL 的回调 */
  onNavigate?: (url: string) => void
  /** 是否可以后退 */
  canGoBack?: boolean
  /** 是否可以前进 */
  canGoForward?: boolean
  /** 类名 */
  className?: string
  /** 扩展按钮点击回调 */
  onExtensionClick?: () => void
}

export const NavigationToolbar = ({
  url,
  isLoading,
  onRefresh,
  onGoBack,
  onGoForward,
  onOpenExternal,
  onNavigate,
  canGoBack = false,
  canGoForward = false,
  className,
  onExtensionClick
}: NavigationToolbarProps): React.ReactElement => {
  const { t } = useI18n()
  const { settings } = useSettings()
  const [editUrl, setEditUrl] = useState(url)
  const inputRef = useRef<HTMLInputElement>(null)

  // 使用鼠标侧键钩子
  useMouseSideButtons({
    enabled: true,
    onBack: canGoBack && onGoBack ? onGoBack : undefined,
    onForward: canGoForward && onGoForward ? onGoForward : undefined,
    ignoreSelectors: ['input', 'textarea', '[contenteditable="true"]'],
    preventDefault: true
  })

  // 当 URL 变化时更新编辑状态
  useEffect(() => {
    setEditUrl(url)
  }, [url])

  // 处理 URL 输入变化
  const handleUrlChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setEditUrl(e.target.value)
  }

  // 处理导航
  const handleNavigate = (): void => {
    if (onNavigate && editUrl.trim()) {
      let navigateUrl = editUrl.trim()

      // 智能添加协议前缀（如果没有协议）
      if (
        !navigateUrl.startsWith('http://') &&
        !navigateUrl.startsWith('https://') &&
        !navigateUrl.startsWith('file://')
      ) {
        // 检查是否为文件路径（仅在设置允许时）
        if (
          settings.allowLocalFileAccess &&
          (navigateUrl.includes('\\') || navigateUrl.startsWith('/') || navigateUrl.includes(':'))
        ) {
          // Windows路径或Unix路径，转换为file://
          if (navigateUrl.includes(':') && !navigateUrl.startsWith('/')) {
            // Windows路径: C:\path\to\file
            navigateUrl = 'file:///' + navigateUrl.replace(/\\/g, '/').replace(/^C:/i, 'C:')
          } else {
            // Unix路径或已格式化的Windows路径
            navigateUrl = 'file://' + navigateUrl
          }
        } else if (navigateUrl.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(navigateUrl)) {
          // 对于localhost和IP地址，优先使用http
          navigateUrl = 'http://' + navigateUrl
        } else {
          // 普通域名使用https
          navigateUrl = 'https://' + navigateUrl
        }
      }

      onNavigate(navigateUrl)
    }
  }

  // 处理键盘事件
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleNavigate()
    } else if (e.key === 'Escape') {
      setEditUrl(url)
      inputRef.current?.blur()
    }
  }

  // 处理输入框失去焦点
  const handleBlur = (): void => {
    setEditUrl(url)
  }

  // 处理输入框获得焦点
  const handleFocus = (): void => {
    inputRef.current?.select()
  }

  return (
    <div
      className={cn('flex items-center gap-2 border-b bg-background px-4 py-2 shrink-0', className)}
    >
      {/* 后退按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground"
        disabled={!canGoBack}
        onClick={onGoBack}
        aria-label="后退"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* 前进按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground"
        disabled={!canGoForward}
        onClick={onGoForward}
        aria-label="前进"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      {/* 刷新按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground"
        disabled={!url}
        onClick={onRefresh}
        aria-label="刷新"
      >
        <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
      </Button>

      {/* 地址栏 */}
      <div className="flex flex-1 items-center gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={editUrl}
            onChange={handleUrlChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            onFocus={handleFocus}
            className="pl-9 pr-4 text-foreground"
            placeholder="输入网址"
            aria-label="地址栏"
          />
        </div>
      </div>

      {/* 扩展按钮 */}
      {onExtensionClick && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onExtensionClick}
          aria-label={t('extensions.title')}
        >
          <Plug className="h-4 w-4" />
        </Button>
      )}

      {/* 外部打开按钮 */}
      {url && onOpenExternal && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={onOpenExternal}
          aria-label="在外部浏览器中打开"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

NavigationToolbar.displayName = 'NavigationToolbar'
