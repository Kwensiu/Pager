import { session, type Session } from 'electron'
import { ExtensionIsolationLevel, ExtensionInfo } from '../../shared/types/store'

// 向后兼容的导出
export const IsolationLevel = ExtensionIsolationLevel

export interface IsolationConfig {
  level: ExtensionIsolationLevel
  sessionPoolSize: number
  sessionIdleTimeout: number
  memoryLimit: number
  cpuLimit: number
  networkRestrictions: boolean
  fileAccessRestrictions: boolean
  scriptInjectionDetection: boolean
}

export interface ExtensionSession {
  id: string
  extensionId: string
  session: Session
  isolationLevel: ExtensionIsolationLevel
  createdAt: number
  lastUsed: number
  memoryUsage: number
  isActive: boolean
  restrictions: ExtensionRestrictions
}

export interface ExtensionRestrictions {
  allowedOrigins: string[]
  blockedOrigins: string[]
  allowedPermissions: string[]
  blockedPermissions: string[]
  scriptInjectionDetection: boolean
  networkRestrictions: boolean
  fileAccessRestrictions: boolean
  cpuLimit: number
  memoryLimit: number
}

/**
 * 扩展隔离管理器
 * 负责为每个扩展提供独立的会话和资源隔离
 */
export class ExtensionIsolationManager {
  private sessions: Map<string, ExtensionSession> = new Map()
  private sessionPool: Session[] = []
  private activeExtensions: Map<string, ExtensionSession> = new Map()
  private config: IsolationConfig
  private cleanupInterval: NodeJS.Timeout | null = null
  private sessionCounter: number = 0
  private requestHandlers = new Map<
    string,
    | ((
        details: Electron.OnBeforeRequestListenerDetails,
        callback: (response: { cancel: boolean }) => void
      ) => void)
    | ((
        details: Electron.OnBeforeSendHeadersListenerDetails,
        callback: (response: { requestHeaders: Record<string, string> }) => void
      ) => void)
    | ((
        details: Electron.OnHeadersReceivedListenerDetails,
        callback: (response: { responseHeaders: Record<string, string[]> }) => void
      ) => void)
    | ((
        webContents: Electron.WebContents,
        permission: string,
        callback: (allow: boolean) => void
      ) => void)
  >()
  private sessionPoolInitialized: boolean = false

  constructor(
    private logger: Console = console,
    config: Partial<IsolationConfig> = {}
  ) {
    this.config = {
      level: IsolationLevel.STANDARD,
      sessionPoolSize: 5,
      sessionIdleTimeout: 5 * 60 * 1000, // 5分钟
      memoryLimit: 100 * 1024 * 1024, // 100MB
      cpuLimit: 80, // 80%
      networkRestrictions: true,
      fileAccessRestrictions: true,
      scriptInjectionDetection: true,
      ...config
    }

    // 延迟初始化会话池，等待 app ready
    this.startCleanupTask()
  }

  /**
   * 创建扩展会话
   */
  async createExtensionSession(
    extension: ExtensionInfo,
    isolationLevel: ExtensionIsolationLevel = this.config.level
  ): Promise<ExtensionSession> {
    try {
      const sessionId = this.generateSessionId(extension.id)
      const session = this.getSessionFromPool()

      const extensionSession: ExtensionSession = {
        id: sessionId,
        extensionId: extension.id,
        session,
        isolationLevel,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        memoryUsage: 0,
        isActive: true,
        restrictions: await this.createRestrictions(extension, isolationLevel)
      }

      // 配置会话隔离
      await this.configureSessionIsolation(session, extensionSession.restrictions, sessionId)

      // 存储会话
      this.sessions.set(sessionId, extensionSession)
      this.activeExtensions.set(extension.id, extensionSession)

      this.logger.info(`Created isolated session for extension: ${extension.name}`, {
        sessionId,
        extensionId: extension.id,
        isolationLevel
      })

      return extensionSession
    } catch (error) {
      this.logger.error(`Failed to create extension session:`, error)
      throw new Error(`无法创建扩展会话: ${(error as Error).message}`)
    }
  }

  /**
   * 获取扩展会话
   */
  getExtensionSession(extensionId: string): ExtensionSession | undefined {
    return this.activeExtensions.get(extensionId)
  }

  /**
   * 销毁扩展会话
   */
  async destroyExtensionSession(extensionId: string): Promise<void> {
    const extensionSession = this.activeExtensions.get(extensionId)
    if (!extensionSession) {
      this.logger.warn(`Extension session not found: ${extensionId}`)
      return
    }

    try {
      // 清理会话资源
      await this.cleanupSessionResources(extensionSession)

      // 从活动列表中移除
      this.activeExtensions.delete(extensionId)
      this.sessions.delete(extensionSession.id)

      // 将会话返回到池中
      this.returnSessionToPool(extensionSession.session)

      this.logger.info(`Destroyed extension session: ${extensionId}`)
    } catch (error) {
      this.logger.error(`Failed to destroy extension session:`, error)
    }
  }

  /**
   * 更新会话使用状态
   */
  updateSessionUsage(extensionId: string): void {
    const extensionSession = this.activeExtensions.get(extensionId)
    if (extensionSession) {
      extensionSession.lastUsed = Date.now()
    }
  }

  /**
   * 获取会话使用统计
   */
  async getSessionStats(): Promise<{
    totalSessions: number
    activeSessions: number
    idleSessions: number
    memoryUsage: number
    sessionsByIsolationLevel: Record<ExtensionIsolationLevel, number>
  }> {
    const sessionsByIsolationLevel: Record<ExtensionIsolationLevel, number> = {} as Record<
      ExtensionIsolationLevel,
      number
    >

    // 初始化统计对象
    Object.values(ExtensionIsolationLevel).forEach((level) => {
      sessionsByIsolationLevel[level] = 0
    })

    let totalMemoryUsage = 0
    let activeSessions = 0
    let idleSessions = 0

    for (const session of this.sessions.values()) {
      sessionsByIsolationLevel[session.isolationLevel]++
      totalMemoryUsage += session.memoryUsage

      if (session.isActive) {
        activeSessions++
      } else {
        idleSessions++
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      idleSessions,
      memoryUsage: totalMemoryUsage,
      sessionsByIsolationLevel
    }
  }

  /**
   * 配置会话隔离
   */
  private async configureSessionIsolation(
    session: Session,
    restrictions: ExtensionRestrictions,
    sessionId: string
  ): Promise<void> {
    // 配置网络限制
    if (restrictions.networkRestrictions) {
      const beforeRequestHandler = (
        details: Electron.OnBeforeRequestListenerDetails,
        callback: (response: { cancel: boolean }) => void
      ): void => {
        const shouldBlock = this.shouldBlockRequest(details.url, restrictions)
        callback({ cancel: shouldBlock })
      }

      const beforeSendHeadersHandler = (
        details: Electron.OnBeforeSendHeadersListenerDetails,
        callback: (response: { requestHeaders: Record<string, string> }) => void
      ): void => {
        callback({ requestHeaders: details.requestHeaders })
      }

      session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, beforeRequestHandler)

      session.webRequest.onBeforeSendHeaders({ urls: ['<all_urls>'] }, beforeSendHeadersHandler)

      // 存储处理器引用以便后续清理
      this.requestHandlers.set(`${sessionId}-beforeRequest`, beforeRequestHandler)
      this.requestHandlers.set(`${sessionId}-beforeSendHeaders`, beforeSendHeadersHandler)
    }

    // 配置权限限制
    const permissionHandler = (
      _webContents: Electron.WebContents,
      permission: string,
      callback: (allow: boolean) => void
    ): void => {
      if (permission === 'unlimitedStorage') {
        callback(false) // 拒绝无限存储权限
      } else {
        const isAllowed = this.isPermissionAllowed(permission, restrictions)
        callback(isAllowed)
      }
    }

    session.setPermissionRequestHandler(permissionHandler)
    this.requestHandlers.set(`${sessionId}-permission`, permissionHandler)

    // 配置脚本注入检测
    if (restrictions.scriptInjectionDetection) {
      const headersReceivedHandler = (
        details: Electron.OnHeadersReceivedListenerDetails,
        callback: (response: { responseHeaders: Record<string, string[]> }) => void
      ): void => {
        const modifiedHeaders = this.detectAndBlockScriptInjection(details.responseHeaders)
        callback({ responseHeaders: modifiedHeaders })
      }

      session.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, headersReceivedHandler)

      this.requestHandlers.set(`${sessionId}-headersReceived`, headersReceivedHandler)
    }
  }

  /**
   * 创建限制配置
   */
  private async createRestrictions(
    extension: ExtensionInfo,
    isolationLevel: ExtensionIsolationLevel
  ): Promise<ExtensionRestrictions> {
    const restrictions: ExtensionRestrictions = {
      allowedOrigins: [],
      blockedOrigins: [],
      allowedPermissions: [],
      blockedPermissions: [],
      scriptInjectionDetection: this.config.scriptInjectionDetection,
      networkRestrictions: this.config.networkRestrictions,
      fileAccessRestrictions: this.config.fileAccessRestrictions,
      cpuLimit: this.config.cpuLimit,
      memoryLimit: this.config.memoryLimit
    }

    // 根据隔离级别调整限制
    switch (isolationLevel) {
      case IsolationLevel.STRICT:
        restrictions.blockedOrigins = ['<all_urls>']
        restrictions.blockedPermissions = [
          'tabs',
          'webRequest',
          'webRequestBlocking',
          'proxy',
          'nativeMessaging',
          'debugger'
          // 移除 'management' 权限，允许扩展访问自己的选项页面
        ]
        restrictions.networkRestrictions = true
        restrictions.fileAccessRestrictions = true
        restrictions.memoryLimit = this.config.memoryLimit * 0.5 // 限制内存使用
        restrictions.cpuLimit = this.config.cpuLimit * 0.5 // 限制CPU使用
        break

      case IsolationLevel.STANDARD:
        // 标准级别，允许基本权限但限制敏感操作
        restrictions.blockedOrigins = ['file:///*']
        // 移除 'chrome://*' 阻止，允许扩展访问自己的 chrome-extension:// 页面
        restrictions.blockedPermissions = ['nativeMessaging', 'debugger']
        // 移除 'management' 权限，允许扩展访问自己的选项页面
        restrictions.networkRestrictions = true
        restrictions.fileAccessRestrictions = true
        break

      case IsolationLevel.RELAXED:
        // 宽松级别，允许更多权限
        restrictions.blockedOrigins = ['file:///*']
        restrictions.blockedPermissions = ['debugger']
        restrictions.networkRestrictions = false
        restrictions.fileAccessRestrictions = false
        break

      case IsolationLevel.NONE:
        // 无隔离，完全信任
        restrictions.blockedOrigins = []
        restrictions.blockedPermissions = []
        restrictions.networkRestrictions = false
        restrictions.fileAccessRestrictions = false
        break
    }

    // 添加扩展特定的权限
    if (extension.manifest?.permissions) {
      restrictions.allowedPermissions = extension.manifest.permissions.filter(
        (perm) => !restrictions.blockedPermissions.includes(perm)
      )
    }

    // 允许扩展访问自己的 chrome-extension:// URL
    const extensionUrl = `chrome-extension://${extension.id}/*`
    if (!restrictions.allowedOrigins.includes(extensionUrl)) {
      restrictions.allowedOrigins.push(extensionUrl)
    }

    return restrictions
  }

  /**
   * 检查是否应该阻止请求
   */
  private shouldBlockRequest(url: string, restrictions: ExtensionRestrictions): boolean {
    if (!restrictions.networkRestrictions) {
      return false
    }

    // 首先检查是否在允许列表中
    for (const allowedOrigin of restrictions.allowedOrigins) {
      if (this.urlMatchesPattern(url, allowedOrigin)) {
        return false
      }
    }

    // 然后检查是否在阻止列表中
    for (const blockedOrigin of restrictions.blockedOrigins) {
      if (this.urlMatchesPattern(url, blockedOrigin)) {
        return true
      }
    }

    return false
  }

  /**
   * 检查权限是否允许
   */
  private isPermissionAllowed(permission: string, restrictions: ExtensionRestrictions): boolean {
    if (restrictions.blockedPermissions.includes(permission)) {
      return false
    }

    if (restrictions.allowedPermissions.includes(permission)) {
      return true
    }

    return false
  }

  /**
   * 检测并阻止脚本注入
   */
  private detectAndBlockScriptInjection(
    headers: Record<string, string[]> | undefined
  ): Record<string, string[]> {
    if (!headers) {
      return headers || {}
    }

    const filteredHeaders: Record<string, string[]> = {}

    for (const [name, values] of Object.entries(headers)) {
      const lowerName = name.toLowerCase()

      // 检测常见的脚本注入模式
      const injectionPatterns = [
        /javascript:/,
        /data:text\/html/,
        /data:text\/javascript/,
        /data:application\/javascript/
      ]

      if (lowerName === 'content-type') {
        const hasInjection = values.some((value) =>
          injectionPatterns.some((pattern) => pattern.test(value))
        )

        if (!hasInjection) {
          filteredHeaders[name] = values
        }
      } else {
        filteredHeaders[name] = values
      }
    }

    return filteredHeaders
  }

  /**
   * 检查URL是否匹配模式
   */
  private urlMatchesPattern(url: string, pattern: string): boolean {
    if (pattern === '<all_urls>') {
      return true
    }

    // 简单的URL匹配逻辑
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(url)
  }

  /**
   * 清理会话资源
   */
  private async cleanupSessionResources(extensionSession: ExtensionSession): Promise<void> {
    try {
      // 清理网络请求监听器
      const sessionId = extensionSession.id

      // 移除之前注册的处理器
      const handlers = [
        `${sessionId}-beforeRequest`,
        `${sessionId}-beforeSendHeaders`,
        `${sessionId}-headersReceived`,
        `${sessionId}-permission`
      ]

      for (const handlerKey of handlers) {
        const handler = this.requestHandlers.get(handlerKey)
        if (handler) {
          // Electron的session API没有直接提供移除特定处理器的方法
          // 我们需要重新创建会话来完全清理
          this.requestHandlers.delete(handlerKey)
        }
      }

      // 清理存储数据
      await extensionSession.session.clearStorageData()

      // 重置会话状态
      extensionSession.isActive = false
      extensionSession.memoryUsage = 0

      this.logger.info(`Cleaned up session resources for: ${extensionSession.extensionId}`)
    } catch (error) {
      this.logger.error(`Failed to cleanup session resources:`, error)
    }
  }

  /**
   * 初始化会话池
   */
  public initializeSessionPool(): void {
    for (let i = 0; i < this.config.sessionPoolSize; i++) {
      // 使用持久化分区名称，避免临时会话问题
      const partitionName = `persist:extension-pool-${i}`
      const poolSession = session.fromPartition(partitionName, { cache: false })
      this.sessionPool.push(poolSession)
    }
  }

  /**
   * 从池中获取会话
   */
  private getSessionFromPool(): Session {
    // 懒加载会话池
    if (!this.sessionPoolInitialized) {
      this.initializeSessionPool()
      this.sessionPoolInitialized = true
    }

    if (this.sessionPool.length > 0) {
      return this.sessionPool.pop()!
    }

    // 如果池为空，创建新会话 - 使用持久化分区
    const partitionName = `persist:extension-${this.sessionCounter++}`
    const sess = session.fromPartition(partitionName, {
      cache: true
    })

    // 不添加到池中，因为这是一个新的专用会话
    return sess
  }
  /**
   * 将会话返回到池中
   */
  private returnSessionToPool(session: Session): void {
    if (this.sessionPool.length < this.config.sessionPoolSize) {
      this.sessionPool.push(session)
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(extensionId: string): string {
    return `${extensionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 启动清理任务
   */
  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions()
    }, 60000) // 每分钟清理一次
  }

  /**
   * 清理空闲会话
   */
  private cleanupIdleSessions(): void {
    const now = Date.now()
    const idleTimeout = this.config.sessionIdleTimeout

    for (const session of this.sessions.values()) {
      const idleTime = now - session.lastUsed
      if (idleTime > idleTimeout && !session.isActive) {
        this.destroyExtensionSession(session.extensionId)
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<IsolationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 获取当前配置
   */
  getConfig(): IsolationConfig {
    return { ...this.config }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    // 清理所有会话
    for (const extensionId of this.activeExtensions.keys()) {
      this.destroyExtensionSession(extensionId)
    }

    // 清理会话池
    this.sessionPool = []
    this.requestHandlers.clear()
  }
}

// 导出单例实例
export const extensionIsolationManager = new ExtensionIsolationManager()
