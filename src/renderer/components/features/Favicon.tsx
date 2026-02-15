import { useState, useEffect, useCallback } from 'react'
import type { FC } from 'react'

interface FaviconProps {
  url: string
  className?: string
  preload?: boolean // 是否预加载
}

// Favicon 组件用于加载并显示网站图标
const Favicon: FC<FaviconProps> = ({ url, className, preload = false }) => {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<boolean>(false)

  // 从URL获取主机名作为缓存键，这样即使URL参数变化也不会影响缓存

  // 获取 favicon
  const fetchFavicon = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError(false)

      // 使用后端 API 获取 favicon URL
      if (window.api && typeof window.api.getFavicon === 'function') {
        const result = await window.api.getFavicon(url)
        setFaviconUrl(result)
      } else {
        // 如果 API 不可用，使用原始方法作为后备
        // 确保URL有协议前缀
        let normalizedUrl = url
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          if (normalizedUrl.startsWith('localhost') || /^\d+\.\d+\.\d+\.\d+/.test(normalizedUrl)) {
            normalizedUrl = 'http://' + normalizedUrl
          } else {
            normalizedUrl = 'https://' + normalizedUrl
          }
        }
        const parsedUrl = new URL(normalizedUrl)
        const fallbackUrl = `${parsedUrl.origin}/favicon.ico`
        setFaviconUrl(fallbackUrl)
      }
    } catch (error) {
      console.error(`Failed to fetch favicon for ${url}:`, error)
      setError(true)
      setFaviconUrl(null)
    } finally {
      setLoading(false)
    }
  }, [url])

  // 预加载 favicon
  const preloadFavicons = useCallback(async (): Promise<void> => {
    // 预加载功能暂时禁用，等待 API 类型更新
    // TODO: 启用预加载功能
  }, [])

  // 处理图片加载错误
  const handleImageError = useCallback(() => {
    console.warn(`❌ Favicon image failed to load: ${faviconUrl} for URL: ${url}`)
    setError(true)
    setFaviconUrl(null)
  }, [faviconUrl, url])

  // 处理图片加载完成
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      // 确保图像正常加载且有内容
      if (!img.naturalWidth || img.naturalWidth === 1) {
        handleImageError()
      }
    },
    [handleImageError]
  )

  useEffect(() => {
    // 如果启用了预加载，先预加载
    if (preload) {
      preloadFavicons()
    }

    // 获取 favicon
    fetchFavicon()
  }, [fetchFavicon, preloadFavicons, preload])

  // 如果加载失败，显示默认图标
  if (error || (!loading && !faviconUrl)) {
    return (
      <div
        className={`flex text-foreground h-6 w-6 items-center justify-center rounded ${className ? className.replace(/h-\d+|w-\d+/g, '') : 'bg-primary/10'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={`flex h-6 w-6 items-center justify-center rounded text-foreground ${className ? className.replace(/h-\d+|w-\d+/g, '') : 'bg-primary/10'}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
      </div>
    )
  }

  if (faviconUrl) {
    return (
      <img
        src={faviconUrl}
        alt={`${(() => {
          try {
            // 确保URL有协议前缀
            let normalizedUrl = url
            if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
              if (
                normalizedUrl.startsWith('localhost') ||
                /^\d+\.\d+\.\d+\.\d+/.test(normalizedUrl)
              ) {
                normalizedUrl = 'http://' + normalizedUrl
              } else {
                normalizedUrl = 'https://' + normalizedUrl
              }
            }
            const parsedUrl = new URL(normalizedUrl)
            return parsedUrl.hostname
          } catch {
            // 如果URL格式不正确，直接使用原始URL作为alt文本的一部分
            return url
          }
        })()} favicon`}
        className={className || 'h-4 w-4'}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    )
  }

  // 默认图标（理论上不会执行到这里）
  return (
    <div
      className={`flex h-6 w-6 items-center justify-center rounded text-foreground ${className ? className.replace(/h-\d+|w-\d+/g, '') : 'bg-primary/10'}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </g>
      </svg>
    </div>
  )
}

export { Favicon }

// 添加全局类型声明，扩展Window接口
declare global {
  interface Window {
    // 移除旧的 faviconCache，现在使用后端缓存
  }
}
