import { URL } from 'url'
import { FaviconStrategy } from './types'
import { globalProxyService } from '../proxyService'

// 检查 URL 状态的辅助函数
export function checkUrlStatus(url: string, timeout: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    ;(async () => {
      try {
        // 获取软件专用session
        const softwareSession = globalProxyService.getSoftwareSession()

        const fetchOptions: RequestInit = {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
          }
        }

        // 设置超时
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await softwareSession.fetch(url, {
            ...fetchOptions,
            signal: controller.signal
          } as Record<string, unknown>)

          clearTimeout(timeoutId)
          resolve(response.status || 500)
        } catch (error) {
          clearTimeout(timeoutId)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

// 获取 URL 内容的辅助函数
export function fetchUrlContent(url: string, timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    ;(async () => {
      try {
        // 获取软件专用session
        const softwareSession = globalProxyService.getSoftwareSession()

        const fetchOptions: RequestInit = {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
          }
        }

        // 设置超时
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        try {
          const response = await softwareSession.fetch(url, {
            ...fetchOptions,
            signal: controller.signal
          } as Record<string, unknown>)

          clearTimeout(timeoutId)
          const data = await response.text()
          resolve(data)
        } catch (error) {
          clearTimeout(timeoutId)
          reject(error)
        }
      } catch (error) {
        reject(error)
      }
    })()
  })
}

// 从 HTML 中提取 link 标签的辅助函数
export function extractLinkTags(html: string, selector: string): string[] {
  // 通过正则表达式解析 HTML，提取匹配的 link 标签
  const relMatch = selector.includes('[rel=')
    ? selector.match(/link\[rel=["']?([^"'\]]*)["']?\]/)?.[1]
    : null
  const sizesMatch = selector.includes('sizes=')
    ? selector.match(/sizes=["']?([^"'\]]*)["']?\]/)?.[1]
    : null

  // 提取所有 link 标签
  const linkTagRegex = /<link\s+([^>]+)>/gi
  const matches: string[] = []

  let match
  while ((match = linkTagRegex.exec(html)) !== null) {
    const tag = match[0]
    const tagContent = match[1]

    // 检查是否匹配选择器条件
    let matchesSelector = true

    if (relMatch) {
      const relPattern = new RegExp(`rel\\s*=\\s*["']([^"']*)["']`, 'i')
      const relMatchResult = relPattern.exec(tagContent)
      if (!relMatchResult) {
        matchesSelector = false
      } else {
        const relValue = relMatchResult[1].toLowerCase()
        if (relMatch.includes('*')) {
          // 处理包含匹配，例如 [rel*="icon"]
          if (!relValue.includes(relMatch.replace('*=', '').replace(/["'\]]/g, ''))) {
            matchesSelector = false
          }
        } else if (relValue !== relMatch) {
          // 完全匹配
          matchesSelector = false
        }
      }
    }

    if (sizesMatch && matchesSelector) {
      const sizesPattern = new RegExp(`sizes\\s*=\\s*["']([^"']*)["']`, 'i')
      const sizesMatchResult = sizesPattern.exec(tagContent)
      if (!sizesMatchResult || sizesMatchResult[1] !== sizesMatch) {
        matchesSelector = false
      }
    }

    if (matchesSelector) {
      matches.push(tag)
    }
  }

  return matches
}

// 从 link 标签中提取 href 属性的辅助函数
export function extractHref(linkTag: string): string | null {
  const hrefPattern = /href\s*=\s*["']([^"']*)["']/i
  const match = hrefPattern.exec(linkTag)
  return match ? match[1] : null
}

// 尝试常见的 favicon 路径
export async function tryCommonPaths(
  baseUrl: string,
  _paths: string[],
  timeout: number = 3000
): Promise<string | null> {
  const commonPaths = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png']

  for (const path of commonPaths) {
    try {
      const faviconUrl = `${baseUrl}${path}`
      const statusCode = await checkUrlStatus(faviconUrl, timeout)
      if (statusCode < 400) {
        return faviconUrl
      }
    } catch {
      continue
    }
  }

  return null
}

// 尝试第三方 favicon 服务
export async function tryThirdPartyServices(
  hostname: string,
  timeout: number = 3000
): Promise<string | null> {
  const faviconServices = [
    `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    `https://t0.gstatic.com/favicon?domain=${hostname}&sz=64`,
    `https://icon.horse/icon/${hostname}`,
    `https://favicon.io/favicon/${hostname}/`
  ]

  // 并行检查所有服务
  const promises = faviconServices.map(async (serviceUrl) => {
    try {
      const statusCode = await checkUrlStatus(serviceUrl, timeout)
      return statusCode < 400 ? serviceUrl : null
    } catch {
      return null
    }
  })

  // 返回第一个成功的结果
  const results = await Promise.all(promises)
  return results.find((result) => result !== null) || null
}

// 从 HTML 解析 favicon
export async function tryHtmlParsing(url: string, timeout: number = 5000): Promise<string | null> {
  try {
    const html = await fetchUrlContent(url, timeout)
    if (!html) return null

    // 按优先级排序的图标选择器
    const iconSelectors = [
      'link[rel="apple-touch-icon"][sizes="180x180"]', // 高优先级：特定尺寸的apple touch icon
      'link[rel="icon"][sizes="192x192"]', // 高优先级：Android规范尺寸
      'link[rel="icon"][sizes="32x32"]', // 标准favicon尺寸
      'link[rel="icon"][sizes="16x16"]', // 标准favicon尺寸
      'link[rel="shortcut icon"]', // 传统快捷方式图标
      'link[rel="apple-touch-icon"]', // apple touch icon（无特定尺寸）
      'link[rel="icon"]', // 通用图标标签
      'link[rel*="icon"]' // 包含icon的rel属性
    ]

    // 按优先级顺序尝试每个选择器
    for (const selector of iconSelectors) {
      const iconLinks = extractLinkTags(html, selector)

      // 按文档顺序尝试每个匹配的元素
      for (const iconLink of iconLinks) {
        let href = extractHref(iconLink)

        if (href) {
          // 处理相对路径
          if (href.startsWith('//')) {
            href = new URL(href, url).href
          } else if (href.startsWith('/')) {
            href = new URL(href, url).href
          } else if (!href.startsWith('http')) {
            href = new URL(href, url).href
          }

          // 验证图标 URL 是否有效
          try {
            const statusCode = await checkUrlStatus(href, timeout)
            if (statusCode < 400) {
              return href
            }
          } catch {
            continue
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching page to extract favicon:', error)
  }

  return null
}

// 获取 favicon 的主函数，按策略执行
export async function fetchFaviconByStrategy(
  url: string,
  strategy: FaviconStrategy,
  timeout: number = 3000
): Promise<string | null> {
  try {
    const parsedUrl = new URL(url)
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`
    const hostname = parsedUrl.hostname

    switch (strategy) {
      case 'third-party':
        return await tryThirdPartyServices(hostname, timeout)

      case 'common-paths':
        return await tryCommonPaths(baseUrl, [], timeout)

      case 'html-parsing':
        return await tryHtmlParsing(url, timeout)

      default:
        return null
    }
  } catch (error) {
    console.error(`Error fetching favicon with strategy ${strategy}:`, error)
    return null
  }
}
