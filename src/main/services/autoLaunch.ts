import { app } from 'electron'

/**
 * 自动启动服务
 * 管理应用的开机自启动功能
 */
class AutoLaunchService {
  private isInitialized = false
  private readonly isDev =
    process.env.NODE_ENV === 'development' || !!process.env.ELECTRON_RENDERER_URL
  private readonly platform = process.platform
  private statusListeners: Array<(enabled: boolean) => void> = []

  /**
   * 初始化自动启动服务
   */
  initialize(): void {
    if (this.isInitialized) return

    try {
      // 检查当前启动设置
      app.getLoginItemSettings()
      this.isInitialized = true
    } catch (error) {
      console.error('Failed to initialize auto-launch service:', error)
      throw new Error(
        `Auto-launch service initialization failed: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 检查当前环境是否支持自动启动
   */
  isEnvironmentSupported(): boolean {
    // 开发环境通常不支持自动启动
    if (this.isDev) {
      console.warn('Auto-launch is not supported in development environment')
      return false
    }

    // 检查平台支持
    const supportedPlatforms = ['win32', 'darwin', 'linux']
    if (!supportedPlatforms.includes(this.platform)) {
      console.warn(`Auto-launch is not supported on platform: ${this.platform}`)
      return false
    }

    return true
  }

  /**
   * 获取平台特定的错误信息
   */
  private getPlatformErrorMessage(error: unknown): string {
    const baseError = error instanceof Error ? error.message : String(error)

    if (this.platform === 'win32') {
      return `Windows auto-launch error: ${baseError}. Please check registry permissions.`
    } else if (this.platform === 'darwin') {
      return `macOS auto-launch error: ${baseError}. Please check Login Items in System Settings.`
    } else if (this.platform === 'linux') {
      return `Linux auto-launch error: ${baseError}. Please check autostart directory permissions.`
    }

    return `Auto-launch error: ${baseError}`
  }

  /**
   * 启用开机自启动
   * @param args 启动参数（可选）
   */
  enable(args?: string[]): boolean {
    try {
      // 环境检查
      if (!this.isEnvironmentSupported()) {
        console.warn('Cannot enable auto-launch: environment not supported')
        return false
      }

      this.initialize()

      // 验证启动参数
      if (args) {
        const validation = this.validateLaunchArgs(args)
        if (!validation.valid) {
          console.error('Invalid launch arguments:', validation.errors)
          return false
        }
      }

      const launchSettings: Electron.Settings = {
        openAtLogin: true,
        openAsHidden: false,
        ...(args && args.length > 0 ? { args } : {})
      }

      app.setLoginItemSettings(launchSettings)
      console.log('Auto-launch enabled')

      // 通知状态变化
      this.notifyStatusChange(true)

      return true
    } catch (error) {
      const errorMessage = this.getPlatformErrorMessage(error)
      console.error('Failed to enable auto-launch:', errorMessage)
      return false
    }
  }

  /**
   * 禁用开机自启动
   */
  disable(): boolean {
    try {
      // 环境检查
      if (!this.isEnvironmentSupported()) {
        console.warn('Cannot disable auto-launch: environment not supported')
        return false
      }

      this.initialize()

      app.setLoginItemSettings({
        openAtLogin: false
      })
      console.log('Auto-launch disabled')

      // 通知状态变化
      this.notifyStatusChange(false)

      return true
    } catch (error) {
      const errorMessage = this.getPlatformErrorMessage(error)
      console.error('Failed to disable auto-launch:', errorMessage)
      return false
    }
  }

  /**
   * 检查是否已启用开机自启动
   */
  isEnabled(): boolean {
    try {
      // 环境检查
      if (!this.isEnvironmentSupported()) {
        return false
      }

      this.initialize()
      const settings = app.getLoginItemSettings()
      return settings.openAtLogin
    } catch (error) {
      const errorMessage = this.getPlatformErrorMessage(error)
      console.error('Failed to check auto-launch status:', errorMessage)
      return false
    }
  }

  /**
   * 切换开机自启动状态
   */
  toggle(): boolean {
    if (this.isEnabled()) {
      return this.disable()
    } else {
      return this.enable()
    }
  }

  /**
   * 获取启动项设置详情
   */
  getSettings(): Electron.LoginItemSettings {
    try {
      this.initialize()
      return app.getLoginItemSettings()
    } catch (error) {
      console.error('Failed to get auto-launch settings:', error)
      // 返回一个符合 Electron LoginItemSettings 接口的最小对象
      const minimalSettings: Partial<Electron.LoginItemSettings> = {
        openAtLogin: false,
        openAsHidden: false,
        wasOpenedAtLogin: false,
        wasOpenedAsHidden: false,
        restoreState: false
      }
      return minimalSettings as Electron.LoginItemSettings
    }
  }

  /**
   * 设置启动时隐藏窗口
   * @param hidden 是否隐藏
   */
  setLaunchHidden(hidden: boolean): boolean {
    try {
      this.initialize()

      const currentSettings = this.getSettings()
      app.setLoginItemSettings({
        openAtLogin: currentSettings.openAtLogin,
        openAsHidden: hidden
      })
      console.log(`Auto-launch hidden mode set to: ${hidden}`)
      return true
    } catch (error) {
      console.error('Failed to set launch hidden mode:', error)
      return false
    }
  }

  /**
   * 设置启动参数
   * @param args 启动参数数组
   */
  setLaunchArgs(args: string[]): boolean {
    try {
      this.initialize()

      const currentSettings = this.getSettings()
      app.setLoginItemSettings({
        openAtLogin: currentSettings.openAtLogin,
        openAsHidden: currentSettings.openAsHidden,
        ...(args && args.length > 0 ? { args } : {})
      })
      console.log('Auto-launch arguments updated:', args)
      return true
    } catch (error) {
      console.error('Failed to set launch arguments:', error)
      return false
    }
  }

  /**
   * 检查应用是否由启动项打开
   */
  wasLaunchedAtLogin(): boolean {
    try {
      this.initialize()
      const settings = app.getLoginItemSettings()
      return settings.wasOpenedAtLogin || false
    } catch (error) {
      console.error('Failed to check if launched at login:', error)
      return false
    }
  }

  /**
   * 检查应用是否以隐藏模式打开
   */
  wasLaunchedAsHidden(): boolean {
    try {
      this.initialize()
      const settings = app.getLoginItemSettings()
      return settings.wasOpenedAsHidden || false
    } catch (error) {
      console.error('Failed to check if launched as hidden:', error)
      return false
    }
  }

  /**
   * 获取支持的启动项设置
   */
  getSupportedSettings(): {
    supportsOpenAtLogin: boolean
    supportsOpenAsHidden: boolean
    supportsArgs: boolean
  } {
    try {
      this.initialize()
      // 检查 Electron 版本是否支持这些功能
      const settings = app.getLoginItemSettings()

      return {
        supportsOpenAtLogin: true, // Electron 通常都支持
        supportsOpenAsHidden: 'openAsHidden' in settings,
        supportsArgs: 'args' in settings
      }
    } catch (error) {
      console.error('Failed to get supported settings:', error)
      return {
        supportsOpenAtLogin: true,
        supportsOpenAsHidden: false,
        supportsArgs: false
      }
    }
  }

  /**
   * 验证启动参数
   * @param args 启动参数
   */
  validateLaunchArgs(args: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!Array.isArray(args)) {
      errors.push('启动参数必须是数组')
      return { valid: false, errors }
    }

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (typeof arg !== 'string') {
        errors.push(`参数 ${i} 必须是字符串`)
      } else if (arg.length > 1000) {
        errors.push(`参数 ${i} 过长（最大 1000 字符）`)
      } else if (arg.includes('--') && arg.startsWith('--')) {
        // 检查是否包含敏感参数
        const sensitiveArgs = ['--inspect', '--remote-debugging-port', '--no-sandbox']
        if (sensitiveArgs.some((sa) => arg.includes(sa))) {
          errors.push(`参数 ${i} 包含敏感选项: ${arg}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 获取默认启动参数
   */
  getDefaultLaunchArgs(): string[] {
    return ['--autostart']
  }

  /**
   * 添加状态监听器
   * @param listener 状态变化监听器
   */
  addStatusListener(listener: (enabled: boolean) => void): void {
    this.statusListeners.push(listener)
  }

  /**
   * 移除状态监听器
   * @param listener 要移除的监听器
   */
  removeStatusListener(listener: (enabled: boolean) => void): void {
    const index = this.statusListeners.indexOf(listener)
    if (index > -1) {
      this.statusListeners.splice(index, 1)
    }
  }

  /**
   * 通知状态变化
   * @param enabled 新的启用状态
   */
  private notifyStatusChange(enabled: boolean): void {
    this.statusListeners.forEach((listener) => {
      try {
        listener(enabled)
      } catch (error) {
        console.error('Error in status listener:', error)
      }
    })
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.statusListeners = []
    this.isInitialized = false
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo(): {
    platform: string
    isDev: boolean
    isSupported: boolean
    electronVersion: string
  } {
    return {
      platform: this.platform,
      isDev: this.isDev,
      isSupported: this.isEnvironmentSupported(),
      electronVersion: process.versions.electron
    }
  }

  /**
   * 获取自动启动状态报告
   */
  getStatusReport(): {
    enabled: boolean
    hidden: boolean
    hasArgs: boolean
    wasLaunchedAtLogin: boolean
    wasLaunchedAsHidden: boolean
    supportedSettings: {
      openAtLogin: boolean
      openAsHidden: boolean
      args: boolean
    }
  } {
    const settings = this.getSettings()
    const supported = this.getSupportedSettings()

    return {
      enabled: settings.openAtLogin || false,
      hidden: settings.openAsHidden || false,
      hasArgs: 'args' in settings && Array.isArray(settings.args) && settings.args.length > 0,
      wasLaunchedAtLogin: settings.wasOpenedAtLogin || false,
      wasLaunchedAsHidden: settings.wasOpenedAsHidden || false,
      supportedSettings: {
        openAtLogin: supported.supportsOpenAtLogin,
        openAsHidden: supported.supportsOpenAsHidden,
        args: supported.supportsArgs
      }
    }
  }
}

// 导出单例实例
export const autoLaunchService = new AutoLaunchService()
