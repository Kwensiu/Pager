import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import { globalProxyService } from './proxyService'

/**
 * 版本检查服务
 * 检查应用更新和版本信息
 */
class VersionChecker {
  private updateAvailable: boolean = false
  private lastCheckTime: number = 0
  private isDevelopment: boolean = false

  constructor() {
    // 检查是否为开发环境
    this.isDevelopment = !app.isPackaged

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
      }

      // 设置更新缓存目录为安装目录下的 updater 子目录
      // 注意：electron-updater 的缓存目录基于 userData，无法直接设置
      // 通过设置 userData 到安装目录，已间接改变缓存位置

      autoUpdater.autoDownload = false
      autoUpdater.autoInstallOnAppQuit = true

      // 监听更新事件
      autoUpdater.on('checking-for-update', () => {})

      autoUpdater.on('update-available', (_info) => {
        this.updateAvailable = true
        // Note: latestVersion and releaseNotes are handled in checkForAppUpdate
      })

      autoUpdater.on('update-not-available', () => {
        this.updateAvailable = false
      })

      autoUpdater.on('error', (error) => {
        console.error('Update error:', error)
      })

      autoUpdater.on('download-progress', (_progressObj) => {})

      autoUpdater.on('update-downloaded', (_info) => {})
    } catch (error) {
      console.error('Failed to configure auto updater:', error)
    }
  }

  /**
   * 检查应用更新
   * @param force 是否强制检查
   */
  async checkForAppUpdate(_force: boolean = false): Promise<{
    available: boolean
    currentVersion: string
    latestVersion?: string
    releaseNotes?: string
    error?: string
  }> {
    const now = Date.now()

    try {
      this.lastCheckTime = now

      // 使用 GitHub API 检查更新（开发环境也工作）
      const githubRelease = await this.checkGitHubReleases()

      if (githubRelease) {
        const currentVersion = app.getVersion?.() || '0.0.0'
        const latestVersion = githubRelease.tag_name.startsWith('v')
          ? githubRelease.tag_name.slice(1)
          : githubRelease.tag_name

        // 比较版本号
        const isNewer = this.compareVersions(latestVersion, currentVersion) > 0

        this.updateAvailable = isNewer

        return {
          available: isNewer,
          currentVersion,
          latestVersion,
          releaseNotes: githubRelease.body
        }
      }

      // GitHub API 失败时的处理
      const currentVersion = app.getVersion?.() || '0.0.0'

      // 备用：硬编码已知最新版本（临时解决方案）
      const knownLatestVersion = 'error'
      const isNewer = this.compareVersions(knownLatestVersion, currentVersion) > 0

      if (isNewer) {
        return {
          available: true,
          currentVersion,
          latestVersion: knownLatestVersion,
          releaseNotes: 'GitHub API检查失败，但已知有新版本可用。请访问 GitHub 页面下载最新版本。'
        }
      } else {
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

    // 开发环境不支持自动更新
    if (this.isDevelopment) {
      return {
        success: false,
        error: '开发环境不支持自动更新，请访问 GitHub 下载最新版本'
      }
    }

    try {
      // 先调用 checkForUpdates 来初始化更新器并获取更新信息
      const updateCheckResult = await autoUpdater.checkForUpdates()

      if (!updateCheckResult || !updateCheckResult.downloadPromise) {
        return { success: false, error: '无法获取更新信息' }
      }

      // 等待下载完成
      await updateCheckResult.downloadPromise
      return { success: true }
    } catch (error) {
      console.error('Failed to download update:', error)
      const errMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errMsg.includes('ENOENT') && errMsg.includes('app-update.yml')) {
        return {
          success: false,
          error: '当前版本未配置自动更新，请前往 GitHub 手动下载最新版本'
        }
      }
      return {
        success: false,
        error: errMsg
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
   * 启用/禁用自动更新
   * @param enabled 是否启用
   */
  setAutoUpdate(enabled: boolean): void {
    autoUpdater.autoInstallOnAppQuit = enabled
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

      if (!response.ok) {
        const errorText = await response.text()
        console.error('GitHub API错误响应:', errorText)
        throw new Error(`GitHub API error: ${response.status} - ${response.statusText}`)
      }

      const data = await response.json()
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
