import type { Website } from '../../shared/types/store'
import { webContents as electronWebContents } from 'electron'

// 定义内存信息接口以避免使用 any
interface MemoryInfo {
  workingSetSize?: number
  privateBytes?: number
  residentSet?: number
  private?: number
  shared?: number
}

import { sessionIsolationService } from './sessionIsolation'

/**
 * 内存优化服务
 * 自动清理不活跃的站点，减少内存占用
 */
class MemoryOptimizerService {
  private cleanupTimer: NodeJS.Timeout | null = null
  private gcTimer: NodeJS.Timeout | null = null
  private memoryMonitorTimer: NodeJS.Timeout | null = null

  // 配置对象
  private config = {
    inactiveThreshold: 10 * 60 * 1000, // 10分钟
    cleanupInterval: 5 * 60 * 1000, // 5分钟
    gcInterval: 3 * 60 * 1000, // 3分钟
    memoryMonitorInterval: 2 * 60 * 1000, // 2分钟
    memoryThreshold: 800 * 1024 * 1024 // 800MB
  }

  private optimizationEnabled = true
  private activeWebsites: Map<string, number> = new Map()
  private mainWindow: Electron.BrowserWindow | null = null

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: Electron.BrowserWindow | null): void {
    this.mainWindow = window
  }

  /**
   * 开始内存优化清理
   */
  startCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    if (!this.optimizationEnabled) return

    this.cleanupTimer = setInterval(() => {
      void this.performCleanup()
    }, this.config.cleanupInterval)

    // 启动垃圾回收定时器
    this.startGarbageCollection()

    // 启动内存监控
    this.startMemoryMonitor()

    console.log('Memory optimization cleanup started')
  }

  /**
   * 停止内存优化清理
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.stopGarbageCollection()
    this.stopMemoryMonitor()
    console.log('Memory optimization cleanup stopped')
  }

  /**
   * 启动垃圾回收定时器
   */
  private startGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
    }

    this.gcTimer = setInterval(() => {
      void this.triggerGarbageCollection()
    }, this.config.gcInterval)

    console.log('Garbage collection started')
  }

  /**
   * 停止垃圾回收定时器
   */
  private stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }
  }

  /**
   * 触发垃圾回收
   */
  private async triggerGarbageCollection(): Promise<void> {
    try {
      if (!this.optimizationEnabled) return

      // 尝试触发 V8 垃圾回收
      // 如果在开发模式下，global.gc 可用
      if (global.gc) {
        console.log('Triggering garbage collection...')
        global.gc()
      }

      // 在所有 webContents 中触发垃圾回收
      const webContentsList = this.getAllWebContents()
      for (const wc of webContentsList) {
        try {
          await wc.executeJavaScript(`
            if (window.gc && typeof window.gc === 'function') {
              window.gc();
            }
          `)
        } catch {
          // 忽略错误，可能网站不支持
        }
      }
    } catch (error) {
      console.error('Failed to trigger garbage collection:', error)
    }
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitor(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer)
    }

    this.memoryMonitorTimer = setInterval(() => {
      void this.monitorMemory()
    }, this.config.memoryMonitorInterval)

    console.log('Memory monitoring started')
  }

  /**
   * 停止内存监控
   */
  private stopMemoryMonitor(): void {
    if (this.memoryMonitorTimer) {
      clearInterval(this.memoryMonitorTimer)
      this.memoryMonitorTimer = null
    }
  }

  /**
   * 监控内存使用情况
   */
  private async monitorMemory(): Promise<void> {
    try {
      if (!this.optimizationEnabled) return

      const usage = await process.getProcessMemoryInfo()

      if (usage && (usage as MemoryInfo).workingSetSize! > this.config.memoryThreshold) {
        console.warn(
          `Memory threshold exceeded: ${Math.round((usage as MemoryInfo).workingSetSize! / 1024 / 1024)}MB > ${this.config.memoryThreshold / 1024 / 1024}MB`
        )
        await this.performEmergencyCleanup()
      }
    } catch (error) {
      console.error('Failed to monitor memory:', error)
    }
  }

  /**
   * 执行紧急清理
   */
  private async performEmergencyCleanup(): Promise<void> {
    console.log('Performing emergency cleanup...')

    // 1. 触发垃圾回收
    await this.triggerGarbageCollection()

    // 2. 清理不活跃网站
    const inactiveIds = this.getInactiveWebsiteIds()
    if (inactiveIds.length > 0) {
      console.log(`Emergency cleanup: unloading ${inactiveIds.length} inactive websites`)
      await this.cleanupWebsites(inactiveIds)
    }

    // 3. 通知前端
    this.notifyCleanupComplete(inactiveIds.length, true)
  }

  /**
   * 执行清理操作
   */
  private async performCleanup(): Promise<void> {
    if (!this.optimizationEnabled) return

    const now = Date.now()
    const inactiveWebsiteIds: string[] = []

    // 找出不活跃的网站
    for (const [websiteId, lastAccessTime] of this.activeWebsites.entries()) {
      if (now - lastAccessTime > this.config.inactiveThreshold) {
        inactiveWebsiteIds.push(websiteId)
      }
    }

    if (inactiveWebsiteIds.length > 0) {
      console.log(`Found ${inactiveWebsiteIds.length} inactive websites for cleanup`)
      await this.cleanupWebsites(inactiveWebsiteIds)
      this.notifyCleanupComplete(inactiveWebsiteIds.length, false)
    }
  }

  /**
   * 清理指定网站
   */
  private async cleanupWebsites(websiteIds: string[]): Promise<void> {
    for (const websiteId of websiteIds) {
      try {
        // 1. 清理 Session 缓存
        await sessionIsolationService.clearWebsiteSession(websiteId)

        // 2. 通知前端卸载 WebView
        if (this.mainWindow) {
          this.mainWindow.webContents.send('webview:unload', { websiteId })
        }

        // 3. 从活跃列表移除
        this.removeWebsite(websiteId)

        console.log(`Cleaned up website: ${websiteId}`)
      } catch (error) {
        console.error(`Failed to cleanup website ${websiteId}:`, error)
      }
    }
  }

  /**
   * 获取所有 webContents
   */
  private getAllWebContents(): Electron.WebContents[] {
    try {
      return electronWebContents.getAllWebContents().filter((wc) => !wc.isDestroyed())
    } catch (error) {
      console.warn('Failed to get all webContents:', error)
      return []
    }
  }

  /**
   * 重新启动清理定时器
   */
  private restartCleanup(): void {
    this.stopCleanup()
    this.startCleanup()
  }

  /**
   * 通知前端清理完成
   */
  private notifyCleanupComplete(count: number, isEmergency: boolean): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('memory-optimizer:cleanup-complete', {
        count,
        isEmergency,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 标记网站为活跃
   * @param websiteId 网站ID
   */
  markWebsiteActive(websiteId: string): void {
    this.activeWebsites.set(websiteId, Date.now())
  }

  /**
   * 移除网站活跃记录
   * @param websiteId 网站ID
   */
  removeWebsite(websiteId: string): void {
    this.activeWebsites.delete(websiteId)
  }

  /**
   * 获取不活跃的网站ID列表
   */
  getInactiveWebsiteIds(): string[] {
    const now = Date.now()
    const inactiveIds: string[] = []

    for (const [websiteId, lastAccessTime] of this.activeWebsites.entries()) {
      if (now - lastAccessTime > this.config.inactiveThreshold) {
        inactiveIds.push(websiteId)
      }
    }

    return inactiveIds
  }

  /**
   * 获取活跃网站数量
   */
  getActiveWebsiteCount(): number {
    return this.activeWebsites.size
  }

  /**
   * 获取不活跃网站数量
   */
  getInactiveWebsiteCount(): number {
    return this.getInactiveWebsiteIds().length
  }

  /**
   * 启用内存优化
   */
  enable(): void {
    this.optimizationEnabled = true
    this.startCleanup()
  }

  /**
   * 禁用内存优化
   */
  disable(): void {
    this.optimizationEnabled = false
    this.stopCleanup()
  }

  /**
   * 切换内存优化状态
   */
  toggle(): boolean {
    this.optimizationEnabled = !this.optimizationEnabled
    if (this.optimizationEnabled) {
      this.startCleanup()
    } else {
      this.stopCleanup()
    }
    return this.optimizationEnabled
  }

  /**
   * 获取内存优化状态
   */
  isEnabled(): boolean {
    return this.optimizationEnabled
  }

  /**
   * 设置不活跃阈值
   * @param minutes 分钟数
   */
  setInactiveThreshold(minutes: number): void {
    if (minutes >= 1 && minutes <= 480) {
      this.config.inactiveThreshold = minutes * 60 * 1000
      console.log(`Inactive threshold set to ${minutes} minutes`)
    }
  }

  /**
   * 设置清理间隔
   * @param minutes 分钟数
   */
  setCleanupInterval(minutes: number): void {
    if (minutes >= 1 && minutes <= 240) {
      this.config.cleanupInterval = minutes * 60 * 1000
      this.restartCleanup()
      console.log(`Cleanup interval set to ${minutes} minutes`)
    }
  }

  /**
   * 设置内存阈值
   * @param mb 内存大小（MB）
   */
  setMemoryThreshold(mb: number): void {
    if (mb >= 100 && mb <= 2048) {
      this.config.memoryThreshold = mb * 1024 * 1024
      console.log(`Memory threshold set to ${mb}MB`)
    }
  }

  /**
   * 获取当前内存使用情况
   */
  async getCurrentMemoryUsage(): Promise<{ workingSetSize: number; privateBytes: number } | null> {
    // 方法1: 使用 process.getProcessMemoryInfo
    try {
      console.log('Attempting to get process memory info (method 1)...')
      const usage = await process.getProcessMemoryInfo()
      console.log('Memory info received:', usage)

      if (!usage) {
        console.warn('Memory info is null')
        return null
      }

      // 检查数据结构，支持两种可能的格式
      if ('workingSetSize' in usage && typeof (usage as MemoryInfo).workingSetSize === 'number') {
        return {
          workingSetSize: (usage as MemoryInfo).workingSetSize!,
          privateBytes: (usage as MemoryInfo).privateBytes!
        }
      } else if ('residentSet' in usage && typeof (usage as MemoryInfo).residentSet === 'number') {
        // 备选格式：residentSet, private, shared
        console.log('Using alternate memory info structure (residentSet)')
        return {
          workingSetSize: (usage as MemoryInfo).residentSet!,
          privateBytes: (usage as MemoryInfo).private!
        }
      } else {
        console.warn('Invalid memory info structure:', usage)
        return null
      }
    } catch (error) {
      console.error('Failed to get memory usage (method 1):', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })

      // 方法2: 尝试使用 Node.js 的 process.memoryUsage 作为备选
      try {
        console.log('Attempting to get process memory info (method 2 - fallback)...')
        const memUsage = process.memoryUsage()
        console.log('Memory usage (fallback):', memUsage)

        // process.memoryUsage 返回的是 bytes，转换为 workingSetSize 和 privateBytes 的近似值
        return {
          workingSetSize: memUsage.rss, // Resident Set Size
          privateBytes: memUsage.heapUsed // 近似值
        }
      } catch (fallbackError) {
        console.error('Failed to get memory usage (fallback):', fallbackError)
        return null
      }
    }
  }

  /**
   * 清理所有网站记录
   */
  clearAll(): void {
    this.activeWebsites.clear()
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats(): {
    activeCount: number
    inactiveCount: number
    totalCount: number
    optimizationEnabled: boolean
    inactiveThreshold: number
    cleanupInterval: number
  } {
    return {
      activeCount: this.getActiveWebsiteCount(),
      inactiveCount: this.getInactiveWebsiteCount(),
      totalCount: this.activeWebsites.size,
      optimizationEnabled: this.optimizationEnabled,
      inactiveThreshold: this.config.inactiveThreshold / (60 * 1000), // 转换为分钟
      cleanupInterval: this.config.cleanupInterval / (60 * 1000) // 转换为分钟
    }
  }

  /**
   * 手动触发清理
   */
  forceCleanup(): string[] {
    const inactiveIds = this.getInactiveWebsiteIds()
    void this.cleanupWebsites(inactiveIds)
    this.notifyCleanupComplete(inactiveIds.length, false)
    return inactiveIds
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopCleanup()
    this.clearAll()
    console.log('Memory optimizer service cleaned up')
  }

  /**
   * 根据网站列表更新活跃记录
   * @param websites 网站列表
   */
  updateActiveWebsites(websites: Website[]): void {
    const now = Date.now()
    const websiteIds = websites.map((w) => w.id)

    // 移除不存在的网站
    for (const websiteId of this.activeWebsites.keys()) {
      if (!websiteIds.includes(websiteId)) {
        this.activeWebsites.delete(websiteId)
      }
    }

    // 添加或更新存在的网站
    for (const website of websites) {
      if (!this.activeWebsites.has(website.id)) {
        this.activeWebsites.set(website.id, now)
      }
    }
  }

  /**
   * 获取详细的内存统计
   */
  async getDetailedStats(): Promise<{
    activeCount: number
    inactiveCount: number
    totalCount: number
    optimizationEnabled: boolean
    inactiveThreshold: number
    cleanupInterval: number
    gcInterval: number
    memoryMonitorInterval: number
    memoryThreshold: number
    currentMemoryUsage?: { workingSetSize: number; privateBytes: number }
  }> {
    const stats = {
      activeCount: this.getActiveWebsiteCount(),
      inactiveCount: this.getInactiveWebsiteCount(),
      totalCount: this.activeWebsites.size,
      optimizationEnabled: this.optimizationEnabled,
      inactiveThreshold: this.config.inactiveThreshold / (60 * 1000),
      cleanupInterval: this.config.cleanupInterval / (60 * 1000),
      gcInterval: this.config.gcInterval / (60 * 1000),
      memoryMonitorInterval: this.config.memoryMonitorInterval / (60 * 1000),
      memoryThreshold: this.config.memoryThreshold / (1024 * 1024),
      currentMemoryUsage: undefined as { workingSetSize: number; privateBytes: number } | undefined
    }

    const usage = await this.getCurrentMemoryUsage()
    if (usage) {
      stats.currentMemoryUsage = usage
      console.log('Memory usage retrieved:', usage)
    } else {
      console.log('Failed to retrieve memory usage')
    }

    console.log('Detailed stats:', stats)
    return stats
  }
}

// 导出单例实例
export const memoryOptimizerService = new MemoryOptimizerService()
