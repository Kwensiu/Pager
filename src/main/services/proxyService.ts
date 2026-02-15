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

  // 当前代理设置，用于查询
  private currentProxySettings: { mode: string; proxyRules?: string; proxyBypassRules?: string } = { mode: 'direct' }

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

    console.log('更新代理配置:', {
      proxyEnabled: settings.proxyEnabled,
      proxyRules: settings.proxyRules,
      proxySoftwareOnly: settings.proxySoftwareOnly
    })

    if (!settings.proxyEnabled) {
      // 禁用代理时，清除所有 session 的代理设置
      await defaultSession.setProxy({ mode: 'direct' })
      await softwareSession.setProxy({ mode: 'direct' })
      this.currentProxySettings = { mode: 'direct' }
      console.log('代理已禁用，所有session设置为direct')
      return
    }

    if (!settings.proxyRules) {
      // 没有代理规则时，清除所有 session 的代理设置
      await defaultSession.setProxy({ mode: 'direct' })
      await softwareSession.setProxy({ mode: 'direct' })
      this.currentProxySettings = { mode: 'direct' }
      console.log('无代理规则，所有session设置为direct')
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
      this.currentProxySettings = { mode: 'direct' } // 网页内容不使用代理
      console.log('代理模式: 仅软件本体，代理规则:', settings.proxyRules)
    } else {
      // 代理所有内容模式
      // 对默认 session 设置代理（影响网页内容）
      await defaultSession.setProxy({
        proxyRules: settings.proxyRules,
        proxyBypassRules: '<local>'
      })
      // 软件本体也使用默认 session 的代理
      await softwareSession.setProxy({ mode: 'direct' })
      this.currentProxySettings = {
        mode: 'fixed_servers',
        proxyRules: settings.proxyRules,
        proxyBypassRules: '<local>'
      }
      console.log('代理模式: 所有内容，代理规则:', settings.proxyRules)
    }
  }

  /**
   * 获取当前代理设置
   */
  getCurrentProxySettings(): { mode: string; proxyRules?: string; proxyBypassRules?: string } {
    return { ...this.currentProxySettings }
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

    try {
      const directIP = await this.getDirectIP()
      const proxyIP = await this.getProxyIP(proxyRules)

      // 简单的比较逻辑
      if (directIP && proxyIP && directIP !== proxyIP) {
        return { success: true, latency: Date.now() - startTime }
      } else {
        return { success: false, error: '代理无效', latency: Date.now() - startTime }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '测试失败',
        latency: Date.now() - startTime
      }
    }
  }

  // 获取直接连接的IP
  private async getDirectIP(): Promise<string | null> {
    const testSession = session.fromPartition(`direct-${Date.now()}`)
    
    try {
      await testSession.setProxy({ mode: 'direct' })
      return await this.getIP(testSession)
    } finally {
      this.cleanupSession(testSession)
    }
  }

  // 获取通过代理的IP
  private async getProxyIP(proxyRules: string): Promise<string | null> {
    const testSession = session.fromPartition(`proxy-${Date.now()}`)
    
    try {
      await testSession.setProxy({ proxyRules })
      return await this.getIP(testSession)
    } finally {
      this.cleanupSession(testSession)
    }
  }

  // 获取当前IP地址
  private async getIP(testSession: Session): Promise<string | null> {
    return new Promise((resolve) => {
      const request = net.request({
        url: 'https://httpbin.org/ip',
        session: testSession
      })

      const timeout = setTimeout(() => {
        request.abort()
        resolve(null)
      }, 10000)

      request.on('response', (response) => {
        clearTimeout(timeout)
        let data = ''
        response.on('data', (chunk) => data += chunk)
        response.on('end', () => {
          try {
            const json = JSON.parse(data)
            resolve(json.origin || null)
          } catch {
            resolve(null)
          }
        })
      })

      request.on('error', () => {
        clearTimeout(timeout)
        resolve(null)
      })

      request.end()
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
