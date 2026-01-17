import { globalShortcut } from 'electron'
import type { Shortcut } from '../../shared/types/store'
import { windowManager } from './windowManager'

/**
 * 全局快捷键服务
 * 管理应用内和全局快捷键的注册、注销和执行
 */
export class ShortcutService {
  private mainWindow: Electron.BrowserWindow | null = null
  private shortcuts: Map<string, Shortcut> = new Map()
  private callbacks: Map<string, () => void> = new Map()
  private executingShortcuts: Set<string> = new Set() // 正在执行的快捷键
  private refreshShortcutRegistered: boolean = false // 刷新快捷键是否已注册

  constructor() {
    // 初始化时不设置默认回调
  }

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: Electron.BrowserWindow): void {
    this.mainWindow = window

    // 监听窗口焦点变化
    window.on('focus', () => {
      // 延迟一点注册，避免与其他快捷键冲突
      setTimeout(() => {
        this.registerRefreshShortcut()
        this.registerCopyUrlShortcut()
      }, 100)
    })

    window.on('blur', () => {
      // 立即注销
      this.unregisterRefreshShortcut()
      this.unregisterCopyUrlShortcut()
    })
  }

  /**
   * 注册刷新快捷键（半全局模式）
   */
  private registerRefreshShortcut(): void {
    if (this.refreshShortcutRegistered || !this.mainWindow) return

    const refreshShortcut = Array.from(this.shortcuts.values()).find((s) => s.id === 'refresh-page')
    if (refreshShortcut && refreshShortcut.isOpen) {
      const callback = this.createShortcutCallback('refresh-page')
      const success = globalShortcut.register(refreshShortcut.cmd, callback)
      if (success) {
        this.refreshShortcutRegistered = true
      }
    }
  }

  /**
   * 注册复制URL快捷键（半全局模式）
   */
  private registerCopyUrlShortcut(): void {
    if (!this.mainWindow) return

    const copyUrlShortcut = Array.from(this.shortcuts.values()).find((s) => s.id === 'copy-url')
    if (copyUrlShortcut && copyUrlShortcut.isOpen) {
      const callback = this.createShortcutCallback('copy-url')
      const success = globalShortcut.register(copyUrlShortcut.cmd, callback)
      if (success) {
        // 注册成功
      }
    }
  }

  /**
   * 注销刷新快捷键（半全局模式）
   */
  private unregisterRefreshShortcut(): void {
    if (!this.refreshShortcutRegistered) return

    const refreshShortcut = Array.from(this.shortcuts.values()).find((s) => s.id === 'refresh-page')
    if (refreshShortcut) {
      globalShortcut.unregister(refreshShortcut.cmd)
      this.refreshShortcutRegistered = false
    }
  }

  /**
   * 注销复制URL快捷键（半全局模式）
   */
  private unregisterCopyUrlShortcut(): void {
    const copyUrlShortcut = Array.from(this.shortcuts.values()).find((s) => s.id === 'copy-url')
    if (copyUrlShortcut) {
      globalShortcut.unregister(copyUrlShortcut.cmd)
    }
  }

  /**
   * 创建快捷键回调
   */
  createShortcutCallback(shortcutId: string): () => void {
    return () => {
      if (!this.mainWindow) return

      // 检查是否正在执行中
      if (this.executingShortcuts.has(shortcutId)) {
        return
      }

      // 标记为正在执行
      this.executingShortcuts.add(shortcutId)

      const window = this.mainWindow
      const actionMap: Record<string, () => void> = {
        'toggle-window': () => {
          if (window.isVisible()) {
            window.hide()
          } else {
            window.show()
          }
        },
        'toggle-sidebar': () => {
          // 已移除：现在直接在渲染进程内执行
        },
        'open-settings': () => {
          // 已移除：现在直接在渲染进程内执行
        },
        'switch-website': () => {
          // 已删除：切换站点功能不存在
        },
        'toggle-always-on-top': () => {
          try {
            // 直接操作窗口，不通过 windowManager
            if (!this.mainWindow) return

            const currentState = this.mainWindow.isAlwaysOnTop()
            const newState = !currentState
            this.mainWindow.setAlwaysOnTop(newState)

            // 发送状态变化事件到渲染进程
            this.mainWindow.webContents.send('window-manager:always-on-top-changed', newState)
          } catch {
            // Silent fail
          }
        },
        'refresh-page': () => {
          // 直接发送到渲染进程，与toggle-sidebar相同的逻辑
          window.webContents.send('window-manager:refresh-page')
        },
        'copy-url': () => {
          // 直接发送到渲染进程
          window.webContents.send('window-manager:copy-url')
        },
        'minimize-window': () => {
          windowManager.minimizeWindow()
        },
        'maximize-window': () => {
          windowManager.maximizeWindow()
        },
        'left-mini-window': () => {
          // 已删除：屏幕左边小窗功能不存在
        },
        'right-mini-window': () => {
          // 已删除：屏幕右边小窗功能不存在
        },
        'exit-app': () => {
          // 直接在主进程中退出应用
          if (this.mainWindow) {
            this.mainWindow.close()
          }
        }
      }

      const action = actionMap[shortcutId]
      if (action) {
        action()
      }

      // 延迟清除执行标志，确保按键释放完成
      setTimeout(() => {
        this.executingShortcuts.delete(shortcutId)
      }, 100)
    }
  }

  /**
   * 注册快捷键
   * @param shortcut 快捷键配置
   * @param callback 快捷键触发时的回调函数
   * @returns 是否注册成功
   */
  register(shortcut: Shortcut, callback: () => void): boolean {
    if (!shortcut.isOpen) {
      return false
    }

    // 如果快捷键已经存在，先注销再重新注册
    if (this.shortcuts.has(shortcut.cmd)) {
      this.unregister(shortcut.cmd)
    }

    try {
      if (shortcut.isGlobal) {
        // 注册全局快捷键
        const success = globalShortcut.register(shortcut.cmd, callback)

        if (success) {
          this.shortcuts.set(shortcut.cmd, shortcut)
          this.callbacks.set(shortcut.cmd, callback)
          return true
        } else {
          return false
        }
      } else {
        // 注册应用内快捷键
        this.shortcuts.set(shortcut.cmd, shortcut)
        this.callbacks.set(shortcut.cmd, callback)
        return true
      }
    } catch {
      return false
    }
  }

  /**
   * 注销快捷键
   * @param cmd 快捷键命令字符串
   * @returns 是否注销成功
   */
  unregister(cmd: string): boolean {
    try {
      const shortcut = this.shortcuts.get(cmd)
      if (!shortcut) {
        return false
      }

      if (shortcut.isGlobal) {
        // 注销全局快捷键
        globalShortcut.unregister(cmd)
      }
      // 应用内快捷键不需要特殊处理

      this.shortcuts.delete(cmd)
      // 对于应用内快捷键，不删除回调，因为回调是动态创建的
      if (shortcut.isGlobal) {
        this.callbacks.delete(cmd)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * 注销所有快捷键
   */
  unregisterAll(): void {
    try {
      globalShortcut.unregisterAll()
      this.shortcuts.clear()
      this.callbacks.clear()
    } catch {
      // Silent fail
    }
  }

  /**
   * 检查快捷键是否已注册
   * @param cmd 快捷键命令字符串
   */
  isRegistered(cmd: string): boolean {
    return this.shortcuts.has(cmd)
  }

  /**
   * 获取所有已注册的快捷键
   */
  getAllShortcuts(): Shortcut[] {
    return Array.from(this.shortcuts.values())
  }

  /**
   * 根据命令字符串获取快捷键
   * @param cmd 快捷键命令字符串
   */
  getShortcutByCommand(cmd: string): Shortcut | undefined {
    return this.shortcuts.get(cmd)
  }

  /**
   * 获取快捷键回调
   * @param cmd 快捷键命令字符串
   */
  getCallback(cmd: string): (() => void) | undefined {
    return this.callbacks.get(cmd)
  }

  /**
   * 更新快捷键配置
   * @param shortcut 新的快捷键配置
   * @returns 是否更新成功
   */
  update(shortcut: Shortcut): boolean {
    const oldShortcut = this.findShortcutById(shortcut.id)

    // 如果没有旧快捷键，添加新配置
    if (!oldShortcut) {
      return this.addNewShortcut(shortcut)
    }

    // 处理快捷键命令变化
    if (oldShortcut.cmd !== shortcut.cmd) {
      return this.handleShortcutCommandChange(oldShortcut, shortcut)
    }

    // 处理启用/禁用状态变化
    return this.handleShortcutStateChange(oldShortcut, shortcut)
  }

  /**
   * 根据ID查找快捷键
   */
  private findShortcutById(id: string): Shortcut | undefined {
    for (const [, shortcut] of this.shortcuts.entries()) {
      if (shortcut.id === id) {
        return shortcut
      }
    }
    return undefined
  }

  /**
   * 添加新快捷键
   */
  private addNewShortcut(shortcut: Shortcut): boolean {
    if (shortcut.isOpen) {
      return this.register(shortcut, this.createShortcutCallback(shortcut.id))
    } else {
      this.shortcuts.set(shortcut.cmd, shortcut)
      return true
    }
  }

  /**
   * 处理快捷键命令变化
   */
  private handleShortcutCommandChange(oldShortcut: Shortcut, newShortcut: Shortcut): boolean {
    this.unregister(oldShortcut.cmd)

    if (newShortcut.isOpen) {
      const callback = this.createShortcutCallback(newShortcut.id)
      return this.register(newShortcut, callback)
    } else {
      this.shortcuts.set(newShortcut.cmd, newShortcut)
      return true
    }
  }

  /**
   * 处理快捷键状态变化（启用/禁用）
   */
  private handleShortcutStateChange(oldShortcut: Shortcut, newShortcut: Shortcut): boolean {
    // 更新配置
    this.shortcuts.set(newShortcut.cmd, newShortcut)

    // 从禁用变为启用
    if (newShortcut.isOpen && !oldShortcut.isOpen) {
      const callback = this.createShortcutCallback(newShortcut.id)
      return this.register(newShortcut, callback)
    }

    // 从启用变为禁用
    if (!newShortcut.isOpen && oldShortcut.isOpen) {
      this.unregisterShortcut(newShortcut)
    }

    return true
  }

  /**
   * 注销快捷键（内部方法）
   */
  private unregisterShortcut(shortcut: Shortcut): void {
    if (shortcut.isGlobal) {
      globalShortcut.unregister(shortcut.cmd)
    }
    this.callbacks.delete(shortcut.cmd)
  }

  /**
   * 执行快捷键回调
   * @param cmd 快捷键命令字符串
   */
  execute(cmd: string): void {
    const callback = this.callbacks.get(cmd)
    if (callback) {
      try {
        callback()
      } catch {
        // Silent fail
      }
    }
  }

  /**
   * 验证快捷键命令格式
   * @param cmd 快捷键命令字符串
   */
  validateCommand(cmd: string): boolean {
    if (!cmd || typeof cmd !== 'string') return false

    // 基本格式验证
    const parts = cmd.split('+')
    if (parts.length < 2) return false

    // 检查修饰键
    const validModifiers = [
      'Command',
      'Cmd',
      'Control',
      'Ctrl',
      'CommandOrControl',
      'CmdOrCtrl',
      'Alt',
      'Option',
      'Shift'
    ]
    const modifiers = parts.slice(0, -1)

    for (const modifier of modifiers) {
      if (!validModifiers.includes(modifier)) return false
    }

    return true
  }

  /**
   * 检查快捷键是否与其他快捷键冲突
   * @param cmd 快捷键命令字符串
   * @param excludeId 排除的快捷键ID（用于编辑时检查）
   */
  checkConflict(cmd: string, excludeId?: string): Shortcut | null {
    for (const [existingCmd, shortcut] of this.shortcuts.entries()) {
      if (existingCmd === cmd && shortcut.id !== excludeId) {
        return shortcut
      }
    }
    return null
  }

  /**
   * 获取所有快捷键冲突
   * @param shortcuts 要检查的快捷键列表
   */
  getAllConflicts(shortcuts: Shortcut[]): Array<{ shortcut: Shortcut; conflicts: Shortcut[] }> {
    const conflicts: Array<{ shortcut: Shortcut; conflicts: Shortcut[] }> = []

    for (const shortcut of shortcuts) {
      const conflictingShortcuts: Shortcut[] = []

      for (const [existingCmd, existingShortcut] of this.shortcuts.entries()) {
        if (existingCmd === shortcut.cmd && existingShortcut.id !== shortcut.id) {
          conflictingShortcuts.push(existingShortcut)
        }
      }

      // 检查列表内部的冲突
      for (const otherShortcut of shortcuts) {
        if (otherShortcut.cmd === shortcut.cmd && otherShortcut.id !== shortcut.id) {
          conflictingShortcuts.push(otherShortcut)
        }
      }

      if (conflictingShortcuts.length > 0) {
        conflicts.push({
          shortcut,
          conflicts: [...new Set(conflictingShortcuts)] // 去重
        })
      }
    }

    return conflicts
  }

  /**
   * 获取默认快捷键配置
   */
  getDefaultShortcuts(): Shortcut[] {
    return [
      {
        id: 'toggle-window',
        name: 'softwareWindowVisibilityController',
        tag: '软件窗口[切换]',
        cmd: 'Ctrl+H',
        isGlobal: true,
        isOpen: false // 默认关闭
      },
      {
        id: 'toggle-always-on-top',
        name: 'windowTopmostToggle',
        tag: '窗口顶置[切换]',
        cmd: 'Ctrl+Alt+T',
        isGlobal: true,
        isOpen: false // 默认关闭
      },
      {
        id: 'toggle-sidebar',
        name: 'isMenuVisible',
        tag: '侧边导航[切换]',
        cmd: 'Ctrl+B',
        isGlobal: false,
        isOpen: false // 默认关闭
      },
      {
        id: 'open-settings',
        name: 'softwareSetting',
        tag: '设置界面[切换]',
        cmd: 'Ctrl+S',
        isGlobal: false,
        isOpen: false // 默认关闭
      },
      {
        id: 'refresh-page',
        name: 'refreshPage',
        tag: '刷新当前页面',
        cmd: 'Alt+R',
        isGlobal: false,
        isOpen: false // 默认关闭
      },
      {
        id: 'copy-url',
        name: 'getCurrentPageUrl',
        tag: '获取当前页URL',
        cmd: 'Ctrl+Shift+L',
        isGlobal: false,
        isOpen: false // 默认关闭
      },
      {
        id: 'minimize-window',
        name: 'windowMinimize',
        tag: '最小化窗口',
        cmd: 'Ctrl+M',
        isGlobal: false,
        isOpen: false // 默认关闭
      },
      {
        id: 'maximize-window',
        name: 'windowMaximizer',
        tag: '最大化窗口',
        cmd: 'Ctrl+Shift+M',
        isGlobal: true,
        isOpen: false // 默认关闭
      },
      {
        id: 'exit-app',
        name: 'softwareExit',
        tag: '退出软件',
        cmd: 'Ctrl+Shift+Q',
        isGlobal: false,
        isOpen: false // 默认关闭
      }
    ]
  }
}

// 导出单例实例
export const shortcutService = new ShortcutService()
