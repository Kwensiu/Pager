import { URL } from 'url'
import { FaviconStrategy } from './types'
import { request } from 'https'
import { BrowserWindow } from 'electron'

// 使用Electron webContents来获取favicon的备选方案
export async function fetchFaviconViaWebContents(
  url: string,
  timeout: number = 5000
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      console.log('🌐 Using webContents to fetch favicon for:', url)

      // 创建一个隐藏的BrowserWindow来获取favicon
      const faviconWindow = new BrowserWindow({
        show: false,
        width: 1,
        height: 1,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          allowRunningInsecureContent: false
        }
      })

      // 设置超时
      const timeoutId = setTimeout(() => {
        console.warn(`⏰ WebContents favicon fetch timeout for ${url}`)
        faviconWindow.destroy()
        resolve(null)
      }, timeout)

      faviconWindow.webContents.once('did-finish-load', async () => {
        try {
          // 尝试获取favicon URL
          const faviconUrl = await faviconWindow.webContents.executeJavaScript(`
            (function() {
              // 查找favicon link标签
              const links = document.querySelectorAll('link[rel*="icon"]');
              for (const link of links) {
                const href = link.getAttribute('href');
                if (href) {
                  // 转换为绝对URL
                  try {
                    return new URL(href, window.location.href).href;
                  } catch (e) {
                    return href;
                  }
                }
              }
              // 默认favicon路径
              return new URL('/favicon.ico', window.location.href).href;
            })()
          `)

          clearTimeout(timeoutId)
          faviconWindow.destroy()

          if (faviconUrl) {
            console.log(`✅ WebContents found favicon: ${faviconUrl}`)
            resolve(faviconUrl)
          } else {
            console.warn(`⚠️ WebContents found no favicon for ${url}`)
            resolve(null)
          }
        } catch (error) {
          clearTimeout(timeoutId)
          faviconWindow.destroy()
          console.warn(`❌ WebContents favicon extraction failed:`, error)
          resolve(null)
        }
      })

      faviconWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
        clearTimeout(timeoutId)
        faviconWindow.destroy()
        console.warn(`❌ WebContents failed to load ${url}: ${errorCode} - ${errorDescription}`)
        resolve(null)
      })

      // 加载页面
      faviconWindow.loadURL(url).catch((error) => {
        clearTimeout(timeoutId)
        faviconWindow.destroy()
        console.warn(`❌ WebContents failed to load URL ${url}:`, error)
        resolve(null)
      })
    } catch (error) {
      console.error('❌ WebContents favicon fetch setup failed:', error)
      resolve(null)
    }
  })
}
export function checkUrlStatus(url: string, timeout: number = 3000): Promise<number> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url)
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
        },
        timeout: timeout
      }

      console.log('🔍 Using Node.js HTTPS for URL check:', url)

      const req = request(options, (res) => {
        console.log(`📊 ${url} status: ${res.statusCode}`)
        resolve(res.statusCode || 500)
      })

      req.on('error', (error) => {
        console.warn(`❌ ${url} check failed:`, error.message)
        reject(error)
      })

      req.on('timeout', () => {
        console.warn(`⏰ ${url} check timeout`)
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    } catch (error) {
      reject(error)
    }
  })
}

// 获取 URL 内容的辅助函数
export function fetchUrlContent(url: string, timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url)
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
        },
        timeout: timeout
      }

      console.log('📄 Using Node.js HTTPS to fetch HTML:', url)

      const req = request(options, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          console.log(`✅ HTML fetched for ${url}, length: ${data.length}`)
          resolve(data)
        })
      })

      req.on('error', (error) => {
        console.warn(`❌ HTML fetch failed for ${url}:`, error.message)
        reject(error)
      })

      req.on('timeout', () => {
        console.warn(`⏰ HTML fetch timeout for ${url}`)
        req.destroy()
        reject(new Error('Request timeout'))
      })

      req.end()
    } catch (error) {
      reject(error)
    }
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
      // 静默失败，继续下一个路径
    }
  }

  console.warn(
    `⚠️ Common paths strategy failed for ${baseUrl} - no favicon found at standard locations`
  )
  return null
}

// 尝试第三方 favicon 服务
export async function tryThirdPartyServices(
  hostname: string,
  timeout: number = 2000 // 缩短超时，第三方服务通常很快
): Promise<string | null> {
  console.log(`🔍 Checking third-party services for ${hostname}`)
  const faviconServices = [
    `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    `https://t0.gstatic.com/favicon?domain=${hostname}&sz=64`,
    `https://icon.horse/icon/${hostname}`,
    `https://favicon.io/favicon/${hostname}/`
  ]

  // 使用 Promise.allSettled 获取所有服务的结果
  const promises = faviconServices.map(async (serviceUrl) => {
    try {
      console.log(`🌐 Testing ${serviceUrl}`)
      const statusCode = await checkUrlStatus(serviceUrl, timeout)
      console.log(`📊 ${serviceUrl} returned status: ${statusCode}`)
      return statusCode < 400 ? serviceUrl : null
    } catch (error) {
      console.warn(
        `❌ ${serviceUrl} failed:`,
        error instanceof Error ? error.message : String(error)
      )
      return null
    }
  })

  // 使用 Promise.allSettled 获取所有结果
  try {
    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        console.log(`✅ Third-party service success: ${result.value}`)
        return result.value
      }
    }
    console.warn(
      `⚠️ Third-party services failed for ${hostname} - all external favicon services unavailable`
    )
    return null
  } catch (error) {
    console.warn(
      `⚠️ Third-party services failed for ${hostname} - all external favicon services unavailable:`,
      error
    )
    return null
  }
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
