import { session } from 'electron'
import type { Website } from '../../shared/types/store'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { HttpProxyAgent } from 'http-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

// 定义代理 Agent 类型
export type ProxyAgent = unknown

/**
 * 代理服务
 * 管理网站的代理设置
 */
class ProxyService {
  private proxyConfigs: Map<string, string> = new Map() // partition -> proxyRules

  /**
   * 为网站设置代理
   * @param website 网站配置
   * @returns 是否设置成功
   */
  setProxyForWebsite(website: Website): boolean {
    if (!website.proxy || !website.partition) {
      return false
    }

    try {
      const proxyRules = this.parseProxyRules(website.proxy)
      if (!proxyRules) {
        console.error(`Invalid proxy rules for website ${website.id}: ${website.proxy}`)
        return false
      }

      const sess = session.fromPartition(website.partition)
      sess.setProxy({ proxyRules })

      this.proxyConfigs.set(website.partition, website.proxy)
      console.log(`Proxy set for website ${website.id}: ${website.proxy}`)
      return true
    } catch (error) {
      console.error(`Failed to set proxy for website ${website.id}:`, error)
      return false
    }
  }

  /**
   * 清除网站的代理设置
   * @param website 网站配置
   * @returns 是否清除成功
   */
  clearProxyForWebsite(website: Website): boolean {
    if (!website.partition) {
      return false
    }

    try {
      const sess = session.fromPartition(website.partition)
      sess.setProxy({ mode: 'direct' })

      this.proxyConfigs.delete(website.partition)
      console.log(`Proxy cleared for website ${website.id}`)
      return true
    } catch (error) {
      console.error(`Failed to clear proxy for website ${website.id}:`, error)
      return false
    }
  }

  /**
   * 为 Session 分区设置代理
   * @param partition Session 分区名称
   * @param proxyRules 代理规则字符串
   * @returns 是否设置成功
   */
  setProxyForPartition(partition: string, proxyRules: string): boolean {
    try {
      const parsedRules = this.parseProxyRules(proxyRules)
      if (!parsedRules) {
        console.error(`Invalid proxy rules for partition ${partition}: ${proxyRules}`)
        return false
      }

      const sess = session.fromPartition(partition)
      sess.setProxy({ proxyRules: parsedRules })

      this.proxyConfigs.set(partition, proxyRules)
      console.log(`Proxy set for partition ${partition}: ${proxyRules}`)
      return true
    } catch (error) {
      console.error(`Failed to set proxy for partition ${partition}:`, error)
      return false
    }
  }

  /**
   * 清除 Session 分区的代理设置
   * @param partition Session 分区名称
   * @returns 是否清除成功
   */
  clearProxyForPartition(partition: string): boolean {
    try {
      const sess = session.fromPartition(partition)
      sess.setProxy({ mode: 'direct' })

      this.proxyConfigs.delete(partition)
      console.log(`Proxy cleared for partition ${partition}`)
      return true
    } catch (error) {
      console.error(`Failed to clear proxy for partition ${partition}:`, error)
      return false
    }
  }

  /**
   * 解析代理规则字符串
   * @param proxyRules 代理规则字符串
   * @returns 解析后的代理规则或 null
   */
  parseProxyRules(proxyRules: string): string | null {
    if (!proxyRules || typeof proxyRules !== 'string') {
      return null
    }

    // 移除多余空格
    const trimmed = proxyRules.trim()
    if (trimmed.length === 0) {
      return null
    }

    // 验证代理规则格式
    // 支持格式: http=proxy1:8080;https=proxy2:8080;socks=proxy3:1080
    // 或: proxy1:8080 (所有协议使用同一个代理)
    const patterns = [
      /^([a-zA-Z]+)=([^:]+):(\d+)(?:;([a-zA-Z]+)=([^:]+):(\d+))*$/,
      /^([^:]+):(\d+)$/,
      /^socks5:\/\/([^:]+):(\d+)$/,
      /^http:\/\/([^:]+):(\d+)$/,
      /^https:\/\/([^:]+):(\d+)$/
    ]

    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return trimmed
      }
    }

    // 如果格式不匹配，尝试添加默认协议
    if (trimmed.includes(':') && !trimmed.includes('=') && !trimmed.includes('://')) {
      return `http=${trimmed};https=${trimmed}`
    }

    return null
  }

  /**
   * 验证代理规则
   * @param proxyRules 代理规则字符串
   * @returns 验证结果
   */
  validateProxyRules(proxyRules: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!proxyRules || typeof proxyRules !== 'string') {
      errors.push('代理规则必须是字符串')
      return { valid: false, errors }
    }

    if (proxyRules.length > 1000) {
      errors.push('代理规则过长（最大 1000 字符）')
    }

    const parsed = this.parseProxyRules(proxyRules)
    if (!parsed) {
      errors.push('无效的代理规则格式')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取代理配置
   * @param partition Session 分区名称
   */
  getProxyConfig(partition: string): string | null {
    return this.proxyConfigs.get(partition) || null
  }

  /**
   * 获取所有代理配置
   */
  getAllProxyConfigs(): Map<string, string> {
    return new Map(this.proxyConfigs)
  }

  /**
   * 测试代理连接
   * @param proxyRules 代理规则字符串
   * @param testUrl 测试URL（可选）
   * @returns 测试结果
   */
  async testProxyConnection(
    proxyRules: string,
    testUrl: string = 'https://httpbin.org/ip'
  ): Promise<{ success: boolean; latency: number; error?: string }> {
    const parsedRules = this.parseProxyRules(proxyRules)
    if (!parsedRules) {
      return {
        success: false,
        latency: 0,
        error: '无效的代理规则格式'
      }
    }

    const startTime = Date.now()

    return new Promise((resolve) => {
      // 创建临时会话来测试代理
      const tempSession = session.fromPartition(`temp-proxy-test-${Date.now()}`)

      // 设置15秒超时
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          latency: 0,
          error: '请求超时 (15秒)'
        })
        tempSession.setProxy({ mode: 'direct' }).catch(() => {})
      }, 15000)

      tempSession
        .setProxy({ proxyRules: parsedRules })
        .then(async () => {
          try {
            // 使用 net 模块的 request 方法测试连接
            const { net } = await import('electron')
            const request = net.request({
              url: testUrl,
              session: tempSession
            })

            request.on('response', (response) => {
              clearTimeout(timeout)
              if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
                const latency = Date.now() - startTime
                resolve({ success: true, latency })
              } else {
                resolve({
                  success: false,
                  latency: 0,
                  error: `HTTP error! status: ${response.statusCode}`
                })
              }
              // 消费响应数据以释放资源
              response.on('data', () => {})
              response.on('end', () => {
                // 清理临时会话
                tempSession.setProxy({ mode: 'direct' }).catch(() => {})
              })
            })

            request.on('error', (error) => {
              clearTimeout(timeout)
              resolve({
                success: false,
                latency: 0,
                error: error.message || 'Connection failed'
              })
              tempSession.setProxy({ mode: 'direct' }).catch(() => {})
            })

            request.end()
          } catch (error) {
            clearTimeout(timeout)
            resolve({
              success: false,
              latency: 0,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
            tempSession.setProxy({ mode: 'direct' }).catch(() => {})
          }
        })
        .catch((error) => {
          clearTimeout(timeout)
          resolve({
            success: false,
            latency: 0,
            error: error instanceof Error ? error.message : 'Failed to set proxy'
          })
        })
    })
  }

  /**
   * 批量设置网站代理
   * @param websites 网站列表
   * @returns 设置结果统计
   */
  batchSetProxyForWebsites(websites: Website[]): { success: number; failure: number } {
    let successCount = 0
    let failureCount = 0

    for (const website of websites) {
      if (website.proxy && website.partition) {
        const success = this.setProxyForWebsite(website)
        if (success) {
          successCount++
        } else {
          failureCount++
        }
      }
    }

    return { success: successCount, failure: failureCount }
  }

  /**
   * 批量清除网站代理
   * @param websites 网站列表
   * @returns 清除结果统计
   */
  batchClearProxyForWebsites(websites: Website[]): { success: number; failure: number } {
    let successCount = 0
    let failureCount = 0

    for (const website of websites) {
      if (website.partition) {
        const success = this.clearProxyForWebsite(website)
        if (success) {
          successCount++
        } else {
          failureCount++
        }
      }
    }

    return { success: successCount, failure: failureCount }
  }

  /**
   * 获取代理统计
   */
  getProxyStats(): {
    configuredCount: number
    partitionsWithProxy: string[]
  } {
    return {
      configuredCount: this.proxyConfigs.size,
      partitionsWithProxy: Array.from(this.proxyConfigs.keys())
    }
  }

  /**
   * 获取默认代理规则
   */
  getDefaultProxyRules(): string {
    // 返回常见的代理格式示例
    return 'http=proxy.example.com:8080;https=proxy.example.com:8080'
  }

  /**
   * 格式化代理规则用于显示
   * @param proxyRules 代理规则字符串
   */
  formatProxyRulesForDisplay(proxyRules: string): string {
    if (!proxyRules) return '无代理'

    const parsed = this.parseProxyRules(proxyRules)
    if (!parsed) return '无效的代理规则'

    // 简化显示
    if (parsed.includes('=')) {
      // 多协议代理
      const parts = parsed.split(';')
      if (parts.length > 2) {
        return `${parts.length} 个代理协议`
      } else {
        return parsed
      }
    } else {
      // 单协议代理
      return parsed
    }
  }

  /**
   * 检查代理是否可用
   * @param partition Session 分区名称
   */
  isProxyEnabled(partition: string): boolean {
    return this.proxyConfigs.has(partition)
  }

  /**
   * 获取全局代理设置
   * @returns 全局代理规则或 null
   */
  getGlobalProxy(): string | null {
    // 从设置中获取全局代理配置
    // 这里需要导入 storeService，为了避免循环依赖，我们通过参数传入
    return null // 将在具体使用时从设置中获取
  }

  /**
   * 创建代理 Agent
   * @param proxyRules 代理规则
   * @returns 代理 Agent 实例
   */
  createProxyAgent(proxyRules: string): ProxyAgent | null {
    const parsed = this.parseProxyRules(proxyRules)
    if (!parsed) return null

    // 解析代理规则
    if (parsed.includes('socks5://')) {
      return new SocksProxyAgent(parsed)
    }

    // HTTP/HTTPS 代理
    const httpsMatch = parsed.match(/https=([^:;]+):(\d+)/)
    const httpMatch = parsed.match(/http=([^:;]+):(\d+)/)

    if (httpsMatch) {
      return new HttpsProxyAgent(`https://${httpsMatch[1]}:${httpsMatch[2]}`)
    }
    if (httpMatch) {
      return new HttpProxyAgent(`http://${httpMatch[1]}:${httpMatch[2]}`)
    }

    // 默认格式
    const defaultMatch = parsed.match(/([^:]+):(\d+)/)
    if (defaultMatch) {
      return new HttpsProxyAgent(`http://${defaultMatch[1]}:${defaultMatch[2]}`)
    }

    return null
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.proxyConfigs.clear()
  }
}

// 导出单例实例 - 网站级别代理服务
export const websiteProxyService = new ProxyService()
