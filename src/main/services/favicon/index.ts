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
import { fetchFaviconByStrategy } from './fetcher'
import { FaviconStrategy } from './types'

export class FaviconService {
  private static instance: FaviconService
  private memoryCache: LRUCache<string, FaviconCacheEntry>
  private pendingRequests = new Map<string, Promise<string | null>>()
  private cacheFilePath: string
  private config: FaviconServiceConfig

  private constructor() {
    this.config = {
      cacheTtl: 7 * 24 * 60 * 60 * 1000, // 7天
      maxCacheSize: 500,
      timeout: 3000,
      parallelRequests: 3
    }

    this.memoryCache = new LRUCache(this.config.maxCacheSize, this.config.cacheTtl)
    this.cacheFilePath = join(app.getPath('userData'), 'favicons.json')

    // 从文件加载缓存
    this.loadCacheFromFile()
  }

  public static getInstance(): FaviconService {
    if (!FaviconService.instance) {
      FaviconService.instance = new FaviconService()
    }
    return FaviconService.instance
  }

  // 获取单个 favicon
  public async getFavicon(url: string): Promise<string | null> {
    // 检查是否有相同请求正在进行
    if (this.pendingRequests.has(url)) {
      return this.pendingRequests.get(url)!
    }

    // 首先检查缓存
    const cached = this.memoryCache.get(this.getCacheKey(url))
    if (cached) {
      return cached.faviconUrl
    }

    // 创建新请求并存储
    const promise = this.fetchFaviconInternal(url)
    this.pendingRequests.set(url, promise)

    try {
      const result = await promise
      // 缓存结果
      this.memoryCache.set(this.getCacheKey(url), {
        faviconUrl: result,
        timestamp: Date.now()
      })
      // 定期保存到文件
      if (Math.random() < 0.1) {
        // 10% 概率保存，避免频繁IO
        this.saveCacheToFile()
      }
      return result
    } finally {
      this.pendingRequests.delete(url)
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
    this.saveCacheToFile()
  }

  // 获取缓存键
  private getCacheKey(url: string): string {
    try {
      const parsedUrl = new URL(url)
      return `${parsedUrl.hostname}${parsedUrl.pathname}`.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }

  // 内部获取 favicon 实现
  private async fetchFaviconInternal(url: string): Promise<string | null> {
    try {
      const parsedUrl = new URL(url)
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`

      // 优化后的策略：并行尝试多个方法
      const strategies: FaviconStrategy[] = ['third-party', 'common-paths', 'html-parsing']

      // 为每个策略创建 Promise
      const strategyPromises = strategies.map((strategy) =>
        fetchFaviconByStrategy(url, strategy, this.config.timeout).catch((error) => {
          console.error(`Strategy ${strategy} failed for ${url}:`, error)
          return null
        })
      )

      // 使用 Promise.any 获取第一个成功的结果
      try {
        return await Promise.any(strategyPromises)
      } catch {
        // 如果所有策略都失败，返回 fallback
        return `${baseUrl}/favicon.ico`
      }
    } catch (error) {
      console.error(`Error fetching favicon for ${url}:`, error)
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

  // 保存缓存到文件
  private saveCacheToFile(): void {
    try {
      const cacheData = this.memoryCache.getAll()
      const serialized = Object.fromEntries(
        Array.from(cacheData.entries()).map(([key, entry]) => [key, entry.value])
      )
      writeFileSync(this.cacheFilePath, JSON.stringify(serialized, null, 2))
    } catch (error) {
      console.error('Error saving favicon cache to file:', error)
    }
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
    }
  }
}
