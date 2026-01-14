import { ipcMain } from 'electron'
import type { ExtensionInfo, ExtensionManifest } from '../extensions/types'
import { extensionIsolationManager } from '../services/extensionIsolation'
import { extensionPermissionManager } from '../services/extensionPermissionManager'
import { extensionErrorManager } from '../services/extensionErrorManager'
import { ExtensionLoader } from '../extensions/loader'
import { ExtensionManager } from '../extensions/extensionManager'
import { ExtensionIsolationLevel, ExtensionRiskLevel } from '../../shared/types/store'

// 定义返回类型接口
interface ExtensionSessionInfo {
  id: string
  extensionId: string
  isolationLevel: ExtensionIsolationLevel
  createdAt: Date
  lastUsed: Date
  memoryUsage: number
  isActive: boolean
  restrictions: string[]
}

interface PermissionSettings {
  settings: string[]
  riskLevel: ExtensionRiskLevel
}

interface ExtensionWithPermissionsResult {
  success: boolean
  extension?: {
    id: string
    name: string
    version: string
    enabled: boolean
    manifest?: ExtensionManifest
  }
  session?: ExtensionSessionInfo | null
  permissions?: PermissionSettings
  error?: string
}

/**
 * 增强的扩展管理IPC处理器
 * 集成隔离管理、权限管理和错误处理功能
 */
export class ExtensionEnhancedHandlers {
  private extensionLoader: ExtensionLoader
  private simpleExtensionManager: ExtensionManager

  constructor() {
    this.extensionLoader = new ExtensionLoader()
    this.simpleExtensionManager = ExtensionManager.getInstance()
    this.registerHandlers()
  }

  /**
   * 注册IPC处理器
   */
  private registerHandlers(): void {
    // 扩展隔离相关
    ipcMain.handle('extension-isolation:create-session', this.createExtensionSession.bind(this))
    ipcMain.handle('extension-isolation:destroy-session', this.destroyExtensionSession.bind(this))
    ipcMain.handle('extension-isolation:get-session', this.getExtensionSession.bind(this))
    ipcMain.handle('extension-isolation:update-usage', this.updateSessionUsage.bind(this))
    ipcMain.handle('extension-isolation:get-stats', this.getSessionStats.bind(this))
    ipcMain.handle('extension-isolation:update-config', this.updateIsolationConfig.bind(this))
    ipcMain.handle('extension-isolation:get-config', this.getIsolationConfig.bind(this))

    // 权限管理相关
    ipcMain.handle('extension-permission:validate', this.validateExtensionPermissions.bind(this))
    ipcMain.handle('extension-permission:update-settings', this.updatePermissionSettings.bind(this))
    ipcMain.handle('extension-permission:get-settings', this.getPermissionSettings.bind(this))
    ipcMain.handle('extension-permission:get-stats', this.getPermissionStats.bind(this))
    ipcMain.handle('extension-permission:reset-settings', this.resetPermissionSettings.bind(this))

    // 错误管理相关
    ipcMain.handle('extension-error:handle-load-error', this.handleLoadError.bind(this))
    ipcMain.handle('extension-error:get-stats', this.getErrorStats.bind(this))
    ipcMain.handle('extension-error:clear-history', this.clearErrorHistory.bind(this))

    // 扩展管理相关
    ipcMain.handle('extension:load-with-isolation', this.loadExtensionWithIsolation.bind(this))
    ipcMain.handle('extension:unload-with-isolation', this.unloadExtensionWithIsolation.bind(this))
    ipcMain.handle('extension:get-with-permissions', this.getExtensionWithPermissions.bind(this))
  }

  /**
   * 创建扩展会话
   */
  private async createExtensionSession(
    _event: Electron.IpcMainInvokeEvent,
    extension: ExtensionInfo,
    isolationLevel?: string
  ): Promise<{
    success: boolean
    sessionId?: string
    isolationLevel?: ExtensionIsolationLevel
    restrictions?: string[]
    error?: string
  }> {
    try {
      const level = isolationLevel ? (isolationLevel as ExtensionIsolationLevel) : undefined
      const session = await extensionIsolationManager.createExtensionSession(extension, level)

      return {
        success: true,
        sessionId: session.id,
        isolationLevel: session.isolationLevel,
        restrictions: session.restrictions.blockedPermissions
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 销毁扩展会话
   */
  private async destroyExtensionSession(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await extensionIsolationManager.destroyExtensionSession(extensionId)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取扩展会话
   */
  private async getExtensionSession(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ): Promise<ExtensionSessionInfo | null> {
    const session = extensionIsolationManager.getExtensionSession(extensionId)
    if (!session) {
      return null
    }

    return {
      id: session.id,
      extensionId: session.extensionId,
      isolationLevel: session.isolationLevel,
      createdAt: new Date(session.createdAt),
      lastUsed: new Date(session.lastUsed),
      memoryUsage: session.memoryUsage,
      isActive: session.isActive,
      restrictions: session.restrictions.blockedPermissions
    }
  }

  /**
   * 更新会话使用状态
   */
  private async updateSessionUsage(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ): Promise<void> {
    extensionIsolationManager.updateSessionUsage(extensionId)
  }

  /**
   * 获取会话统计
   */
  private async getSessionStats(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<ReturnType<typeof extensionIsolationManager.getSessionStats>> {
    return extensionIsolationManager.getSessionStats()
  }

  /**
   * 更新隔离配置
   */
  private async updateIsolationConfig(
    _event: Electron.IpcMainInvokeEvent,
    config: Partial<import('../../shared/types/store').ExtensionIsolationConfig>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      extensionIsolationManager.updateConfig(config as any)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取隔离配置
   */
  private async getIsolationConfig(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<ReturnType<typeof extensionIsolationManager.getConfig>> {
    return extensionIsolationManager.getConfig()
  }

  /**
   * 验证扩展权限
   */
  private async validateExtensionPermissions(
    _event: Electron.IpcMainInvokeEvent,
    extension: ExtensionInfo,
    userRiskTolerance?: string
  ): Promise<{
    valid: boolean
    riskLevel?: ExtensionRiskLevel
    warnings?: string[]
    suggestions?: string[]
    blockedPermissions?: Array<{ permission: string; reason: string }>
    allowedPermissions?: string[]
    overallScore?: number
    error?: string
  }> {
    try {
      const riskLevel = userRiskTolerance ? (userRiskTolerance as ExtensionRiskLevel) : undefined
      const result = await extensionPermissionManager.validateExtensionPermissions(
        extension,
        riskLevel
      )

      return {
        valid: result.valid,
        riskLevel: result.riskLevel,
        warnings: result.warnings.map((w) => w.message),
        suggestions: result.suggestions.map((s) => s.message),
        blockedPermissions: result.blockedPermissions,
        allowedPermissions: result.allowedPermissions.map((p) => p.permission),
        overallScore: result.overallScore
      }
    } catch (error) {
      return {
        valid: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 更新权限设置
   */
  private async updatePermissionSettings(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string,
    permissions: string[],
    allowed: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      extensionPermissionManager.updateUserPermissionSettings(extensionId, permissions, allowed)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取权限设置
   */
  private async getPermissionSettings(
    _event: Electron.IpcMainInvokeEvent,
    extensionId?: string
  ): Promise<Set<string>> {
    return extensionPermissionManager.getUserPermissionSettings(extensionId)
  }

  /**
   * 获取权限统计
   */
  private async getPermissionStats(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<ReturnType<typeof extensionPermissionManager.getPermissionStats>> {
    return extensionPermissionManager.getPermissionStats()
  }

  /**
   * 重置权限设置
   */
  private async resetPermissionSettings(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      extensionPermissionManager.resetUserSettings()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 处理加载错误
   */
  private async handleLoadError(
    _event: Electron.IpcMainInvokeEvent,
    extension: ExtensionInfo,
    error: Error,
    retryCount?: number
  ): Promise<{
    success: boolean
    extension?: { id: string; name: string; version: string; enabled: boolean }
    error?: {
      type: string
      message: string
      details: unknown
      severity: string
      recoverable: boolean
      timestamp: number
      extensionId: string
      retryCount?: number
    }
    retryAfter?: number
  }> {
    const result = await extensionErrorManager.handleLoadError(extension, error, retryCount || 0)

    return {
      success: result.success,
      extension: result.extension as
        | { id: string; name: string; version: string; enabled: boolean }
        | undefined,
      error: result.error
        ? {
            type: result.error.type,
            message: result.error.message,
            details: result.error.details,
            severity: result.error.severity,
            recoverable: result.error.recoverable,
            timestamp: result.error.timestamp,
            extensionId: result.error.extensionId,
            retryCount: result.error.retryCount
          }
        : undefined,
      retryAfter: result.retryAfter
    }
  }

  /**
   * 获取错误统计
   */
  private async getErrorStats(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<ReturnType<typeof extensionErrorManager.getErrorStats>> {
    return extensionErrorManager.getErrorStats()
  }

  /**
   * 清除错误历史
   */
  private async clearErrorHistory(
    _event: Electron.IpcMainInvokeEvent
  ): Promise<{ success: boolean; error?: string }> {
    try {
      extensionErrorManager.clearErrorHistory()
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 使用隔离加载扩展
   */
  private async loadExtensionWithIsolation(
    _event: Electron.IpcMainInvokeEvent,
    extensionPath: string,
    isolationLevel?: string
  ): Promise<{
    success: boolean
    extension?: { id: string; name: string; version: string; enabled: boolean }
    sessionId?: string
    isolationLevel?: ExtensionIsolationLevel
    permissions?: string[]
    riskLevel?: ExtensionRiskLevel
    error?: string
  }> {
    try {
      // 加载扩展
      const extension = await this.extensionLoader.loadExtension(extensionPath)

      // 创建隔离会话
      const level = isolationLevel ? (isolationLevel as ExtensionIsolationLevel) : undefined
      const session = await extensionIsolationManager.createExtensionSession(extension, level)

      // 验证权限
      const permissionValidation =
        await extensionPermissionManager.validateExtensionPermissions(extension)

      // 如果权限验证失败，销毁会话
      if (!permissionValidation.valid) {
        await extensionIsolationManager.destroyExtensionSession(extension.id)
        throw new Error(
          `权限验证失败: ${permissionValidation.blockedPermissions.map((p) => p.permission).join(', ')}`
        )
      }

      // 注册扩展
      this.simpleExtensionManager.registerExtension(extension)

      return {
        success: true,
        extension: {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: true
        },
        sessionId: session.id,
        isolationLevel: session.isolationLevel,
        permissions: permissionValidation.allowedPermissions.map((p) => p.permission),
        riskLevel: permissionValidation.riskLevel
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 使用隔离卸载扩展
   */
  private async unloadExtensionWithIsolation(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 销毁隔离会话
      await extensionIsolationManager.destroyExtensionSession(extensionId)

      // 注销扩展
      this.simpleExtensionManager.unregisterExtension(extensionId)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }

  /**
   * 获取扩展及其权限信息
   */
  private async getExtensionWithPermissions(
    _event: Electron.IpcMainInvokeEvent,
    extensionId: string
  ): Promise<ExtensionWithPermissionsResult> {
    try {
      const extension = this.simpleExtensionManager.getExtension(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      const session = extensionIsolationManager.getExtensionSession(extensionId)
      const permissionSettings = extensionPermissionManager.getUserPermissionSettings(extensionId)

      return {
        success: true,
        extension: {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: extension.enabled,
          manifest: extension.manifest
        },
        session: session
          ? {
              id: session.id,
              extensionId: session.extensionId,
              isolationLevel: session.isolationLevel,
              createdAt: new Date(session.createdAt),
              lastUsed: new Date(session.lastUsed),
              memoryUsage: session.memoryUsage,
              isActive: session.isActive,
              restrictions: session.restrictions.blockedPermissions
            }
          : null,
        permissions: {
          settings: Array.from(permissionSettings),
          riskLevel:
            extensionPermissionManager.getUserPermissionSettings().size > 0
              ? ExtensionRiskLevel.MEDIUM
              : ExtensionRiskLevel.LOW
        }
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

// 导出处理器实例
export const extensionEnhancedHandlers = new ExtensionEnhancedHandlers()
