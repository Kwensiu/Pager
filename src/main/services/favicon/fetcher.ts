import { URL } from 'url'
import { request as httpsRequest } from 'https'
import { request as httpRequest } from 'http'

type HttpMethod = 'HEAD' | 'GET'

interface RawHttpProbeResult {
  statusCode: number
  contentType?: string
  finalUrl: string
  sample: Buffer
}

interface UrlCheckResult {
  statusCode: number
  contentType?: string
  finalUrl: string
  method: HttpMethod
  sniffedAsIcon: boolean
}

const MAX_REDIRECTS = 5
const MAX_SNIFF_BYTES = 8192
const MAX_HTML_BYTES = 1024 * 1024
const DEFAULT_PER_HOP_TIMEOUT = 8000

function isSupportedProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:'
}

function normalizeContentType(contentType?: string): string {
  return (contentType || '').toLowerCase()
}

function isIconLikeContentType(contentType?: string): boolean {
  const normalized = normalizeContentType(contentType)
  if (!normalized) return false
  return (
    normalized.startsWith('image/') ||
    normalized.includes('svg') ||
    normalized.includes('x-icon') ||
    normalized.includes('vnd.microsoft.icon')
  )
}

function hasIconLikeExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return /\.(ico|png|svg|webp|avif|jpg|jpeg|gif)$/.test(pathname)
  } catch {
    return false
  }
}

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  return bytes.every((value, index) => buffer[index] === value)
}

function stripLeadingUnicodeNoise(text: string): string {
  let value = text.replace(/^\uFEFF/, '')
  let index = 0
  while (index < value.length && value.charCodeAt(index) <= 32) {
    index++
  }
  value = value.slice(index)
  value = value.replace(/^<\?xml[^>]*\?>\s*/i, '')
  return value.trimStart()
}

function sniffIconBytes(sample: Buffer, contentType?: string): boolean {
  if (isIconLikeContentType(contentType)) {
    return true
  }
  if (!sample.length) {
    return false
  }

  // ICO: 00 00 01 00
  if (startsWithBytes(sample, [0x00, 0x00, 0x01, 0x00])) return true
  // PNG
  if (startsWithBytes(sample, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return true
  // GIF87a / GIF89a
  if (sample.length >= 6) {
    const gifSig = sample.subarray(0, 6).toString('ascii')
    if (gifSig === 'GIF87a' || gifSig === 'GIF89a') return true
  }
  // JPEG
  if (startsWithBytes(sample, [0xff, 0xd8, 0xff])) return true
  // WEBP: RIFF....WEBP
  if (
    sample.length >= 12 &&
    sample.subarray(0, 4).toString('ascii') === 'RIFF' &&
    sample.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return true
  }
  // AVIF: ....ftypavif or ftypavis
  if (
    sample.length >= 12 &&
    sample.subarray(4, 8).toString('ascii') === 'ftyp' &&
    ['avif', 'avis'].includes(sample.subarray(8, 12).toString('ascii'))
  ) {
    return true
  }

  // SVG sniff: 仅当文档起始就是 SVG，且排除明显 HTML 文档
  const text = stripLeadingUnicodeNoise(sample.toString('utf8')).toLowerCase()
  if (text.startsWith('<!doctype html') || text.startsWith('<html')) {
    return false
  }
  return text.startsWith('<svg')
}

function getPerHopTimeout(timeout: number): number {
  return Math.max(1000, Math.min(DEFAULT_PER_HOP_TIMEOUT, timeout))
}

async function probeWithRedirects(
  url: string,
  method: HttpMethod,
  options: {
    deadline: number
    perHopTimeout: number
    maxRedirects: number
    maxBytes: number
  }
): Promise<RawHttpProbeResult> {
  const visited = new Set<string>()

  const probe = async (currentUrl: string, redirectsLeft: number): Promise<RawHttpProbeResult> => {
    if (visited.has(currentUrl)) {
      throw new Error(`Redirect loop detected for ${currentUrl}`)
    }
    visited.add(currentUrl)

    const urlObj = new URL(currentUrl)
    if (!isSupportedProtocol(urlObj.protocol)) {
      throw new Error(`Unsupported protocol in favicon probe: ${urlObj.protocol}`)
    }

    const now = Date.now()
    if (now >= options.deadline) {
      throw new Error('Request timeout')
    }
    const remaining = options.deadline - now
    const hopTimeout = Math.max(200, Math.min(options.perHopTimeout, remaining))
    const requestImpl = urlObj.protocol === 'http:' ? httpRequest : httpsRequest

    return new Promise((resolve, reject) => {
      let settled = false
      let intentionalAbort = false
      const chunks: Buffer[] = []
      let collected = 0

      const safeResolve = (value: RawHttpProbeResult): void => {
        if (settled) return
        settled = true
        resolve(value)
      }

      const safeReject = (error: Error): void => {
        if (settled) return
        settled = true
        reject(error)
      }

      const req = requestImpl(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || undefined,
          path: urlObj.pathname + urlObj.search,
          method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
          },
          timeout: hopTimeout
        },
        (res) => {
          const statusCode = res.statusCode || 500
          const contentTypeHeader = res.headers['content-type']
          const contentType = Array.isArray(contentTypeHeader)
            ? contentTypeHeader[0]
            : contentTypeHeader

          const locationHeader = res.headers.location
          const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader
          const isRedirect = [301, 302, 303, 307, 308].includes(statusCode)

          if (isRedirect && location && redirectsLeft > 0) {
            try {
              const nextUrl = new URL(location, currentUrl).href
              const nextProtocol = new URL(nextUrl).protocol
              if (!isSupportedProtocol(nextProtocol)) {
                safeResolve({
                  statusCode,
                  contentType,
                  finalUrl: currentUrl,
                  sample: Buffer.alloc(0)
                })
                return
              }

              intentionalAbort = true
              req.destroy()
              res.destroy()
              void probe(nextUrl, redirectsLeft - 1).then(safeResolve).catch(safeReject)
              return
            } catch (error) {
              safeReject(error instanceof Error ? error : new Error(String(error)))
              return
            }
          }

          if (method === 'HEAD') {
            safeResolve({
              statusCode,
              contentType,
              finalUrl: currentUrl,
              sample: Buffer.alloc(0)
            })
            return
          }

          res.on('data', (chunk) => {
            if (settled) return
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
            const remainingBytes = Math.max(0, options.maxBytes - collected)
            if (remainingBytes <= 0) return
            const toStore = buffer.subarray(0, remainingBytes)
            chunks.push(toStore)
            collected += toStore.length

            if (collected >= options.maxBytes) {
              intentionalAbort = true
              safeResolve({
                statusCode,
                contentType,
                finalUrl: currentUrl,
                sample: Buffer.concat(chunks, collected)
              })
              req.destroy()
              res.destroy()
            }
          })

          res.on('end', () => {
            if (settled) return
            safeResolve({
              statusCode,
              contentType,
              finalUrl: currentUrl,
              sample: Buffer.concat(chunks, collected)
            })
          })
        }
      )

      req.on('timeout', () => {
        if (settled) return
        req.destroy()
        safeReject(new Error('Request timeout'))
      })

      req.on('error', (error) => {
        if (settled || intentionalAbort) return
        safeReject(error instanceof Error ? error : new Error(String(error)))
      })

      req.end()
    })
  }

  return probe(url, options.maxRedirects)
}

function isLikelyValidFavicon(result: UrlCheckResult): boolean {
  if (result.statusCode < 200 || result.statusCode >= 300) {
    return false
  }

  if (result.sniffedAsIcon) {
    return true
  }

  if (isIconLikeContentType(result.contentType)) {
    return true
  }

  // 当内容类型缺失时，使用扩展名兜底
  if (!result.contentType && hasIconLikeExtension(result.finalUrl)) {
    return true
  }

  return false
}

function shouldFallbackToGet(head: RawHttpProbeResult): boolean {
  if ([403, 405].includes(head.statusCode)) return true
  if (head.statusCode >= 500) return true
  if (head.statusCode < 200 || head.statusCode >= 300) return true

  const contentType = normalizeContentType(head.contentType)
  if (!contentType) return true
  if (isIconLikeContentType(contentType)) return false

  // 非图标内容类型视为可疑，尝试 GET + sniff 兜底
  return true
}

export async function checkUrlStatus(url: string, timeout: number = 3000): Promise<UrlCheckResult> {
  const deadline = Date.now() + timeout
  const perHopTimeout = getPerHopTimeout(timeout)

  let head: RawHttpProbeResult | null = null
  try {
    head = await probeWithRedirects(url, 'HEAD', {
      deadline,
      perHopTimeout,
      maxRedirects: MAX_REDIRECTS,
      maxBytes: 0
    })
  } catch {
    // HEAD 失败时回退 GET，避免对不支持 HEAD 的站点产生假阴性
    head = null
  }

  if (head && !shouldFallbackToGet(head)) {
    return {
      statusCode: head.statusCode,
      contentType: head.contentType,
      finalUrl: head.finalUrl,
      method: 'HEAD',
      sniffedAsIcon: false
    }
  }

  // 如果 HEAD 不可靠，回退到 GET 并做少量 sniff
  const get = await probeWithRedirects(head?.finalUrl || url, 'GET', {
    deadline,
    perHopTimeout,
    maxRedirects: MAX_REDIRECTS,
    maxBytes: MAX_SNIFF_BYTES
  })

  return {
    statusCode: get.statusCode,
    contentType: get.contentType,
    finalUrl: get.finalUrl,
    method: 'GET',
    sniffedAsIcon: sniffIconBytes(get.sample, get.contentType)
  }
}

// 获取 URL 内容的辅助函数
export async function fetchUrlContent(url: string, timeout: number = 5000): Promise<string> {
  const deadline = Date.now() + timeout
  const perHopTimeout = getPerHopTimeout(timeout)
  const result = await probeWithRedirects(url, 'GET', {
    deadline,
    perHopTimeout,
    maxRedirects: MAX_REDIRECTS,
    maxBytes: MAX_HTML_BYTES
  })
  return result.sample.toString('utf8')
}

// 从 HTML 中提取 link 标签的辅助函数
export function extractLinkTags(html: string, selector: string): string[] {
  const relMatch = selector.includes('[rel=')
    ? selector.match(/link\[rel=["']?([^"'\]]*)["']?\]/)?.[1]
    : null
  const sizesMatch = selector.includes('sizes=')
    ? selector.match(/sizes=["']?([^"'\]]*)["']?\]/)?.[1]
    : null

  const linkTagRegex = /<link\s+([^>]+)>/gi
  const matches: string[] = []

  let match
  while ((match = linkTagRegex.exec(html)) !== null) {
    const tag = match[0]
    const tagContent = match[1]
    let matchesSelector = true

    if (relMatch) {
      const relPattern = new RegExp(`rel\\s*=\\s*["']([^"']*)["']`, 'i')
      const relMatchResult = relPattern.exec(tagContent)
      if (!relMatchResult) {
        matchesSelector = false
      } else {
        const relValue = relMatchResult[1].toLowerCase()
        if (relMatch.includes('*')) {
          if (!relValue.includes(relMatch.replace('*=', '').replace(/["'\]]/g, ''))) {
            matchesSelector = false
          }
        } else if (relMatch.includes(' ')) {
          if (relValue !== relMatch) {
            matchesSelector = false
          }
        } else {
          const tokens = relValue.split(/\s+/)
          if (!tokens.includes(relMatch)) {
            matchesSelector = false
          }
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
  timeout: number = 3000
): Promise<string | null> {
  const commonPaths = ['/favicon.ico', '/favicon.png', '/apple-touch-icon.png']

  for (const path of commonPaths) {
    try {
      const faviconUrl = `${baseUrl}${path}`
      const result = await checkUrlStatus(faviconUrl, timeout)
      if (isLikelyValidFavicon(result)) {
        return result.finalUrl
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

// 从 HTML 解析 favicon
export async function tryHtmlParsing(url: string, timeout: number = 5000): Promise<string | null> {
  try {
    const html = await fetchUrlContent(url, timeout)
    if (!html) return null

    const iconSelectors = [
      'link[rel="apple-touch-icon"][sizes="180x180"]',
      'link[rel="icon"][sizes="192x192"]',
      'link[rel="icon"][sizes="32x32"]',
      'link[rel="icon"][sizes="16x16"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="icon"]',
      'link[rel*="icon"]'
    ]

    for (const selector of iconSelectors) {
      const iconLinks = extractLinkTags(html, selector)

      // Chromium/MDN 规则中“同等候选取最后一个”
      for (const iconLink of [...iconLinks].reverse()) {
        let href = extractHref(iconLink)
        if (!href) continue

        if (href.startsWith('//')) {
          href = new URL(href, url).href
        } else if (href.startsWith('/')) {
          href = new URL(href, url).href
        } else if (!href.startsWith('http')) {
          href = new URL(href, url).href
        }

        try {
          const result = await checkUrlStatus(href, timeout)
          if (isLikelyValidFavicon(result)) {
            return result.finalUrl
          }
        } catch {
          continue
        }
      }
    }
  } catch (error) {
    console.error('Error fetching page to extract favicon:', error)
  }

  return null
}
