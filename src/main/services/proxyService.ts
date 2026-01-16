import { session, net, Session } from 'electron'
import { Settings } from '../../shared/types/store'

/**
 * 全局代理服务
 * 管理应用级别的代理设置（proxySoftwareOnly 功能）
 */
class GlobalProxyService {
  private isInitialized = false

  private lastSettings: Partial<Settings> | null = null
  private checkInterval: NodeJS.Timeout | null = null

  // 软件本体专用的 session 分区
  private readonly SOFTWARE_SESSION_PARTITION = 'persist:software-session'

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // 动态导入storeService以避免循环依赖
    const { storeService } = await import('./store')

    // 使用轮询监听设置变化
    this.checkInterval = setInterval(async () => {
      const currentSettings = await storeService.getSettings()

      // 检查相关设置是否发生变化
      if (
        !this.lastSettings ||
        currentSettings.proxyEnabled !== this.lastSettings.proxyEnabled ||
        currentSettings.proxyRules !== this.lastSettings.proxyRules ||
        currentSettings.proxySoftwareOnly !== this.lastSettings.proxySoftwareOnly
      ) {
        this.lastSettings = { ...currentSettings }
        await this.updateProxyConfig()
      }
    }, 1000) // 每秒检查一次

    // 初始配置
    this.lastSettings = await storeService.getSettings()
    await this.updateProxyConfig()
    this.isInitialized = true
  }

  // 清理资源
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isInitialized = false
  }

  private async updateProxyConfig(): Promise<void> {
    // 动态导入storeService以避免循环依赖
    const { storeService } = await import('./store')
    const settings = await storeService.getSettings()
    const defaultSession = session.defaultSession
    const softwareSession = session.fromPartition(this.SOFTWARE_SESSION_PARTITION)

    if (!settings.proxyEnabled) {
      // 禁用代理时，清除所有 session 的代理设置
      await defaultSession.setProxy({ mode: 'direct' })
      await softwareSession.setProxy({ mode: 'direct' })
      return
    }

    if (!settings.proxyRules) {
      // 没有代理规则时，清除所有 session 的代理设置
      await defaultSession.setProxy({ mode: 'direct' })
      await softwareSession.setProxy({ mode: 'direct' })
      return
    }

    // 仅代理软件本体模式
    if (settings.proxySoftwareOnly) {
      // 只对软件本体 session 设置代理
      await softwareSession.setProxy({
        proxyRules: settings.proxyRules,
        proxyBypassRules: '<local>'
      })
      // 网页内容使用默认 session，不设置代理
      await defaultSession.setProxy({ mode: 'direct' })
    } else {
      // 代理所有内容模式
      // 对默认 session 设置代理（影响网页内容）
      await defaultSession.setProxy({
        proxyRules: settings.proxyRules,
        proxyBypassRules: '<local>'
      })
      // 软件本体也使用默认 session 的代理
      await softwareSession.setProxy({ mode: 'direct' })
    }
  }

  /**
   * 获取软件本体专用的 session
   * 用于软件自身的网络请求（如更新检查）
   */
  getSoftwareSession(): Session {
    return session.fromPartition(this.SOFTWARE_SESSION_PARTITION)
  }

  // 测试代理连接
  async testConnection(
    proxyRules: string
  ): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now()

    return new Promise((resolve) => {
      // 创建一个临时会话来测试代理
      const testSession = session.fromPartition(`temp-${Date.now()}`)

      testSession
        .setProxy({ proxyRules })
        .then(async () => {
          try {
            // 使用 net 模块的 request 方法测试连接
            const request = net.request({
              url: 'https://httpbin.org/ip',
              session: testSession
            })

            request.on('response', (response) => {
              if (response.statusCode >= 200 && response.statusCode < 300) {
                const latency = Date.now() - startTime
                resolve({ success: true, latency })
              } else {
                resolve({
                  success: false,
                  error: `HTTP error! status: ${response.statusCode}`
                })
              }
              // 消费响应数据以释放资源
              response.on('data', () => {})
              response.on('end', () => {
                // 清理临时会话
                this.cleanupSession(testSession)
              })
            })

            request.on('error', (error) => {
              resolve({
                success: false,
                error: error.message || 'Connection failed'
              })
              this.cleanupSession(testSession)
            })

            request.end()
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            this.cleanupSession(testSession)
          }
        })
        .catch((error) => {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to set proxy'
          })
          this.cleanupSession(testSession)
        })
    })
  }

  // 安全地清理临时会话
  private cleanupSession(session: Session): void {
    try {
      // 清除代理设置
      session.setProxy({ mode: 'direct' }).catch(() => {
        /* ignore */
      })
      // 清除存储
      session.clearStorageData().catch(() => {
        /* ignore */
      })
      // 清除缓存
      session.clearCache().catch(() => {
        /* ignore */
      })
    } catch (error) {
      console.error('Error cleaning up session:', error)
    }
  }
}

export const globalProxyService = new GlobalProxyService()
