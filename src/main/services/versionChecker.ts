import { app } from 'electron'
import { globalProxyService } from './proxyService'
import * as fs from 'fs/promises'
import * as path from 'path'
import { spawn } from 'child_process'

/**
 * 版本检查服务
 * 检查应用更新和版本信息
 */
class VersionChecker {
  private updateAvailable: boolean = false
  private lastCheckTime: number = 0
  private isDevelopment: boolean = false
  private checkCount: number = 0
  private downloadedInstallerPath: string | null = null

  constructor() {
    // 检查是否为开发环境
    this.isDevelopment = !app.isPackaged
    console.log(
      `[VersionChecker] 初始化版本检查服务，环境: ${this.isDevelopment ? '开发' : '生产'}`
    )
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
    this.checkCount++
    console.log(
      `[VersionChecker] 开始第 ${this.checkCount} 次检查更新, force=${_force}, 上次检查时间: ${this.lastCheckTime}`
    )

    try {
      this.lastCheckTime = now

      // 获取当前版本
      const currentVersion = app.getVersion?.() || '0.0.0'
      console.log(`[VersionChecker] 当前版本: ${currentVersion}`)

      // 使用 GitHub API 检查更新（开发环境也工作）
      console.log('[VersionChecker] 开始查询 GitHub Releases')
      const githubRelease = await this.checkGitHubReleases()

      if (githubRelease) {
        console.log(
          `[VersionChecker] GitHub API 返回发布信息: tag=${githubRelease.tag_name}, name=${githubRelease.name}`
        )
        const latestVersion = githubRelease.tag_name.startsWith('v')
          ? githubRelease.tag_name.slice(1)
          : githubRelease.tag_name

        console.log(
          `[VersionChecker] 解析版本号: latest=${latestVersion}, current=${currentVersion}`
        )

        // 比较版本号
        const isNewer = this.compareVersions(latestVersion, currentVersion) > 0
        console.log(`[VersionChecker] 版本比较结果: ${isNewer ? '有新版本' : '已是最新'}`)

        this.updateAvailable = isNewer

        const result = {
          available: isNewer,
          currentVersion,
          latestVersion,
          releaseNotes: githubRelease.body
        }
        console.log(`[VersionChecker] 检查更新完成:`, result)
        return result
      }

      // GitHub API 失败时的处理
      console.warn('[VersionChecker] GitHub API 查询失败，使用备用方案')
      const knownLatestVersion = 'error'
      const isNewer = this.compareVersions(knownLatestVersion, currentVersion) > 0

      if (isNewer) {
        console.log('[VersionChecker] 备用方案检测到新版本')
        return {
          available: true,
          currentVersion,
          latestVersion: knownLatestVersion,
          releaseNotes: 'GitHub API检查失败，但已知有新版本可用。请访问 GitHub 页面下载最新版本。'
        }
      } else {
        console.log('[VersionChecker] 备用方案未检测到新版本')
        return {
          available: false,
          currentVersion,
          latestVersion: knownLatestVersion,
          error: '无法连接到GitHub API，请检查网络连接'
        }
      }
    } catch (error) {
      console.error('[VersionChecker] 检查更新失败:', error)
      return {
        available: false,
        currentVersion: app.getVersion?.() || '0.0.0',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * 下载更新（半自动模式）
   */
  async downloadUpdate(): Promise<{ success: boolean; error?: string; progress?: number }> {
    console.log('[VersionChecker] 开始半自动下载更新流程')
    if (!this.updateAvailable) {
      console.warn('[VersionChecker] 下载失败: 没有可用更新')
      return { success: false, error: 'No update available' }
    }

    // 开发环境不支持自动更新
    if (this.isDevelopment) {
      console.warn('[VersionChecker] 开发环境不支持自动更新')
      return {
        success: false,
        error: '开发环境不支持自动更新，请访问 GitHub 下载最新版本'
      }
    }

    try {
      console.log('[VersionChecker] 获取最新发布信息以确定下载链接')
      const githubRelease = await this.checkGitHubReleases()

      if (!githubRelease) {
        return {
          success: false,
          error: '无法获取下载链接，请访问 GitHub Releases 页面手动下载'
        }
      }

      // 从 GitHub Release 中查找 Windows 安装包
      const assets = githubRelease.assets || []
      const windowsAsset = assets.find(
        (asset) => asset.name && (asset.name.endsWith('.exe') || asset.name.includes('Setup'))
      )

      if (!windowsAsset) {
        console.log('[VersionChecker] 未在 Release 中找到 Windows 安装包，引导用户到页面')
        return {
          success: false,
          error: '未找到适合的安装包，请访问 GitHub Releases 页面手动下载'
        }
      }

      const downloadUrl = windowsAsset.browser_download_url
      const fileName = windowsAsset.name
      console.log(`[VersionChecker] 找到安装包: ${fileName}`)
      console.log(`[VersionChecker] 下载链接: ${downloadUrl}`)

      // 准备下载目录（使用用户临时目录）
      const tempDir = path.join(app.getPath('temp'), 'Pager-updates')
      await fs.mkdir(tempDir, { recursive: true })
      const downloadPath = path.join(tempDir, fileName)

      console.log(`[VersionChecker] 开始下载到: ${downloadPath}`)

      // 下载文件
      const softwareSession = globalProxyService.getSoftwareSession()
      const response = await softwareSession.fetch(downloadUrl)

      if (!response.ok) {
        throw new Error(`下载失败: ${response.status} ${response.statusText}`)
      }

      // 获取文件大小
      const contentLength = response.headers.get('content-length')
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0
      console.log(`[VersionChecker] 文件大小: ${totalBytes} bytes`)

      // 写入文件流
      const fileStream = await fs.open(downloadPath, 'w')
      let downloadedBytes = 0

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取下载流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        await fileStream.write(value)
        downloadedBytes += value.length

        // 计算并打印进度
        if (totalBytes > 0) {
          const progress = Math.round((downloadedBytes / totalBytes) * 100)
          if (progress % 10 === 0) {
            // 每10%打印一次
            console.log(
              `[VersionChecker] 下载进度: ${progress}% (${downloadedBytes}/${totalBytes})`
            )
          }
        }
      }

      await fileStream.close()
      console.log('[VersionChecker] 下载完成')

      // 保存下载路径供安装使用
      this.downloadedInstallerPath = downloadPath

      return {
        success: true,
        error: '下载完成，点击"立即安装"按钮开始安装更新'
      }
    } catch (error) {
      console.error('[VersionChecker] 下载失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败，请重试或手动下载'
      }
    }
  }

  /**
   * 安装更新
   */
  installUpdate(): { success: boolean; error?: string } {
    console.log('[VersionChecker] 开始安装更新流程')

    if (!this.updateAvailable) {
      console.warn('[VersionChecker] 安装失败: 没有可用更新')
      return { success: false, error: 'No update available' }
    }

    if (!this.downloadedInstallerPath) {
      console.warn('[VersionChecker] 安装失败: 未找到下载的安装包')
      return { success: false, error: '请先下载更新' }
    }

    try {
      console.log(`[VersionChecker] 启动安装程序: ${this.downloadedInstallerPath}`)

      // 启动安装程序
      // 不使用静默参数，显示安装界面
      const installer = spawn(this.downloadedInstallerPath, [], {
        detached: true,
        stdio: 'ignore'
      })

      // 监听进程启动事件
      installer.on('spawn', () => {
        console.log('[VersionChecker] 安装程序进程已启动')
      })

      // 监听进程错误
      installer.on('error', (err) => {
        console.error('[VersionChecker] 安装程序启动失败:', err)
      })

      // 分离进程，使其独立于父进程运行
      installer.unref()

      console.log('[VersionChecker] 安装程序已启动')
      console.log('[VersionChecker] 安装界面将显示，用户可以看到安装进度')

      return { success: true }
    } catch (error) {
      console.error('[VersionChecker] 安装更新失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '安装失败，请手动运行下载的安装程序'
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
    console.log(
      `[VersionChecker] 获取更新统计: checkCount=${this.checkCount}, lastCheck=${this.lastCheckTime}, updateAvailable=${this.updateAvailable}`
    )
    return {
      lastCheck: this.lastCheckTime,
      updateAvailable: this.updateAvailable,
      checkCount: this.checkCount,
      autoUpdateEnabled: false // 半自动模式不需要自动安装
    }
  }

  /**
   * 启用/禁用自动更新
   * @param enabled 是否启用
   */
  setAutoUpdate(enabled: boolean): void {
    // 半自动模式下不需要此功能
    console.log(`[VersionChecker] setAutoUpdate(${enabled}) - 半自动模式下忽略此设置`)
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
    assets: Array<{
      name: string
      browser_download_url: string
    }>
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
    console.log('[VersionChecker] 清理资源 - 半自动模式无需清理')
    // 半自动模式下不需要清理 autoUpdater 的事件监听器
  }
}

// 导出单例实例
export const versionChecker = new VersionChecker()
