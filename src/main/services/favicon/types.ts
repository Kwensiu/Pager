export interface FaviconCacheEntry {
  faviconUrl: string | null
  timestamp: number
}

export interface FaviconFetchResult {
  url: string
  faviconUrl: string | null
  success: boolean
  error?: string
}

export interface FaviconServiceConfig {
  cacheTtl: number // 缓存过期时间（毫秒）
  maxCacheSize: number // 最大缓存条目数
  timeout: number // 请求超时时间（毫秒）
  parallelRequests: number // 并行请求数量
}

export interface FaviconPreloadOptions {
  urls: string[]
  priority?: string[] // 优先加载的 URL
}
