import { dialog, session, app } from 'electron'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import type { Website, Shortcut, Settings } from '../../shared/types/store'

/**
 * 数据同步服务
 * 处理配置和 Cookie 数据的导出/导入
 */
class DataSyncService {
  private readonly ALLOWED_PROPS = [
    // 网站相关属性
    'url',
    'name',
    'icon',
    'favicon',
    'description',
    'order',
    'jsCode',
    'proxy',
    'isOpen',
    'id',
    'primaryGroupId',
    'secondaryGroupId',
    'children',

    // 设置相关属性
    'theme',
    'language',
    'autoCheckUpdates',
    'minimizeToTray',
    'collapsedSidebarMode',
    'fingerprintEnabled',
    'fingerprintMode',
    'shortcutsEnabled',
    'shortcutAlwaysOnTop',
    'shortcutMiniMode',
    'trayEnabled',
    'trayShowNotifications',
    'windowAlwaysOnTop',
    'windowMiniMode',
    'windowAdsorptionEnabled',
    'windowAdsorptionSensitivity',
    'memoryOptimizerEnabled',
    'memoryCleanInterval',
    'maxInactiveTime',
    'autoSyncEnabled',
    'syncInterval',
    'autoLaunchEnabled',
    'proxyEnabled',
    'proxyRules',
    'autoCheckUpdates',
    'updateCheckInterval',
    'sessionIsolationEnabled',
    'crashReportingEnabled',
    'autoRestartOnCrash',
    'enableJavaScript',
    'allowPopups',
    'saveSession',
    'clearCacheOnExit',
    'enableExtensions',
    'autoLoadExtensions',
    'showDebugOptions'
  ]

  /**
   * 导出配置数据到文件
   * @param data 要导出的数据
   * @returns 是否导出成功
   */
  async exportConfig(data: Record<string, unknown>): Promise<boolean> {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '导出配置',
        defaultPath: path.join(app.getPath('downloads'), 'pager-config.json'),
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })

      if (canceled || !filePath) return false

      // 过滤数据，只保留允许的属性
      const filteredData = this.filterData(data)

      await fs.writeFile(filePath, JSON.stringify(filteredData, null, 2), 'utf-8')
      console.log(`Configuration exported to: ${filePath}`)
      return true
    } catch (error) {
      console.error('Failed to export configuration:', error)
      return false
    }
  }

  /**
   * 导出所有数据到 JSON 字符串
   * @param data 要导出的数据
   * @returns 导出的 JSON 字符串
   */
  exportDataToString(data: Record<string, unknown>): string {
    // 不进行数据过滤，直接返回所有数据
    return JSON.stringify(data, null, 2)
  }

  /**
   * 从文件导入配置数据
   * @returns 导入的数据或 null
   */
  async importConfig(): Promise<Record<string, unknown> | null> {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '导入配置',
        properties: ['openFile'],
        filters: [
          { name: 'JSON 文件', extensions: ['json'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })

      if (canceled || filePaths.length === 0) return null

      const filePath = filePaths[0]
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(fileContent)

      // 验证数据格式
      if (!this.validateImportData(data)) {
        throw new Error('无效的配置文件格式')
      }

      console.log(`Configuration imported from: ${filePath}`)
      return data
    } catch (error) {
      console.error('Failed to import configuration:', error)
      throw error
    }
  }

  /**
   * 导出网站 Cookie
   * @param websiteId 网站ID
   * @param partition Session 分区名称
   * @returns Cookie 数据或 null
   */
  async exportCookies(
    websiteId: string,
    partition: string
  ): Promise<Record<string, unknown>[] | null> {
    try {
      const partitionSession = session.fromPartition(partition)
      const cookies = await partitionSession.cookies.get({})

      if (cookies.length === 0) return null

      // 过滤敏感信息
      const filteredCookies = cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
      }))

      return filteredCookies
    } catch (error) {
      console.error(`Failed to export cookies for website ${websiteId}:`, error)
      return null
    }
  }

  /**
   * 导入网站 Cookie
   * @param websiteId 网站ID
   * @param partition Session 分区名称
   * @param cookies Cookie 数据
   * @returns 是否导入成功
   */
  async importCookies(
    websiteId: string,
    partition: string,
    cookies: Record<string, unknown>[]
  ): Promise<boolean> {
    try {
      const partitionSession = session.fromPartition(partition)

      const setCookiePromises = cookies.map(async (cookie) => {
        const cookieDetails: Electron.CookiesSetDetails = {
          url: `https://${String(cookie.domain)}${String(cookie.path)}`,
          name: String(cookie.name),
          value: String(cookie.value),
          domain: String(cookie.domain),
          path: String(cookie.path),
          secure: cookie.secure as boolean | undefined,
          httpOnly: cookie.httpOnly as boolean | undefined,
          sameSite: cookie.sameSite as
            | 'unspecified'
            | 'no_restriction'
            | 'lax'
            | 'strict'
            | undefined,
          expirationDate: cookie.expirationDate as number | undefined
        }

        // 移除 undefined 值
        Object.keys(cookieDetails).forEach(
          (key) => cookieDetails[key] === undefined && delete cookieDetails[key]
        )

        return partitionSession.cookies.set(cookieDetails)
      })

      await Promise.all(setCookiePromises)
      console.log(`Cookies imported for website ${websiteId}`)
      return true
    } catch (error) {
      console.error(`Failed to import cookies for website ${websiteId}:`, error)
      return false
    }
  }

  /**
   * 备份所有数据
   * @param websites 网站数据
   * @param shortcuts 快捷键数据
   * @param settings 设置数据
   * @returns 备份文件路径或 null
   */
  async backupAllData(
    websites: Website[],
    shortcuts: Shortcut[],
    settings: Settings
  ): Promise<string | null> {
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          websites: this.filterWebsites(websites),
          shortcuts,
          settings
        }
      }

      const backupDir = path.join(app.getPath('userData'), 'backups')
      await fs.mkdir(backupDir, { recursive: true })

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `pager-backup-${timestamp}.json`)

      await fs.writeFile(backupPath, JSON.stringify(backupData, null, 2), 'utf-8')
      console.log(`Backup created at: ${backupPath}`)
      return backupPath
    } catch (error) {
      console.error('Failed to create backup:', error)
      return null
    }
  }

  /**
   * 恢复备份数据
   * @param backupPath 备份文件路径
   * @returns 恢复的数据或 null
   */
  async restoreBackup(backupPath: string): Promise<Record<string, unknown> | null> {
    try {
      const fileContent = await fs.readFile(backupPath, 'utf-8')
      const backupData = JSON.parse(fileContent)

      // 验证备份数据格式
      if (!backupData.version || !backupData.data) {
        throw new Error('无效的备份文件格式')
      }

      console.log(`Backup restored from: ${backupPath}`)
      return backupData.data
    } catch (error) {
      console.error('Failed to restore backup:', error)
      throw error
    }
  }

  /**
   * 获取备份列表
   * @returns 备份文件列表
   */
  async getBackupList(): Promise<string[]> {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups')

      // 确保备份目录存在
      if (!fsSync.existsSync(backupDir)) {
        return []
      }

      const files = await fs.readdir(backupDir)
      const backupFiles = files
        .filter((file) => file.endsWith('.json') && file.startsWith('pager-backup-'))
        .map((file) => path.join(backupDir, file))
        .sort()
        .reverse() // 最新的备份在前

      return backupFiles
    } catch (error) {
      console.error('Failed to get backup list:', error)
      return []
    }
  }

  /**
   * 删除旧备份
   * @param maxBackups 最大备份数量
   * @returns 删除的备份数量
   */
  async cleanupOldBackups(maxBackups: number = 10): Promise<number> {
    try {
      const backupFiles = await this.getBackupList()

      if (backupFiles.length <= maxBackups) {
        return 0
      }

      const filesToDelete = backupFiles.slice(maxBackups)
      let deletedCount = 0

      for (const file of filesToDelete) {
        try {
          await fs.unlink(file)
          deletedCount++
          console.log(`Deleted old backup: ${file}`)
        } catch (error) {
          console.error(`Failed to delete backup ${file}:`, error)
        }
      }

      return deletedCount
    } catch (error) {
      console.error('Failed to cleanup old backups:', error)
      return 0
    }
  }

  /**
   * 过滤数据，只保留允许的属性
   */
  private filterData(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map((item) => this.filterObjectProperties(item))
    } else if (typeof data === 'object' && data !== null) {
      return this.filterObjectProperties(data as Record<string, unknown>)
    }
    return data
  }

  /**
   * 过滤对象属性
   */
  private filterObjectProperties(obj: unknown): Record<string, unknown> {
    if (typeof obj !== 'object' || obj === null) return {}

    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).filter(([key]) =>
        this.ALLOWED_PROPS.includes(key)
      )
    )
  }

  /**
   * 过滤网站数据
   */
  private filterWebsites(websites: Website[]): Record<string, unknown>[] {
    return websites.map((website) => ({
      id: website.id,
      name: website.name,
      url: website.url,
      icon: website.icon,
      favicon: website.favicon,
      description: website.description,
      order: website.order,
      jsCode: website.jsCode,
      proxy: website.proxy,
      isOpen: website.isOpen
    }))
  }

  /**
   * 验证导入数据格式
   */
  private validateImportData(data: unknown): boolean {
    if (!data) return false

    const dataObj = data as Record<string, unknown>

    // 检查是否是数组或对象
    if (Array.isArray(data)) {
      // 数组格式：每个元素应该有 url 和 name
      return data.every(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item as Record<string, unknown>).url &&
          typeof (item as Record<string, unknown>).url === 'string' &&
          (item as Record<string, unknown>).name &&
          typeof (item as Record<string, unknown>).name === 'string'
      )
    } else if (typeof data === 'object') {
      // 对象格式：应该有 websites 数组
      return (
        Array.isArray(dataObj.websites) ||
        Array.isArray(dataObj.shortcuts) ||
        dataObj.settings !== undefined
      )
    }

    return false
  }

  /**
   * 获取数据统计
   */
  getDataStats(data: unknown): {
    websiteCount: number
    shortcutCount: number
    hasSettings: boolean
    hasCookies: boolean
  } {
    const dataObj = data as Record<string, unknown>
    return {
      websiteCount: Array.isArray(dataObj.websites)
        ? dataObj.websites.length
        : Array.isArray(data)
          ? data.length
          : 0,
      shortcutCount: Array.isArray(dataObj.shortcuts) ? dataObj.shortcuts.length : 0,
      hasSettings: dataObj.settings !== undefined,
      hasCookies: dataObj.cookies !== undefined
    }
  }
}

// 导出单例实例
export const dataSyncService = new DataSyncService()
