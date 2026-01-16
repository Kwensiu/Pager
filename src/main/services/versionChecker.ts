import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import { globalProxyService } from './proxyService'

/**
 * 版本检查服务
 * 检查应用更新和版本信息
 */
class VersionChecker {
  private updateAvailable: boolean = false
  private latestVersion: string = ''
  private releaseNotes: string = ''
  private lastCheckTime: number = 0
  private checkInterval: number = 24 * 60 * 60 * 1000 // 24小时

  constructor() {
    // 延迟初始化，不在构造函数中访问 app
    setTimeout(() => {
      this.configureAutoUpdater()
    }, -1)
  }

  /**
   * 配置自动更新器
   */
  private configureAutoUpdater(): void {
    // 确保 app 已准备就绪
    if (!app || !app.getVersion) {
      console.warn('App not ready, skipping auto updater configuration')
      return
    }

    try {
      // 配置代理设置
      const globalProxy = this.getGlobalProxySettings()
      if (globalProxy) {
        // electron-updater 支持通过环境变量设置代理
        if (globalProxy.includes('https://')) {
          process.env.HTTPS_PROXY = globalProxy
          process.env.HTTP_PROXY = globalProxy
        } else {
          process.env.HTTP_PROXY = globalProxy
          process.env.HTTPS_PROXY = globalProxy
        }
        console.log('Auto updater proxy configured:', globalProxy)
      }

      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = true

      // 监听更新事件
      autoUpdater.on('checking-for-update', () => {
        console.log('Checking for updates...')
      })

      autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version)
        this.updateAvailable = true
        this.latestVersion = info.version
        this.releaseNotes =
          typeof info.releaseNotes === 'string'
            ? info.releaseNotes
            : Array.isArray(info.releaseNotes)
              ? info.releaseNotes.map((note) => note.note).join('\n')
              : ''
      })

      autoUpdater.on('update-not-available', () => {
        console.log('No updates available')
        this.updateAvailable = false
      })

      autoUpdater.on('error', (error) => {
        console.error('Update error:', error)
      })

      autoUpdater.on('download-progress', (progressObj) => {
        console.log(`Download progress: ${progressObj.percent}%`)
      })

      autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version)
      })
    } catch (error) {
      console.error('Failed to configure auto updater:', error)
    }
  }

  /**
   * 检查应用更新
   * @param force 是否强制检查
   */
  async checkForAppUpdate(force: boolean = false): Promise<{
    available: boolean
    currentVersion: string
    latestVersion?: string
    releaseNotes?: string
    error?: string
  }> {
    const now = Date.now()

    // 如果不是强制检查且最近检查过，跳过
    if (!force && now - this.lastCheckTime < this.checkInterval) {
      return {
        available: this.updateAvailable,
        currentVersion: app.getVersion?.() || '0.0.0',
        latestVersion: this.latestVersion,
        releaseNotes: this.releaseNotes
      }
    }

    try {
      this.lastCheckTime = now

      // 使用 GitHub API 检查更新（开发环境也工作）
      console.log('开始检查GitHub更新...')
      const githubRelease = await this.checkGitHubReleases()
      console.log('GitHub发布信息:', githubRelease)

      if (githubRelease) {
        const currentVersion = app.getVersion?.() || '0.0.0'
        const latestVersion = githubRelease.tag_name.startsWith('v')
          ? githubRelease.tag_name.slice(1)
          : githubRelease.tag_name

        console.log('当前版本:', currentVersion)
        console.log('最新版本:', latestVersion)

        // 比较版本号
        const isNewer = this.compareVersions(latestVersion, currentVersion) > 0
        console.log('版本比较结果:', isNewer, '(>0表示有更新)')

        this.updateAvailable = isNewer
        this.latestVersion = latestVersion
        this.releaseNotes = githubRelease.body

        return {
          available: isNewer,
          currentVersion,
          latestVersion,
          releaseNotes: githubRelease.body
        }
      }

      // GitHub API 失败时的处理
      console.log('GitHub API检查失败，使用备用检查机制')
      const currentVersion = app.getVersion?.() || '0.0.0'

      // 备用：硬编码已知最新版本（临时解决方案）
      const knownLatestVersion = '0.0.3'
      const isNewer = this.compareVersions(knownLatestVersion, currentVersion) > 0

      if (isNewer) {
        console.log('使用备用机制检测到更新:', knownLatestVersion, '>', currentVersion)
        return {
          available: true,
          currentVersion,
          latestVersion: knownLatestVersion,
          releaseNotes: 'GitHub API检查失败，但已知有新版本可用。请访问 GitHub 页面下载最新版本。'
        }
      } else {
        console.log('备用机制：当前版本已是最新或无法确定')
        return {
          available: false,
          currentVersion,
          latestVersion: knownLatestVersion,
          error: '无法连接到GitHub API，请检查网络连接'
        }
      }
    } catch (error) {
      console.error('检查更新失败:', error)
      return {
        available: false,
        currentVersion: app.getVersion?.() || '0.0.0',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 下载更新
   */
  async downloadUpdate(): Promise<{ success: boolean; error?: string }> {
    if (!this.updateAvailable) {
      return { success: false, error: 'No update available' }
    }

    try {
      await autoUpdater.downloadUpdate()
      return { success: true }
    } catch (error) {
      console.error('Failed to download update:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 安装更新
   */
  installUpdate(): { success: boolean; error?: string } {
    if (!this.updateAvailable) {
      return { success: false, error: 'No update available' }
    }

    try {
      autoUpdater.quitAndInstall()
      return { success: true }
    } catch (error) {
      console.error('Failed to install update:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 获取版本信息
   */
  getVersionInfo(): {
    appVersion: string
    electronVersion: string
    chromeVersion: string
    nodeVersion: string
    platform: string
    arch: string
  } {
    try {
      const appVersion = app.getVersion?.() || '0.0.0'
      return {
        appVersion,
        electronVersion: process.versions.electron || 'unknown',
        chromeVersion: process.versions.chrome || 'unknown',
        nodeVersion: process.versions.node || 'unknown',
        platform: process.platform || 'unknown',
        arch: process.arch || 'unknown'
      }
    } catch (error) {
      console.error('Failed to get version info:', error)
      return {
        appVersion: '0.0.0',
        electronVersion: 'unknown',
        chromeVersion: 'unknown',
        nodeVersion: 'unknown',
        platform: 'unknown',
        arch: 'unknown'
      }
    }
  }

  /**
   * 检查依赖包更新
   */
  async checkDependencyUpdates(): Promise<
    Array<{
      name: string
      current: string
      latest?: string
      outdated: boolean
      error?: string
    }>
  > {
    try {
      // 读取 package.json
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const packageJsonPath = join(__dirname, '../../../package.json')
      const packageJsonContent = await readFile(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(packageJsonContent)
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      }

      const results: Array<{
        name: string
        current: string
        latest?: string
        outdated: boolean
        error?: string
      }> = []

      // 检查每个依赖的更新（简化版，实际应该调用 npm registry API）
      for (const [name, version] of Object.entries(dependencies)) {
        try {
          // 这里应该调用 npm registry API 获取最新版本
          // 暂时标记为不需要更新
          results.push({
            name,
            current: version as string,
            latest: version as string,
            outdated: false
          })
        } catch (error) {
          results.push({
            name,
            current: version as string,
            outdated: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      return results
    } catch (error) {
      console.error('Failed to check dependency updates:', error)
      return []
    }
  }

  /**
   * 获取更新统计
   */
  getUpdateStats(): {
    lastCheck: number
    updateAvailable: boolean
    checkCount: number
    autoUpdateEnabled: boolean
  } {
    return {
      lastCheck: this.lastCheckTime,
      updateAvailable: this.updateAvailable,
      checkCount: 0, // 可以添加计数逻辑
      autoUpdateEnabled: autoUpdater.autoInstallOnAppQuit
    }
  }

  /**
   * 设置检查间隔
   * @param interval 间隔时间（毫秒）
   */
  setCheckInterval(interval: number): void {
    this.checkInterval = interval
    console.log(`Update check interval set to ${interval}ms`)
  }

  /**
   * 启用/禁用自动更新
   * @param enabled 是否启用
   */
  setAutoUpdate(enabled: boolean): void {
    autoUpdater.autoInstallOnAppQuit = enabled
    console.log(`Auto update ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * 手动检查 GitHub 发布
   */
  async checkGitHubReleases(): Promise<{
    tag_name: string
    name: string
    body: string
    published_at: string
    html_url: string
  } | null> {
    try {
      // 获取软件专用session
      const softwareSession = globalProxyService.getSoftwareSession()

      const fetchOptions: RequestInit = {
        method: 'GET',
        headers: {
          'User-Agent': 'Pager-App/1.0',
          Accept: 'application/vnd.github.v3+json'
        }
      }

      // 使用软件专用session进行fetch
      const response = await softwareSession.fetch(
        'https://api.github.com/repos/Kwensiu/pager/releases/latest',
        fetchOptions as Record<string, unknown>
      )

      console.log('GitHub API响应状态:', response.status, response.statusText)
      console.log('GitHub API响应头:', Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub API错误响应:', errorText)
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
      console.log('GitHub API响应数据:', data)
      return data
    } catch (error) {
      console.error('检查GitHub发布失败:', error)

      // 检查是否是网络问题
      if (error instanceof Error) {
        if (error.message.includes('fetch') || error.message.includes('network')) {
          console.error('网络连接问题，请检查网络设置')
        } else if (error.message.includes('CORS')) {
          console.error('CORS问题，这不应该发生')
        } else if (error.message.includes('timeout')) {
          console.error('请求超时，请重试')
        }
      }

      return null
    }
  }

  /**
   * 获取全局代理设置
   * @returns 代理规则或 null
   */
  private getGlobalProxySettings(): string | null {
    // 尝试从多个来源获取代理设置
    // 1. 从环境变量获取
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy

    if (httpsProxy) return httpsProxy
    if (httpProxy) return httpProxy

    // 2. 从设置中获取（需要导入 storeService，这里暂时返回 null）
    // TODO: 实现从设置中获取代理配置

    return null
  }

  /**
   * 比较版本号
   * @param v1 版本1
   * @param v2 版本2
   */
  compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0

      if (part1 > part2) return 1
      if (part1 < part2) return -1
    }

    return 0
  }

  /**
   * 验证版本号格式
   * @param version 版本号
   */
  validateVersion(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version)
  }

  /**
   * 获取版本历史
   */
  getVersionHistory(): Array<{
    version: string
    date: string
    changes: string[]
  }> {
    // 这里可以返回版本历史
    return [
      {
        version: app.getVersion(),
        date: new Date().toISOString().split('T')[0],
        changes: ['Initial release']
      }
    ]
  }

  /**
   * 显示更新通知
   */
  showUpdateNotification(): void {
    if (!this.updateAvailable) return

    // 这里可以显示系统通知
    console.log(`Update available: ${this.latestVersion}`)

    // 实际应用中应该显示系统通知
    // new Notification({
    //   title: 'Update Available',
    //   body: `Version ${this.latestVersion} is available`
    // }).show()
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    autoUpdater.removeAllListeners()
  }
}

// 导出单例实例
export const versionChecker = new VersionChecker()
