import type { ExtensionInfo } from '../extensions/types'
import { ExtensionRiskLevel, ExtensionPermissionCategory } from '../../shared/types/store'

// 向后兼容的导出
export const RiskLevel = ExtensionRiskLevel
export const PermissionCategory = ExtensionPermissionCategory

export interface PermissionInfo {
  permission: string
  category: ExtensionPermissionCategory
  riskLevel: ExtensionRiskLevel
  description: string
  required: boolean
}

export interface PermissionValidationResult {
  valid: boolean
  riskLevel: ExtensionRiskLevel
  warnings: PermissionWarning[]
  suggestions: PermissionSuggestion[]
  blockedPermissions: BlockedPermission[]
  allowedPermissions: PermissionInfo[]
  overallScore: number
}

export interface PermissionWarning {
  type: string
  message: string
  severity: ExtensionRiskLevel
  permissions: string[]
}

export interface PermissionSuggestion {
  type: string
  message: string
  action?: string
}

export interface BlockedPermission {
  permission: string
  reason: string
  riskLevel: ExtensionRiskLevel
  category: ExtensionPermissionCategory
}

/**
 * 扩展权限管理器
 * 负责扩展权限的验证、风险评估和用户控制
 */
export class ExtensionPermissionManager {
  private permissionCategories = new Map<string, string[]>([
    [
      PermissionCategory.SENSITIVE,
      [
        'tabs',
        'webRequest',
        'webRequestBlocking',
        'proxy',
        'nativeMessaging',
        'debugger',
        'management',
        'bookmarks',
        'history',
        'topSites'
      ]
    ],
    [
      PermissionCategory.NETWORK,
      ['activeTab', 'declarativeNetRequest', 'downloads', 'cookies', 'storage', 'webNavigation']
    ],
    [
      PermissionCategory.SYSTEM,
      ['system.display', 'system.storage', 'power', 'usb', 'serial', 'bluetooth']
    ],
    [PermissionCategory.FILE, ['filesystem']],
    [
      PermissionCategory.UI,
      ['contextMenus', 'notifications', 'alarms', 'omnibox', 'commands', 'scripting']
    ],
    [PermissionCategory.STORAGE, ['unlimitedStorage']]
  ])

  private permissionDescriptions = new Map<string, string>([
    ['tabs', '访问和操作浏览器标签页'],
    ['webRequest', '监控和修改网络请求'],
    ['webRequestBlocking', '阻止网络请求'],
    ['proxy', '配置网络代理设置'],
    ['nativeMessaging', '与本地应用程序通信'],
    ['debugger', '调试浏览器和网页'],
    ['management', '管理扩展和主题'],
    ['bookmarks', '访问和修改书签'],
    ['history', '访问浏览历史'],
    ['topSites', '访问最常访问的网站'],
    ['activeTab', '访问当前活动标签页'],
    ['declarativeNetRequest', '声明式网络请求规则'],
    ['downloads', '管理下载任务'],
    ['cookies', '访问和修改Cookie'],
    ['storage', '存储数据'],
    ['webNavigation', '监控网页导航'],
    ['system.display', '访问显示器信息'],
    ['system.storage', '访问存储设备信息'],
    ['power', '控制系统电源状态'],
    ['usb', '访问USB设备'],
    ['serial', '访问串口设备'],
    ['bluetooth', '访问蓝牙设备'],
    ['filesystem', '访问文件系统'],
    ['contextMenus', '创建右键菜单'],
    ['notifications', '显示通知'],
    ['alarms', '创建定时器'],
    ['omnibox', '在地址栏提供建议'],
    ['commands', '注册快捷键'],
    ['scripting', '注入和执行脚本'],
    ['unlimitedStorage', '无限制存储数据']
  ])

  private riskLevels = new Map<string, ExtensionRiskLevel>([
    ['tabs', RiskLevel.HIGH],
    ['webRequest', RiskLevel.HIGH],
    ['webRequestBlocking', RiskLevel.HIGH],
    ['proxy', RiskLevel.HIGH],
    ['nativeMessaging', RiskLevel.CRITICAL],
    ['debugger', RiskLevel.CRITICAL],
    ['management', RiskLevel.HIGH],
    ['bookmarks', RiskLevel.MEDIUM],
    ['history', RiskLevel.MEDIUM],
    ['topSites', RiskLevel.LOW],
    ['activeTab', RiskLevel.MEDIUM],
    ['declarativeNetRequest', RiskLevel.MEDIUM],
    ['downloads', RiskLevel.MEDIUM],
    ['cookies', RiskLevel.HIGH],
    ['storage', RiskLevel.LOW],
    ['webNavigation', RiskLevel.LOW],
    ['system.display', RiskLevel.MEDIUM],
    ['system.storage', RiskLevel.MEDIUM],
    ['power', RiskLevel.HIGH],
    ['usb', RiskLevel.CRITICAL],
    ['serial', RiskLevel.CRITICAL],
    ['bluetooth', RiskLevel.HIGH],
    ['filesystem', RiskLevel.HIGH],
    ['contextMenus', RiskLevel.LOW],
    ['notifications', RiskLevel.LOW],
    ['alarms', RiskLevel.LOW],
    ['omnibox', RiskLevel.MEDIUM],
    ['commands', RiskLevel.LOW],
    ['scripting', RiskLevel.HIGH],
    ['unlimitedStorage', RiskLevel.MEDIUM]
  ])

  private userPermissionSettings: Map<string, Set<string>> = new Map()
  private defaultRiskTolerance: ExtensionRiskLevel = ExtensionRiskLevel.MEDIUM

  constructor() {
    this.loadUserSettings()
  }

  /**
   * 验证扩展权限
   */
  async validateExtensionPermissions(
    extension: ExtensionInfo,
    userRiskTolerance: ExtensionRiskLevel = this.defaultRiskTolerance
  ): Promise<PermissionValidationResult> {
    const manifest = extension.manifest
    if (!manifest?.permissions) {
      return {
        valid: true,
        riskLevel: ExtensionRiskLevel.NONE,
        warnings: [],
        suggestions: [],
        blockedPermissions: [],
        allowedPermissions: [],
        overallScore: 100
      }
    }

    const validation: PermissionValidationResult = {
      valid: true,
      riskLevel: ExtensionRiskLevel.NONE,
      warnings: [],
      suggestions: [],
      blockedPermissions: [],
      allowedPermissions: [],
      overallScore: 100
    }

    let totalRisk = 0
    let highRiskCount = 0
    let criticalRiskCount = 0

    for (const permission of manifest.permissions) {
      const permissionInfo = await this.getPermissionInfo(permission)
      const isAllowed = await this.isUserAllowedPermission(permission, userRiskTolerance)

      if (!isAllowed) {
        validation.blockedPermissions.push({
          permission,
          reason: this.getBlockReason(permission, userRiskTolerance),
          riskLevel: permissionInfo.riskLevel,
          category: permissionInfo.category
        })
        validation.valid = false
        validation.overallScore -= this.getPermissionScore(permission)
        continue
      }

      validation.allowedPermissions.push(permissionInfo)

      // 计算风险等级
      const riskValue = this.getRiskValue(permissionInfo.riskLevel)
      totalRisk += riskValue
      if (permissionInfo.riskLevel >= ExtensionRiskLevel.HIGH) highRiskCount++
      if (permissionInfo.riskLevel >= ExtensionRiskLevel.CRITICAL) criticalRiskCount++

      // 检查权限组合风险
      const combinationRisk = this.checkPermissionCombination(manifest.permissions, permission)
      if (combinationRisk > ExtensionRiskLevel.LOW) {
        validation.warnings.push({
          type: 'COMBINATION_RISK',
          message: `权限组合可能存在安全风险: ${permission}`,
          severity: combinationRisk,
          permissions: [permission]
        })
      }
    }

    // 计算总体风险等级
    validation.riskLevel = this.calculateOverallRisk(
      totalRisk,
      highRiskCount,
      criticalRiskCount,
      manifest.permissions.length
    )

    // 生成建议
    validation.suggestions = this.generatePermissionSuggestions(validation, extension)

    return validation
  }

  /**
   * 获取权限信息
   */
  private async getPermissionInfo(permission: string): Promise<PermissionInfo> {
    const category = this.getPermissionCategory(permission)
    const riskLevel = this.riskLevels.get(permission) || ExtensionRiskLevel.LOW
    const description = this.permissionDescriptions.get(permission) || '未知权限'

    return {
      permission,
      category,
      riskLevel,
      description,
      required: false // 可以根据实际需求判断是否必需
    }
  }

  /**
   * 获取权限分类
   */
  private getPermissionCategory(permission: string): ExtensionPermissionCategory {
    for (const [category, permissions] of this.permissionCategories) {
      if (permissions.includes(permission)) {
        return category as ExtensionPermissionCategory
      }
    }
    return ExtensionPermissionCategory.UNKNOWN
  }

  /**
   * 检查用户是否允许权限
   */
  private async isUserAllowedPermission(
    permission: string,
    userRiskTolerance: ExtensionRiskLevel
  ): Promise<boolean> {
    // 获取用户设置的权限
    const userSettings = this.userPermissionSettings.get('global') || new Set()

    // 如果用户明确设置了权限，以用户设置为准
    if (userSettings.has(permission)) {
      return true
    }
    if (userSettings.has(`!${permission}`)) {
      return false
    }

    // 根据风险等级判断
    const riskLevel = this.riskLevels.get(permission) || ExtensionRiskLevel.LOW
    return riskLevel <= userRiskTolerance
  }

  /**
   * 获取阻止原因
   */
  private getBlockReason(permission: string, _userRiskTolerance: ExtensionRiskLevel): string {
    const riskLevel = this.riskLevels.get(permission) || ExtensionRiskLevel.LOW

    if (riskLevel >= ExtensionRiskLevel.CRITICAL) {
      return '严重风险权限，需要管理员授权'
    }
    if (riskLevel >= ExtensionRiskLevel.HIGH) {
      return '高风险权限，超出用户风险承受范围'
    }
    if (riskLevel >= ExtensionRiskLevel.MEDIUM) {
      return '中等风险权限，需要用户确认'
    }

    return '权限被默认阻止'
  }

  /**
   * 获取权限分数
   */
  private getPermissionScore(permission: string): number {
    const riskLevel = this.riskLevels.get(permission) || ExtensionRiskLevel.LOW
    const scoreMap = {
      [ExtensionRiskLevel.NONE]: 0,
      [ExtensionRiskLevel.LOW]: 5,
      [ExtensionRiskLevel.MEDIUM]: 15,
      [ExtensionRiskLevel.HIGH]: 30,
      [ExtensionRiskLevel.CRITICAL]: 50
    }
    return scoreMap[riskLevel]
  }

  /**
   * 检查权限组合风险
   */
  private checkPermissionCombination(
    permissions: string[],
    _currentPermission: string
  ): ExtensionRiskLevel {
    const riskyCombinations = [
      { permissions: ['debugger', 'tabs'], risk: ExtensionRiskLevel.CRITICAL },
      { permissions: ['proxy', 'webRequest'], risk: ExtensionRiskLevel.HIGH },
      { permissions: ['nativeMessaging', 'debugger'], risk: ExtensionRiskLevel.CRITICAL },
      { permissions: ['filesystem', 'debugger'], risk: ExtensionRiskLevel.HIGH },
      { permissions: ['usb', 'serial'], risk: ExtensionRiskLevel.CRITICAL }
    ]

    for (const combo of riskyCombinations) {
      if (combo.permissions.every((p) => permissions.includes(p))) {
        return combo.risk
      }
    }

    return ExtensionRiskLevel.LOW
  }

  /**
   * 计算总体风险等级
   */
  private calculateOverallRisk(
    totalRisk: number,
    highRiskCount: number,
    criticalRiskCount: number,
    totalPermissions: number
  ): ExtensionRiskLevel {
    if (criticalRiskCount > 0) return ExtensionRiskLevel.CRITICAL
    if (highRiskCount > 2) return ExtensionRiskLevel.HIGH
    // 使用风险值而不是枚举值进行计算
    const highRiskValue = this.getRiskValue(ExtensionRiskLevel.HIGH)
    const mediumRiskValue = this.getRiskValue(ExtensionRiskLevel.MEDIUM)
    if (totalRisk > highRiskValue * totalPermissions * 0.7) return ExtensionRiskLevel.HIGH
    if (totalRisk > mediumRiskValue * totalPermissions * 0.7) return ExtensionRiskLevel.MEDIUM
    return ExtensionRiskLevel.LOW
  }

  /**
   * 生成权限建议
   */
  private generatePermissionSuggestions(
    validation: PermissionValidationResult,
    _extension: ExtensionInfo
  ): PermissionSuggestion[] {
    const suggestions: PermissionSuggestion[] = []

    if (validation.riskLevel >= ExtensionRiskLevel.HIGH) {
      suggestions.push({
        type: 'RISK_WARNING',
        message: `该扩展请求较高权限，建议谨慎使用。风险等级: ${this.getRiskLevelText(validation.riskLevel)}`,
        action: 'review_permissions'
      })
    }

    if (validation.blockedPermissions.length > 0) {
      suggestions.push({
        type: 'PERMISSION_BLOCKED',
        message: `部分权限被阻止: ${validation.blockedPermissions.map((p) => p.permission).join(', ')}`,
        action: 'adjust_permissions'
      })
    }

    // 检查是否有敏感权限
    const sensitivePermissions = validation.allowedPermissions.filter(
      (p) => p.category === ExtensionPermissionCategory.SENSITIVE
    )
    if (sensitivePermissions.length > 0) {
      suggestions.push({
        type: 'SENSITIVE_PERMISSIONS',
        message: `该扩展请求敏感权限: ${sensitivePermissions.map((p) => p.permission).join(', ')}`,
        action: 'review_sensitive_permissions'
      })
    }

    return suggestions
  }

  /**
   * 获取风险等级文本
   */
  private getRiskLevelText(riskLevel: ExtensionRiskLevel): string {
    const riskTexts = {
      [ExtensionRiskLevel.NONE]: '无风险',
      [ExtensionRiskLevel.LOW]: '低风险',
      [ExtensionRiskLevel.MEDIUM]: '中等风险',
      [ExtensionRiskLevel.HIGH]: '高风险',
      [ExtensionRiskLevel.CRITICAL]: '严重风险'
    }
    return riskTexts[riskLevel]
  }

  /**
   * 获取风险值
   */
  private getRiskValue(riskLevel: ExtensionRiskLevel): number {
    const riskValues = {
      [ExtensionRiskLevel.NONE]: 0,
      [ExtensionRiskLevel.LOW]: 1,
      [ExtensionRiskLevel.MEDIUM]: 2,
      [ExtensionRiskLevel.HIGH]: 3,
      [ExtensionRiskLevel.CRITICAL]: 5
    }
    return riskValues[riskLevel]
  }

  /**
   * 更新用户权限设置
   */
  updateUserPermissionSettings(extensionId: string, permissions: string[], allowed: boolean): void {
    const key = extensionId || 'global'
    let settings = this.userPermissionSettings.get(key)

    if (!settings) {
      settings = new Set()
      this.userPermissionSettings.set(key, settings)
    }

    permissions.forEach((permission) => {
      if (allowed) {
        settings.add(permission)
        settings.delete(`!${permission}`)
      } else {
        settings.add(`!${permission}`)
        settings.delete(permission)
      }
    })

    this.saveUserSettings()
  }

  /**
   * 获取用户权限设置
   */
  getUserPermissionSettings(extensionId?: string): Set<string> {
    const key = extensionId || 'global'
    return this.userPermissionSettings.get(key) || new Set()
  }

  /**
   * 加载用户设置
   */
  public loadUserSettings(): void {
    try {
      // 这里可以从存储中加载用户设置
      // const settings = await storage.get('extensionPermissionSettings')
      // if (settings) {
      //   this.userPermissionSettings = new Map(settings)
      // }
    } catch (error) {
      console.error('Failed to load user permission settings:', error)
    }
  }

  /**
   * 保存用户设置
   */
  private saveUserSettings(): void {
    try {
      // 这里可以将用户设置保存到存储
      // const settings = Array.from(this.userPermissionSettings.entries())
      // await storage.set('extensionPermissionSettings', settings)
    } catch (error) {
      console.error('Failed to save user permission settings:', error)
    }
  }

  /**
   * 获取权限统计
   */
  getPermissionStats(): {
    totalPermissions: number
    permissionsByCategory: Record<ExtensionPermissionCategory, number>
    permissionsByRisk: Record<ExtensionRiskLevel, number>
    userSettings: Map<string, Set<string>>
  } {
    const permissionsByCategory: Record<ExtensionPermissionCategory, number> = {} as Record<
      ExtensionPermissionCategory,
      number
    >
    const permissionsByRisk: Record<ExtensionRiskLevel, number> = {} as Record<
      ExtensionRiskLevel,
      number
    >

    // 初始化统计对象
    Object.values(ExtensionPermissionCategory).forEach((category) => {
      permissionsByCategory[category] = 0
    })

    Object.values(ExtensionRiskLevel).forEach((risk) => {
      permissionsByRisk[risk] = 0
    })

    // 统计权限
    for (const permissions of this.permissionCategories.values()) {
      permissions.forEach((permission) => {
        const category = this.getPermissionCategory(permission)
        const riskLevel = this.riskLevels.get(permission) || ExtensionRiskLevel.LOW

        permissionsByCategory[category]++
        permissionsByRisk[riskLevel]++
      })
    }

    return {
      totalPermissions: Array.from(this.permissionCategories.values()).flat().length,
      permissionsByCategory,
      permissionsByRisk,
      userSettings: new Map(this.userPermissionSettings)
    }
  }

  /**
   * 重置用户设置
   */
  resetUserSettings(): void {
    this.userPermissionSettings.clear()
    this.saveUserSettings()
  }
}

// 导出单例实例
export const extensionPermissionManager = new ExtensionPermissionManager()
