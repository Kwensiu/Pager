import { useState, useEffect } from 'react'
import type { FC } from 'react'

interface FaviconProps {
  url: string
  className?: string
}

// Favicon 组件用于加载并显示网站图标
const Favicon: FC<FaviconProps> = ({ url, className }) => {
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)

  // 从URL获取主机名作为缓存键，这样即使URL参数变化也不会影响缓存
  const getCacheKey = (url: string): string => {
    try {
      const parsedUrl = new URL(url)
      return `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase()
    } catch {
      // 如果URL格式不正确，使用整个URL的小写形式
      return url.toLowerCase()
    }
  }

  const getFaviconFromCache = (url: string): string | null => {
    const cacheKey = getCacheKey(url)
    const memoryCache = getMemoryCache()

    const cached = memoryCache.get(cacheKey)
    if (cached) {
      // 检查缓存是否过期（7天）
      const now = Date.now()
      const weekInMs = 7 * 24 * 60 * 60 * 1000 // 7天的毫秒数

      if (now - cached.timestamp < weekInMs) {
        return cached.faviconUrl
      } else {
        // 删除过期的缓存
        memoryCache.delete(cacheKey)
        saveCacheToLocalStorage()
      }
    }
    return null
  }

  const setFaviconToCache = (url: string, faviconUrl: string | null): void => {
    const cacheKey = getCacheKey(url)
    const memoryCache = getMemoryCache()

    memoryCache.set(cacheKey, {
      faviconUrl,
      timestamp: Date.now()
    })

    saveCacheToLocalStorage()
  }

  // 将内存缓存同步到 localStorage
  const saveCacheToLocalStorage = (): void => {
    try {
      const serializedCache: Record<string, { faviconUrl: string | null; timestamp: number }> = {}

      const memoryCache = getMemoryCache()
      memoryCache.forEach((value, key) => {
        serializedCache[key] = value
      })

      localStorage.setItem('favicon-cache', JSON.stringify(serializedCache))
    } catch (error) {
      console.error('Error saving favicon cache to localStorage:', error)
    }
  }

  // 获取内存缓存实例
  const getMemoryCache = (): Map<string, { faviconUrl: string | null; timestamp: number }> => {
    if (typeof window !== 'undefined' && window.faviconCache) {
      return window.faviconCache
    }

    const cache = new Map<string, { faviconUrl: string | null; timestamp: number }>()
    if (typeof window !== 'undefined') {
      window.faviconCache = cache
    }
    return cache
  }

  useEffect(() => {
    // 首先尝试从缓存中获取
    const cachedFavicon = getFaviconFromCache(url)
    if (cachedFavicon !== null) {
      setFaviconUrl(cachedFavicon)
      setLoading(false)
      return
    }

    // 如果缓存中没有，则获取图标
    const fetchFavicon = async (): Promise<void> => {
      try {
        // 使用后端 API 获取 favicon URL
        if (window.api && typeof window.api.getFavicon === 'function') {
          const result = await window.api.getFavicon(url)

          // 将结果保存到缓存
          setFaviconToCache(url, result)
          setFaviconUrl(result)
        } else {
          // 如果 API 不可用，使用原始方法作为后备
          const parsedUrl = new URL(url)
          const fallbackUrl = `${parsedUrl.origin}/favicon.ico`

          // 将fallback结果也缓存起来
          setFaviconToCache(url, fallbackUrl)
          setFaviconUrl(fallbackUrl)
        }
      } catch (error) {
        console.error(`Failed to fetch favicon for ${url}:`, error)
        // 即使出错，也将null结果缓存，避免重复请求失败的URL
        setFaviconToCache(url, null)
        setFaviconUrl(null)
      } finally {
        setLoading(false)
      }
    }

    fetchFavicon()
  }, [url])

  if (loading) {
    return (
      <div className="flex h-4 w-4 items-center justify-center rounded bg-primary/10">
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
            const parsedUrl = new URL(url)
            return parsedUrl.hostname
          } catch {
            // 如果URL格式不正确，直接使用原始URL作为alt文本的一部分
            return url
          }
        })()} favicon`}
        className={className || 'h-4 w-4'}
        onError={() => {
          // 如果图片加载失败，清除缓存并重新尝试
          try {
            const cacheKey = getCacheKey(url)
            const memoryCache = getMemoryCache()
            memoryCache.delete(cacheKey)
            saveCacheToLocalStorage()
          } catch (error) {
            console.error('Error clearing favicon cache on image error:', error)
          }
          setFaviconUrl(null)
        }}
        onLoad={(e) => {
          // 确保图像正常加载
          if (!(e.target as HTMLImageElement).naturalWidth) {
            setFaviconUrl(null)
          }
        }}
      />
    )
  }

  // 默认图标
  return (
    <div className="flex h-4 w-4 items-center justify-center rounded bg-primary/10">
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
    faviconCache: Map<string, { faviconUrl: string | null; timestamp: number }>
  }
}
