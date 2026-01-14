import React, { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import { Skeleton } from '../../ui/skeleton'
import { Progress } from '@/ui/progress'

interface LoadingPageProps {
  title?: string
  subtitle?: string
  progress?: number
  showSpinner?: boolean
  showProgressBar?: boolean
  showLogo?: boolean
  className?: string
  onLoadComplete?: () => void
}

/**
 * 加载页面组件
 * 用于显示应用启动、网站加载等场景的加载状态
 */
const LoadingPage: React.FC<LoadingPageProps> = ({
  title = '加载中...',
  subtitle = '请稍候',
  progress = 0,
  showSpinner = true,
  showProgressBar = true,
  showLogo = true,
  className,
  onLoadComplete
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [simulatedProgress, setSimulatedProgress] = useState(0)
  const [loadingText, setLoadingText] = useState('')
  const [dots, setDots] = useState('')

  // 派生状态：当 progress >= -1 时使用外部进度，否则使用模拟进度
  const displayProgress = progress >= -1 ? progress : simulatedProgress

  // 模拟进度动画（仅在外部未提供有效进度时运行）
  useEffect(() => {
    if (progress < -1) {
      const interval = setInterval(() => {
        setSimulatedProgress((prev) => {
          const newProgress = prev + Math.random() * 10
          return newProgress >= 100 ? 100 : newProgress
        })
      }, 300)

      return () => clearInterval(interval)
    }
    return undefined
  }, [progress])

  // 加载完成检测
  useEffect(() => {
    if (displayProgress >= 100 && isVisible) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onLoadComplete?.()
      }, 300)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [displayProgress, isVisible, onLoadComplete])

  // 动态加载文本
  useEffect(() => {
    const texts = [
      '正在初始化应用...',
      '正在加载配置文件...',
      '正在连接服务...',
      '正在准备界面...',
      '正在优化性能...',
      '即将完成...'
    ]

    let currentIndex = 0
    const interval = setInterval(() => {
      setLoadingText(texts[currentIndex])
      currentIndex = (currentIndex + 1) % texts.length
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  // 动态点动画
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 500)

    return () => clearInterval(interval)
  }, [])

  if (!isVisible) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm',
        className
      )}
    >
      <div className="w-full max-w-md px-8 py-10 text-center">
        {/* Logo */}
        {showLogo && (
          <div className="mb-8">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/70 p-3">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-background">
                <svg
                  className="h-8 w-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Pager</h1>
            <p className="text-sm text-muted-foreground">多网站管理工具</p>
          </div>
        )}

        {/* 标题和副标题 */}
        <div className="mb-8">
          <h2 className="mb-2 text-xl font-semibold">{title}</h2>
          <p className="text-muted-foreground">
            {subtitle}
            {dots}
          </p>
        </div>

        {/* 动态加载文本 */}
        {loadingText && (
          <div className="mb-6">
            <p className="text-sm text-muted-foreground animate-pulse">{loadingText}</p>
          </div>
        )}

        {/* 进度条 */}
        {showProgressBar && (
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">进度</span>
              <span className="text-sm text-muted-foreground">{Math.round(displayProgress)}%</span>
            </div>
            <Progress value={displayProgress} className="h-2" />
          </div>
        )}

        {/* 旋转加载器 */}
        {showSpinner && (
          <div className="mb-8">
            <div className="relative mx-auto h-12 w-12">
              <div className="absolute inset-0 rounded-full border-4 border-border"></div>
              <div className="absolute inset-0 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          </div>
        )}

        {/* 骨架屏占位 */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>

        {/* 提示信息 */}
        <div className="mt-8 text-xs text-muted-foreground">
          <p>如果加载时间过长，请检查网络连接或重启应用</p>
        </div>

        {/* 取消按钮 */}
        <div className="mt-6">
          <button
            onClick={() => setIsVisible(false)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            跳过加载
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoadingPage

/**
 * 全屏加载页面组件
 */
export const FullScreenLoadingPage: React.FC<Omit<LoadingPageProps, 'className'>> = (props) => (
  <LoadingPage {...props} className="bg-background" />
)

/**
 * 网站加载页面组件
 */
export const WebsiteLoadingPage: React.FC<Omit<LoadingPageProps, 'title' | 'subtitle'>> = (
  props
) => (
  <LoadingPage
    title="正在加载网站..."
    subtitle="请稍候，正在准备浏览环境"
    showLogo={false}
    {...props}
  />
)

/**
 * 应用启动加载页面组件
 */
export const AppLaunchLoadingPage: React.FC<Omit<LoadingPageProps, 'title' | 'subtitle'>> = (
  props
) => <LoadingPage title="正在启动 Pager" subtitle="初始化应用环境" showLogo={true} {...props} />

/**
 * 数据同步加载页面组件
 */
export const DataSyncLoadingPage: React.FC<Omit<LoadingPageProps, 'title' | 'subtitle'>> = (
  props
) => <LoadingPage title="正在同步数据" subtitle="请勿关闭应用" showLogo={false} {...props} />
