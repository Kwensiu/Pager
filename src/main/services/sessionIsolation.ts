import { session, CookiesSetDetails, app } from 'electron'
import type { Website } from '../../shared/types/store'

/**
 * Session 隔离服务
 * 管理不同网站的会话隔离
 */
class SessionIsolationService {
  private sessions: Map<string, Electron.Session> = new Map()
  private websiteSessions: Map<string, string> = new Map() // websiteId -> partition
  private initialized: boolean = false
  private clearAllSessionsPromise: Promise<void> | null = null

  constructor() {
    // 延迟初始化，不在构造函数中访问 app
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    if (!app.isReady()) {
      await app.whenReady()
    }

    this.initialized = true
  }

  /**
   * 确保服务已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private async waitForClearAllSessions(): Promise<void> {
    if (this.clearAllSessionsPromise) {
      await this.clearAllSessionsPromise
    }
  }

  /**
   * 为网站创建隔离的 Session
   * @param website 网站配置
   * @returns Session 分区名称
   */
  async createIsolatedSession(website: Website): Promise<string> {
    await this.ensureInitialized()
    await this.waitForClearAllSessions()

    if (!website.id) {
      throw new Error('Website ID is required')
    }

    // 如果已经存在 Session，返回现有的
    const existingPartition = this.websiteSessions.get(website.id)
    if (existingPartition) {
      return existingPartition
    }

    // 创建唯一的 partition 名称
    const partition = `persist:website-${website.id}-${Date.now()}`

    // 创建隔离的 Session
    const isolatedSession = session.fromPartition(partition, {
      cache: true
    })

    // 配置 Session
    this.configureSession(isolatedSession, website)

    // 存储 Session
    this.sessions.set(partition, isolatedSession)
    this.websiteSessions.set(website.id, partition)

    console.log(`Isolated session created for website ${website.id}: ${partition}`)
    return partition
  }

  /**
   * 配置 Session
   * @param sess Session 实例
   * @param website 网站配置
   */
  private configureSession(sess: Electron.Session, website: Website): void {
    // 设置代理（如果网站有代理配置）
    if (website.proxy) {
      sess.setProxy({ proxyRules: website.proxy })
    }

    // 禁用不安全的特性
    sess.setPermissionRequestHandler((_webContents, permission, callback) => {
      // 默认拒绝所有权限请求
      console.log(`Permission request: ${permission} for website ${website.id} - denied`)
      callback(false)
    })

    // 监听 Cookie 变化
    sess.cookies.on('changed', (_event, cookie, _cause, removed) => {
      console.log(
        `Cookie ${removed ? 'removed' : 'changed'} for website ${website.id}:`,
        cookie.name
      )
    })
  }

  /**
   * 获取网站的 Session
   * @param websiteId 网站ID
   * @returns Session 实例或 null
   */
  async getWebsiteSession(websiteId: string): Promise<Electron.Session | null> {
    await this.ensureInitialized()
    const partition = this.websiteSessions.get(websiteId)
    if (!partition) {
      return null
    }

    return this.sessions.get(partition) || null
  }

  /**
   * 获取 Session 分区名称
   * @param websiteId 网站ID
   * @returns 分区名称或 null
   */
  async getWebsitePartition(websiteId: string): Promise<string | null> {
    await this.ensureInitialized()
    return this.websiteSessions.get(websiteId) || null
  }

  /**
   * 清除网站的 Session
   * @param websiteId 网站ID
   */
  async clearWebsiteSession(websiteId: string): Promise<boolean> {
    await this.ensureInitialized()
    await this.waitForClearAllSessions()
    const partition = this.websiteSessions.get(websiteId)
    if (!partition) {
      return false
    }

    const sess = this.sessions.get(partition)
    if (sess) {
      // 清除缓存和存储，确保清理完成后再返回
      const cleanupResults = await Promise.allSettled([
        sess.clearCache(),
        sess.clearStorageData(),
        sess.clearAuthCache(),
        sess.clearHostResolverCache()
      ])

      cleanupResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const operation = [
            'clearCache',
            'clearStorageData',
            'clearAuthCache',
            'clearHostResolverCache'
          ][index]
          console.error(`Failed to ${operation} for website ${websiteId}:`, result.reason)
        }
      })

      // 清除所有 Cookie
      const cookies = await sess.cookies.get({})
      await Promise.all(
        cookies.map(async (cookie) => {
          try {
            const rawDomain = cookie.domain || ''
            const cookieDomain = rawDomain.startsWith('.') ? rawDomain.slice(1) : rawDomain
            if (!cookieDomain) {
              return
            }
            const url = cookie.secure ? `https://${cookieDomain}` : `http://${cookieDomain}`
            await sess.cookies.remove(url, cookie.name)
          } catch (error) {
            console.error(`Failed to remove cookie ${cookie.name}:`, error)
          }
        })
      )
    }

    this.sessions.delete(partition)
    this.websiteSessions.delete(websiteId)

    console.log(`Session cleared for website ${websiteId}`)
    return true
  }

  /**
   * 清除所有网站的 Session
   */
  async clearAllSessions(options?: {
    clearSessionCache?: boolean
    clearStorageData?: boolean
    clearAuthCache?: boolean
  }): Promise<void> {
    await this.ensureInitialized()
    if (this.clearAllSessionsPromise) {
      await this.clearAllSessionsPromise
      return
    }

    const clearPromise = (async (): Promise<void> => {
      const sessionEntries = Array.from(this.sessions.entries())
      const websiteEntries = Array.from(this.websiteSessions.entries())

      const clearTasks = sessionEntries.map(async ([partition, sess]) => {
        try {
          const tasks: Array<{ name: string; promise: Promise<void> }> = []

          if (options?.clearSessionCache !== false) {
            tasks.push({ name: 'clearCache', promise: sess.clearCache() })
          }
          if (options?.clearStorageData !== false) {
            tasks.push({ name: 'clearStorageData', promise: sess.clearStorageData() })
          }
          if (options?.clearAuthCache !== false) {
            tasks.push({ name: 'clearAuthCache', promise: sess.clearAuthCache() })
          }

          const results = await Promise.allSettled(tasks.map((task) => task.promise))
          results.forEach((result, index) => {
            if (result.status === 'rejected') {
              const operation = tasks[index]?.name || 'unknown'
              console.error(`Failed to ${operation} for session ${partition}:`, result.reason)
            }
          })
        } catch (error) {
          console.error(`Error clearing session ${partition}:`, error)
        }
      })

      await Promise.all(clearTasks)

      // 只删除快照中的索引，避免误删清理期间新增的数据（新增操作已被锁等待）
      for (const [partition] of sessionEntries) {
        this.sessions.delete(partition)
      }
      for (const [websiteId] of websiteEntries) {
        this.websiteSessions.delete(websiteId)
      }

      console.log('All sessions cleared')
    })()

    this.clearAllSessionsPromise = clearPromise
    try {
      await clearPromise
    } finally {
      if (this.clearAllSessionsPromise === clearPromise) {
        this.clearAllSessionsPromise = null
      }
    }
  }

  /**
   * 导出网站的 Cookie
   * @param websiteId 网站ID
   */
  async exportWebsiteCookies(websiteId: string): Promise<Electron.Cookie[]> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      throw new Error(`No session found for website ${websiteId}`)
    }

    try {
      const cookies = await sess.cookies.get({})
      return cookies
    } catch (error) {
      console.error(`Failed to export cookies for website ${websiteId}:`, error)
      throw error
    }
  }

  /**
   * 导入 Cookie 到网站
   * @param websiteId 网站ID
   * @param cookies Cookie 列表
   */
  async importWebsiteCookies(websiteId: string, cookies: Electron.Cookie[]): Promise<number> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      throw new Error(`No session found for website ${websiteId}`)
    }

    let importedCount = 0

    for (const cookie of cookies) {
      try {
        const details: CookiesSetDetails = {
          url: cookie.secure ? `https://${cookie.domain}` : `http://${cookie.domain}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate
        }

        await sess.cookies.set(details)
        importedCount++
      } catch (error) {
        console.error(`Failed to import cookie ${cookie.name}:`, error)
      }
    }

    console.log(`Imported ${importedCount} cookies for website ${websiteId}`)
    return importedCount
  }

  /**
   * 获取 Session 统计信息
   * @param websiteId 网站ID
   */
  async getSessionStats(websiteId: string): Promise<{
    cacheSize: number
    cookieCount: number
    storageSize: number
    partition: string
  } | null> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      return null
    }

    const partition = await this.getWebsitePartition(websiteId)
    if (!partition) {
      return null
    }

    try {
      const cookies = await sess.cookies.get({})
      // Electron Session API 不提供直接的存储数据大小获取
      // clearStorageData() 和 getStoragePath() 可用，但无法直接计算大小

      return {
        cacheSize: 0, // Electron 不提供缓存大小获取
        cookieCount: cookies.length,
        storageSize: 0, // 需要其他方式获取
        partition
      }
    } catch (error) {
      console.error(`Failed to get session stats for website ${websiteId}:`, error)
      return {
        cacheSize: 0,
        cookieCount: 0,
        storageSize: 0,
        partition
      }
    }
  }

  /**
   * 检查 Session 隔离状态
   * @param websiteId 网站ID
   */
  async isWebsiteIsolated(websiteId: string): Promise<boolean> {
    await this.ensureInitialized()
    return this.websiteSessions.has(websiteId)
  }

  /**
   * 获取所有隔离的网站
   */
  async getAllIsolatedWebsites(): Promise<
    Array<{
      websiteId: string
      partition: string
      createdAt: number
    }>
  > {
    await this.ensureInitialized()
    const result: Array<{
      websiteId: string
      partition: string
      createdAt: number
    }> = []

    this.websiteSessions.forEach((partition, websiteId) => {
      // 从 partition 名称中提取时间戳
      const match = partition.match(/website-.*-(\d+)/)
      const createdAt = match ? parseInt(match[1], 10) : Date.now()

      result.push({
        websiteId,
        partition,
        createdAt
      })
    })

    return result
  }

  /**
   * 设置 Session 存储限制
   * @param websiteId 网站ID
   * @param limits 存储限制
   */
  async setStorageLimits(
    websiteId: string,
    limits: {
      localStorage: number
      indexedDB: number
      webSQL: number
      cache: number
    }
  ): Promise<boolean> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      return false
    }

    // Electron 的 Session 存储限制设置有限
    // 这里可以记录限制，实际应用中需要其他方式实现
    console.log(`Storage limits set for website ${websiteId}:`, limits)
    return true
  }

  /**
   * 启用/禁用网站的特性
   * @param websiteId 网站ID
   * @param features 特性配置
   */
  async setWebsiteFeatures(
    websiteId: string,
    features: {
      javascript: boolean
      images: boolean
      webSecurity: boolean
      allowRunningInsecureContent: boolean
    }
  ): Promise<boolean> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      return false
    }

    // 这些设置需要在创建 WebContents 时设置
    // Session 级别的设置有限
    console.log(`Website features set for ${websiteId}:`, features)
    return true
  }

  /**
   * 备份 Session 数据
   * @param websiteId 网站ID
   */
  async backupSessionData(websiteId: string): Promise<{
    cookies: Electron.Cookie[]
    localStorage: Record<string, unknown>
    sessionStorage: Record<string, unknown>
  }> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      throw new Error(`No session found for website ${websiteId}`)
    }

    try {
      const cookies = await sess.cookies.get({})

      // Electron Session API 不直接提供 localStorage/sessionStorage 的获取
      // 这些数据需要在 WebContents 层面通过 executeJavaScript 获取
      // 这里返回空对象作为占位符
      return {
        cookies,
        localStorage: {},
        sessionStorage: {}
      }
    } catch (error) {
      console.error(`Failed to backup session data for website ${websiteId}:`, error)
      throw error
    }
  }

  /**
   * 恢复 Session 数据
   * @param websiteId 网站ID
   * @param backupData 备份数据
   */
  async restoreSessionData(
    websiteId: string,
    backupData: {
      cookies: Electron.Cookie[]
      localStorage: Record<string, unknown>
      sessionStorage: Record<string, unknown>
    }
  ): Promise<number> {
    await this.ensureInitialized()
    const sess = await this.getWebsiteSession(websiteId)
    if (!sess) {
      throw new Error(`No session found for website ${websiteId}`)
    }

    let restoredCount = 0

    // 恢复 Cookie
    if (backupData.cookies) {
      restoredCount += await this.importWebsiteCookies(websiteId, backupData.cookies)
    }

    console.log(`Restored ${restoredCount} items for website ${websiteId}`)
    return restoredCount
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    await this.clearAllSessions()
  }
}

// 导出单例实例
export const sessionIsolationService = new SessionIsolationService()
