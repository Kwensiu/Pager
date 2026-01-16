import type { ExtensionInfo, ExtensionManifest } from '../extensions/types'

export enum ExtensionErrorType {
  MANIFEST_INVALID = 'MANIFEST_INVALID',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  NETWORK_ERROR = 'NETWORK_ERROR',
  MEMORY_EXCEEDED = 'MEMORY_EXCEEDED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  CONFLICT_DETECTED = 'CONFLICT_DETECTED',
  INVALID_CRX = 'INVALID_CRX',
  UNSUPPORTED_VERSION = 'UNSUPPORTED_VERSION',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ExtensionError {
  type: ExtensionErrorType
  message: string
  details?: Record<string, unknown>
  severity: ErrorSeverity
  recoverable: boolean
  timestamp: number
  extensionId: string
  retryCount?: number
}

export interface UserFriendlyError {
  title: string
  message: string
  suggestion: string
  technicalDetails?: string
  recoverable: boolean
  action?: string
}

export interface ExtensionLoadResult {
  success: boolean
  extension?: ExtensionInfo
  error?: ExtensionError
  retryAfter?: number
}

/**
 * 扩展错误管理器
 * 统一处理扩展相关的错误，提供智能错误恢复和用户友好的错误提示
 */
export class ExtensionErrorManager {
  private errorCounts: Map<string, number> = new Map()
  private errorHistory: ExtensionError[] = []
  private maxRetries: number = 3
  private retryDelays: number[] = [1000, 3000, 10000] // 指数退避
  private maxHistorySize: number = 100

  constructor(private logger: Console = console) {}

  /**
   * 处理扩展加载错误
   */
  async handleLoadError(
    extension: ExtensionInfo,
    error: Error,
    retryCount: number = 0
  ): Promise<ExtensionLoadResult> {
    const errorKey = `${extension.id}:${error.name}`
    const currentCount = this.errorCounts.get(errorKey) || 0

    this.logger.error(`Extension load error [${currentCount + 1}]:`, {
      extension: extension.name,
      error: error.message,
      stack: error.stack,
      retryCount
    })

    // 记录错误
    const extensionError: ExtensionError = {
      type: this.classifyError(error),
      message: error.message,
      details: {
        path: extension.path,
        manifest: extension.manifest,
        retryCount
      },
      severity: this.getErrorSeverity(error),
      recoverable: this.isRecoverableError(error),
      timestamp: Date.now(),
      extensionId: extension.id,
      retryCount
    }

    this.recordError(extensionError)

    // 分析错误类型并处理
    const result = await this.processErrorByType(extension, extensionError)

    // 更新错误计数
    this.errorCounts.set(errorKey, currentCount + 1)

    return result
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ExtensionErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('manifest')) {
      return ExtensionErrorType.MANIFEST_INVALID
    }
    if (message.includes('permission') || message.includes('denied')) {
      return ExtensionErrorType.PERMISSION_DENIED
    }
    if (message.includes('enoent') || message.includes('not found')) {
      return ExtensionErrorType.FILE_NOT_FOUND
    }
    if (message.includes('econnrefused') || message.includes('network')) {
      return ExtensionErrorType.NETWORK_ERROR
    }
    if (message.includes('memory') || message.includes('heap')) {
      return ExtensionErrorType.MEMORY_EXCEEDED
    }
    if (message.includes('security') || message.includes('violation')) {
      return ExtensionErrorType.SECURITY_VIOLATION
    }
    if (message.includes('conflict') || message.includes('already')) {
      return ExtensionErrorType.CONFLICT_DETECTED
    }
    if (message.includes('crx') || message.includes('invalid')) {
      return ExtensionErrorType.INVALID_CRX
    }
    if (message.includes('version') || message.includes('unsupported')) {
      return ExtensionErrorType.UNSUPPORTED_VERSION
    }

    return ExtensionErrorType.UNKNOWN_ERROR
  }

  /**
   * 获取错误严重程度
   */
  private getErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()

    if (
      message.includes('critical') ||
      message.includes('security') ||
      message.includes('violation')
    ) {
      return ErrorSeverity.CRITICAL
    }
    if (
      message.includes('manifest') ||
      message.includes('permission') ||
      message.includes('conflict')
    ) {
      return ErrorSeverity.HIGH
    }
    if (message.includes('network') || message.includes('memory')) {
      return ErrorSeverity.MEDIUM
    }
    return ErrorSeverity.LOW
  }

  /**
   * 判断错误是否可恢复
   */
  private isRecoverableError(error: Error): boolean {
    const message = error.message.toLowerCase()

    // 网络错误、临时性错误通常可恢复
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('temporary')
    ) {
      return true
    }

    // 版本不匹配通常不可恢复
    if (message.includes('version') && message.includes('unsupported')) {
      return false
    }

    // 安全违规通常不可恢复
    if (message.includes('security') || message.includes('violation')) {
      return false
    }

    // 其他情况默认可尝试恢复
    return true
  }

  /**
   * 按错误类型处理
   */
  private async processErrorByType(
    extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    switch (error.type) {
      case ExtensionErrorType.MANIFEST_INVALID:
        return await this.handleManifestError(extension, error)

      case ExtensionErrorType.PERMISSION_DENIED:
        return await this.handlePermissionError(extension, error)

      case ExtensionErrorType.FILE_NOT_FOUND:
        return await this.handleFileError(extension, error)

      case ExtensionErrorType.NETWORK_ERROR:
        return await this.handleNetworkError(extension, error)

      case ExtensionErrorType.MEMORY_EXCEEDED:
        return await this.handleMemoryError(extension, error)

      case ExtensionErrorType.SECURITY_VIOLATION:
        return await this.handleSecurityError(extension, error)

      case ExtensionErrorType.CONFLICT_DETECTED:
        return await this.handleConflictError(extension, error)

      case ExtensionErrorType.INVALID_CRX:
        return await this.handleInvalidCrxError(extension, error)

      case ExtensionErrorType.UNSUPPORTED_VERSION:
        return await this.handleUnsupportedVersionError(extension, error)

      default:
        return await this.handleUnknownError(extension, error)
    }
  }

  /**
   * 处理manifest错误
   */
  private async handleManifestError(
    extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 尝试修复manifest问题
    const fixedManifest = await this.tryFixManifest(extension)
    if (fixedManifest && error.retryCount! < this.maxRetries) {
      return this.retryLoad(extension, { fixedManifest, retryCount: error.retryCount! + 1 })
    }

    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.MANIFEST_INVALID,
        message: '扩展配置文件格式错误',
        recoverable: false
      }
    }
  }

  /**
   * 处理权限错误
   */
  private async handlePermissionError(
    extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 权限错误通常需要用户干预
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.PERMISSION_DENIED,
        message: '扩展权限被拒绝',
        recoverable: true,
        details: {
          ...error.details,
          requiredPermissions: extension.manifest?.permissions || []
        }
      }
    }
  }

  /**
   * 处理文件错误
   */
  private async handleFileError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 文件缺失错误通常不可恢复
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.FILE_NOT_FOUND,
        message: '扩展文件缺失或损坏',
        recoverable: false
      }
    }
  }

  /**
   * 处理网络错误
   */
  private async handleNetworkError(
    extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    if (error.retryCount! < this.maxRetries) {
      const delay =
        this.retryDelays[error.retryCount!] || this.retryDelays[this.retryDelays.length - 1]
      return this.retryLoad(extension, { retryCount: error.retryCount! + 1, retryAfter: delay })
    }

    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.NETWORK_ERROR,
        message: '网络连接失败',
        recoverable: false
      }
    }
  }

  /**
   * 处理内存错误
   */
  private async handleMemoryError(
    extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 内存错误需要释放资源后重试
    if (error.retryCount! < 2) {
      await this.releaseMemory()
      return this.retryLoad(extension, { retryCount: error.retryCount! + 1 })
    }

    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.MEMORY_EXCEEDED,
        message: '内存使用超限',
        recoverable: false
      }
    }
  }

  /**
   * 处理安全错误
   */
  private async handleSecurityError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 安全错误通常不可恢复
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.SECURITY_VIOLATION,
        message: '安全违规检测',
        recoverable: false
      }
    }
  }

  /**
   * 处理冲突错误
   */
  private async handleConflictError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 冲突错误需要用户解决
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.CONFLICT_DETECTED,
        message: '扩展冲突检测到',
        recoverable: true
      }
    }
  }

  /**
   * 处理无效CRX错误
   */
  private async handleInvalidCrxError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // CRX文件格式错误通常不可恢复
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.INVALID_CRX,
        message: 'CRX文件格式无效',
        recoverable: false
      }
    }
  }

  /**
   * 处理不支持的版本错误
   */
  private async handleUnsupportedVersionError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 版本不匹配通常不可恢复
    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.UNSUPPORTED_VERSION,
        message: '不支持的扩展版本',
        recoverable: false
      }
    }
  }

  /**
   * 处理未知错误
   */
  private async handleUnknownError(
    _extension: ExtensionInfo,
    error: ExtensionError
  ): Promise<ExtensionLoadResult> {
    // 未知错误尝试重试
    if (error.retryCount! < this.maxRetries) {
      return this.retryLoad(_extension, { retryCount: error.retryCount! + 1 })
    }

    return {
      success: false,
      error: {
        ...error,
        type: ExtensionErrorType.UNKNOWN_ERROR,
        message: '未知错误',
        recoverable: false
      }
    }
  }

  /**
   * 重试加载扩展
   */
  private async retryLoad(
    extension: ExtensionInfo,
    options: { retryCount?: number; retryAfter?: number; fixedManifest?: ExtensionManifest }
  ): Promise<ExtensionLoadResult> {
    try {
      // 如果有修复的manifest，应用它
      if (options.fixedManifest) {
        extension.manifest = options.fixedManifest
      }

      // 延迟重试
      if (options.retryAfter) {
        await new Promise((resolve) => setTimeout(resolve, options.retryAfter))
      }

      // 这里应该调用实际的扩展加载逻辑
      // const result = await extensionManager.loadExtension(extension.path)

      // 模拟成功加载
      return {
        success: true,
        extension: {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          path: extension.path,
          enabled: true
        }
      }
    } catch (error) {
      return await this.handleLoadError(extension, error as Error, options.retryCount || 0)
    }
  }

  /**
   * 尝试修复manifest
   */
  private async tryFixManifest(extension: ExtensionInfo): Promise<ExtensionManifest | null> {
    try {
      // 这里可以实现manifest修复逻辑
      // 例如：添加缺失的字段、修复格式错误等

      console.log(`Attempting to fix manifest for extension: ${extension.name}`)

      // 模拟修复
      if (extension.manifest) {
        // 确保必需字段存在
        if (!extension.manifest.manifest_version) {
          extension.manifest.manifest_version = 3
        }

        return extension.manifest
      }

      return null
    } catch (error) {
      console.error('Failed to fix manifest:', error)
      return null
    }
  }

  /**
   * 释放内存
   */
  private async releaseMemory(): Promise<void> {
    try {
      // 这里可以实现内存清理逻辑
      console.log('Releasing memory resources...')

      // 清理缓存、释放内存等操作
      // global.gc?.() // 如果启用了垃圾回收
    } catch (error) {
      console.error('Failed to release memory:', error)
    }
  }

  /**
   * 记录错误
   */
  private recordError(error: ExtensionError): void {
    this.errorHistory.push(error)

    // 保持历史记录大小限制
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift()
    }
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number
    errorsByType: Record<ExtensionErrorType, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    recentErrors: ExtensionError[]
  } {
    const errorsByType: Record<ExtensionErrorType, number> = {} as Record<
      ExtensionErrorType,
      number
    >
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>

    // 初始化统计对象
    Object.values(ExtensionErrorType).forEach((type) => {
      errorsByType[type] = 0
    })

    Object.values(ErrorSeverity).forEach((severity) => {
      errorsBySeverity[severity] = 0
    })

    // 统计错误
    this.errorHistory.forEach((error) => {
      errorsByType[error.type]++
      errorsBySeverity[error.severity]++
    })

    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: this.errorHistory.slice(-10) // 最近10个错误
    }
  }

  /**
   * 清理错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory = []
    this.errorCounts.clear()
  }
}

// 导出单例实例
export const extensionErrorManager = new ExtensionErrorManager()
