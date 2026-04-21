import { app } from 'electron'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { LRUCache } from '../cache'
import {
  FaviconCacheEntry,
  FaviconFetchResult,
  FaviconServiceConfig,
  FaviconPreloadOptions
} from './types'

export class FaviconService {
  private static instance: FaviconService
  private memoryCache: LRUCache<string, FaviconCacheEntry>
  private pendingRequests = new Map<string, Promise<string | null>>()
  private cacheFilePath: string
  private config: FaviconServiceConfig
  private cacheDirty = false
  private saveTimeout: NodeJS.Timeout | null = null
  private activeRequests = 0
  private readonly maxConcurrentRequests = 3

  private constructor() {
    this.config = {
      cacheTtl: 7 * 24 * 60 * 60 * 1000, // 7天
      maxCacheSize: 500,
      timeout: 12000,
      parallelRequests: 3
    }

    this.memoryCache = new LRUCache(this.config.maxCacheSize, this.config.cacheTtl)
    this.cacheFilePath = join(app.getPath('userData'), 'favicons.json')

    // 从文件加载缓存
    this.loadCacheFromFile()

    // 应用退出时保存缓存
    app.on('before-quit', () => {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout)
        this.saveTimeout = null
      }
      if (this.cacheDirty) {
        this.saveCacheToFileSync()
      }
    })
  }

  public static getInstance(): FaviconService {
    if (!FaviconService.instance) {
      FaviconService.instance = new FaviconService()
    }
    return FaviconService.instance
  }

  // 获取 favicon
  public async getFavicon(url: string, options: { force?: boolean } = {}): Promise<string | null> {
    const { force = false } = options

    // 检查是否有相同请求正在进行
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url)!
    }

    // 首先检查缓存（除非强制刷新）
    if (!force) {
      const cached = this.memoryCache.get(this.getCacheKey(url))
      if (cached) {
        console.log(`✅ Favicon cache hit for ${url}: ${cached.faviconUrl}`)
        return cached.faviconUrl
      }
    }

    console.log(`🔍 Starting favicon fetch for ${url}${force ? ' (force refresh)' : ''}`)

    // 并发控制：等待直到有可用slot
    while (this.activeRequests >= this.maxConcurrentRequests) {
      await new Promise((resolve) => setTimeout(resolve, 50)) // 短暂等待
    }

    // 创建新请求并存储
    const promise = this.fetchFaviconInternal(url)
    this.pendingRequests.set(url, promise)
    this.activeRequests++

    try {
      const result = await promise
      // 缓存结果
      this.memoryCache.set(this.getCacheKey(url), {
        faviconUrl: result,
        timestamp: Date.now()
      })
      // 标记缓存为脏，延迟保存
      this.markCacheDirty()
      console.log(`✅ Favicon fetch successful for ${url}: ${result}`)
      return result
    } catch (error) {
      console.error(`❌ Favicon fetch failed for ${url}:`, error)
      // 不要抛出错误，返回null让前端处理
      return null
    } finally {
      this.pendingRequests.delete(url)
      this.activeRequests--
    }
  }

  // 批量预加载 favicon
  public async preloadFavicons(options: FaviconPreloadOptions): Promise<FaviconFetchResult[]> {
    const { urls, priority = [] } = options
    const results: FaviconFetchResult[] = []

    // 先处理优先级高的 URL
    const priorityUrls = priority.filter((url) => urls.includes(url))
    const normalUrls = urls.filter((url) => !priority.includes(url))

    // 并行处理所有 URL，但限制并发数量
    const allUrls = [...priorityUrls, ...normalUrls]
    const chunks = this.chunkArray(allUrls, this.config.parallelRequests)

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(chunk.map((url) => this.getFavicon(url)))

      chunkResults.forEach((result, index) => {
        const url = chunk[index]
        if (result.status === 'fulfilled') {
          results.push({
            url,
            faviconUrl: result.value,
            success: true
          })
        } else {
          results.push({
            url,
            faviconUrl: null,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          })
        }
      })
    }

    return results
  }

  // 获取缓存统计信息
  public getCacheStats(): {
    totalEntries: number
    hitRate: number
    memoryUsage: number
  } {
    return {
      totalEntries: this.memoryCache.size(),
      hitRate: 0, // 需要实现计数器来计算命中率
      memoryUsage: (this.memoryCache.size() / this.config.maxCacheSize) * 100
    }
  }

  // 清理缓存
  public clearCache(): void {
    this.memoryCache.clear()
    this.cacheDirty = false
    this.saveCacheToFile()
  }

  // 获取缓存键
  private getCacheKey(url: string): string {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.origin.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }

  // 内部获取 favicon 实现
  private async fetchFaviconInternal(url: string): Promise<string | null> {
    try {
      const parsedUrl = new URL(url)
      const origin = parsedUrl.origin

      // 1) 优先解析页面 link[rel*=icon]，尽量对齐浏览器策略
      const { tryHtmlParsing, tryCommonPaths } = await import('./fetcher')
      const htmlIcon = await tryHtmlParsing(url, this.config.timeout)
      if (htmlIcon) {
        console.log(`✅ Found favicon from HTML: ${htmlIcon}`)
        return htmlIcon
      }

      // 2) 回退常见路径（站点根目录）
      const commonPathIcon = await tryCommonPaths(origin, this.config.timeout)
      if (commonPathIcon) {
        console.log(`✅ Found favicon from common paths: ${commonPathIcon}`)
        return commonPathIcon
      }

      // 2.1) 对 apex 域名增加 www 回退（例如 google.com -> www.google.com）
      const hostname = parsedUrl.hostname
      const isIpv4 = /^\d+\.\d+\.\d+\.\d+$/.test(hostname)
      const isLocalHost = hostname === 'localhost'
      if (!hostname.startsWith('www.') && !isIpv4 && !isLocalHost) {
        const wwwOrigin = `${parsedUrl.protocol}//www.${hostname}`
        const wwwIcon = await tryCommonPaths(wwwOrigin, this.config.timeout)
        if (wwwIcon) {
          console.log(`✅ Found favicon from www fallback: ${wwwIcon}`)
          return wwwIcon
        }
      }

      // 3) 找不到可验证图标，返回 null 交给前端展示默认占位，避免无效请求噪音
      console.log(`⚠️ No valid favicon found for ${url}`)
      return null
    } catch (error) {
      console.error(`❌ Error fetching favicon for ${url}:`, error)
      return null
    }
  }

  // 从文件加载缓存
  private loadCacheFromFile(): void {
    try {
      if (existsSync(this.cacheFilePath)) {
        const data = readFileSync(this.cacheFilePath, 'utf-8')
        const parsed = JSON.parse(data)

        // 过滤过期条目
        const now = Date.now()
        Object.entries(parsed).forEach(([key, entry]) => {
          const cacheEntry = entry as { timestamp: number }
          if (now - cacheEntry.timestamp < this.config.cacheTtl) {
            this.memoryCache.set(key, entry as FaviconCacheEntry)
          }
        })
      }
    } catch (error) {
      console.error('Error loading favicon cache from file:', error)
    }
  }

  // 保存缓存到文件（异步防抖）
  private saveCacheToFile(): void {
    try {
      const cacheData = this.memoryCache.getAll()
      const serialized = Object.fromEntries(
        Array.from(cacheData.entries()).map(([key, entry]) => [key, entry.value])
      )
      writeFileSync(this.cacheFilePath, JSON.stringify(serialized, null, 2))
      this.cacheDirty = false
    } catch (error) {
      console.error('Error saving favicon cache to file:', error)
    }
  }

  // 同步保存（用于应用退出）
  private saveCacheToFileSync(): void {
    try {
      const cacheData = this.memoryCache.getAll()
      const serialized = Object.fromEntries(
        Array.from(cacheData.entries()).map(([key, entry]) => [key, entry.value])
      )
      writeFileSync(this.cacheFilePath, JSON.stringify(serialized, null, 2))
    } catch (error) {
      console.error('Error saving favicon cache to file on exit:', error)
    }
  }

  // 标记缓存为脏并延迟保存
  private markCacheDirty(): void {
    this.cacheDirty = true
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout)
    }
    this.saveTimeout = setTimeout(() => {
      if (this.cacheDirty) {
        this.saveCacheToFile()
      }
    }, 2000) // 2秒防抖
  }

  // 将数组分块
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // 更新配置
  public updateConfig(newConfig: Partial<FaviconServiceConfig>): void {
    this.config = { ...this.config, ...newConfig }
    // 如果需要，可以重新初始化缓存
    if (newConfig.maxCacheSize !== undefined) {
      const currentEntries = this.memoryCache.getAll()
      this.memoryCache = new LRUCache(newConfig.maxCacheSize, this.config.cacheTtl)
      currentEntries.forEach((entry, key) => {
        this.memoryCache.set(key, entry.value)
      })
      this.markCacheDirty()
    }
  }
}
