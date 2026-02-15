import { BrowserWindow, screen } from 'electron'
import type { BrowserWindowConstructorOptions } from 'electron'

/**
 * 窗口管理服务
 * 管理窗口的置顶、小窗模式、位置和大小
 */
class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private alwaysOnTop: boolean = false
  private miniMode: boolean = false
  private originalBounds: Electron.Rectangle | null = null
  private miniBounds: Electron.Rectangle = { x: 0, y: 0, width: -1, height: -1 }

  /**
   * 设置主窗口
   * @param window 主窗口实例
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
    this.saveOriginalBounds()
  }

  /**
   * 获取主窗口
   * @returns 主窗口实例
   */
  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  /**
   * 保存原始窗口边界
   */
  private saveOriginalBounds(): void {
    if (this.mainWindow) {
      this.originalBounds = this.mainWindow.getBounds()
    }
  }

  /**
   * 恢复原始窗口边界
   */
  private restoreOriginalBounds(): void {
    if (this.mainWindow && this.originalBounds) {
      this.mainWindow.setBounds(this.originalBounds)
    }
  }

  /**
   * 切换窗口置顶状态
   * @returns 新的置顶状态
   */
  toggleAlwaysOnTop(): boolean {
    if (!this.mainWindow) return false

    this.alwaysOnTop = !this.alwaysOnTop
    this.mainWindow.setAlwaysOnTop(this.alwaysOnTop)

    return this.alwaysOnTop
  }

  /**
   * 获取窗口置顶状态
   * @returns 当前置顶状态
   */
  getAlwaysOnTopState(): boolean {
    return this.alwaysOnTop
  }

  /**
   * 设置窗口置顶状态
   * @param enabled 是否置顶
   */
  setAlwaysOnTop(enabled: boolean): void {
    if (!this.mainWindow) return

    this.alwaysOnTop = enabled
    this.mainWindow.setAlwaysOnTop(enabled)
  }

  /**
   * 获取窗口置顶状态
   */
  isAlwaysOnTop(): boolean {
    return this.alwaysOnTop
  }

  /**
   * 切换小窗模式
   * @returns 新的小窗模式状态
   */
  toggleMiniMode(): boolean {
    if (!this.mainWindow) return false

    this.miniMode = !this.miniMode

    if (this.miniMode) {
      this.enterMiniMode()
    } else {
      this.exitMiniMode()
    }

    console.log(`Mini mode: ${this.miniMode}`)
    return this.miniMode
  }

  /**
   * 进入小窗模式
   */
  private enterMiniMode(): void {
    if (!this.mainWindow) return

    // 保存当前边界
    this.saveOriginalBounds()

    // 设置小窗边界
    const display = screen.getPrimaryDisplay()
    const workArea = display.workArea

    // 小窗大小：宽400px，高300px，位置在右下角
    this.miniBounds = {
      x: workArea.x + workArea.width - 420,
      y: workArea.y + workArea.height - 320,
      width: 400,
      height: 300
    }

    this.mainWindow.setBounds(this.miniBounds)
    this.mainWindow.setMinimumSize(300, 200)
    this.mainWindow.setMaximumSize(500, 400)

    // 隐藏菜单栏（如果存在）
    this.mainWindow.setMenuBarVisibility(false)

    // 设置为无边框或简化边框
    this.mainWindow.setWindowButtonVisibility(false)
  }

  /**
   * 退出小窗模式
   */
  private exitMiniMode(): void {
    if (!this.mainWindow) return

    this.restoreOriginalBounds()
    this.mainWindow.setMinimumSize(784, 615)
    this.mainWindow.setMaximumSize(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)

    // 恢复菜单栏
    this.mainWindow.setMenuBarVisibility(true)

    // 恢复窗口按钮
    this.mainWindow.setWindowButtonVisibility(true)
  }

  /**
   * 设置小窗模式
   * @param enabled 是否启用小窗模式
   */
  setMiniMode(enabled: boolean): void {
    if (!this.mainWindow) return

    if (enabled && !this.miniMode) {
      this.miniMode = true
      this.enterMiniMode()
    } else if (!enabled && this.miniMode) {
      this.miniMode = false
      this.exitMiniMode()
    }
  }

  /**
   * 获取小窗模式状态
   */
  isMiniMode(): boolean {
    return this.miniMode
  }

  /**
   * 获取窗口状态
   */
  getWindowState(): {
    alwaysOnTop: boolean
    miniMode: boolean
    bounds: Electron.Rectangle | null
    isMaximized: boolean
    isMinimized: boolean
    isFullScreen: boolean
  } {
    if (!this.mainWindow) {
      return {
        alwaysOnTop: false,
        miniMode: false,
        bounds: null,
        isMaximized: false,
        isMinimized: false,
        isFullScreen: false
      }
    }

    return {
      alwaysOnTop: this.alwaysOnTop,
      miniMode: this.miniMode,
      bounds: this.mainWindow.getBounds(),
      isMaximized: this.mainWindow.isMaximized(),
      isMinimized: this.mainWindow.isMinimized(),
      isFullScreen: this.mainWindow.isFullScreen()
    }
  }

  /**
   * 保存窗口状态
   */
  saveWindowState(): {
    alwaysOnTop: boolean
    miniMode: boolean
    bounds: Electron.Rectangle
  } {
    const bounds = this.mainWindow
      ? this.mainWindow.getBounds()
      : { x: 0, y: 0, width: 800, height: 600 }

    return {
      alwaysOnTop: this.alwaysOnTop,
      miniMode: this.miniMode,
      bounds
    }
  }

  /**
   * 恢复窗口状态
   * @param state 窗口状态
   */
  restoreWindowState(state: {
    alwaysOnTop: boolean
    miniMode: boolean
    bounds: Electron.Rectangle
  }): void {
    if (!this.mainWindow) return

    this.alwaysOnTop = state.alwaysOnTop
    this.miniMode = state.miniMode

    this.mainWindow.setAlwaysOnTop(state.alwaysOnTop)
    this.mainWindow.setBounds(state.bounds)

    if (state.miniMode) {
      this.enterMiniMode()
    }
  }

  /**
   * 窗口居中显示
   */
  centerWindow(): void {
    if (!this.mainWindow) return

    this.mainWindow.center()
  }

  /**
   * 最大化窗口
   */
  maximizeWindow(): void {
    if (!this.mainWindow) return

    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize()
    } else {
      this.mainWindow.maximize()
    }
  }

  /**
   * 最小化窗口
   */
  minimizeWindow(): void {
    if (!this.mainWindow) return

    this.mainWindow.minimize()
  }

  /**
   * 恢复窗口
   */
  restoreWindow(): void {
    if (!this.mainWindow) return

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore()
    }
  }

  /**
   * 切换全屏模式
   */
  toggleFullScreen(): void {
    if (!this.mainWindow) return

    const isFullScreen = this.mainWindow.isFullScreen()
    this.mainWindow.setFullScreen(!isFullScreen)
  }

  /**
   * 设置窗口透明度
   * @param opacity 透明度 (0.0 - 1.0)
   */
  setWindowOpacity(opacity: number): void {
    if (!this.mainWindow) return

    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity))
    this.mainWindow.setOpacity(clampedOpacity)
  }

  /**
   * 设置窗口大小
   * @param width 宽度
   * @param height 高度
   */
  setWindowSize(width: number, height: number): void {
    if (!this.mainWindow) return

    this.mainWindow.setSize(width, height)
  }

  /**
   * 设置窗口位置
   * @param x X坐标
   * @param y Y坐标
   */
  setWindowPosition(x: number, y: number): void {
    if (!this.mainWindow) return

    this.mainWindow.setPosition(x, y)
  }

  /**
   * 获取推荐的窗口位置
   * @param width 窗口宽度
   * @param height 窗口高度
   */
  getRecommendedPosition(width: number, height: number): { x: number; y: number } {
    const display = screen.getPrimaryDisplay()
    const workArea = display.workArea

    return {
      x: workArea.x + Math.floor((workArea.width - width) / 2),
      y: workArea.y + Math.floor((workArea.height - height) / 2)
    }
  }

  /**
   * 创建新窗口
   * @param options 窗口选项
   */
  createWindow(options: BrowserWindowConstructorOptions): BrowserWindow {
    const win = new BrowserWindow(options)
    return win
  }

  /**
   * 获取窗口管理快捷键
   */
  getWindowShortcuts(): Record<string, string> {
    return {
      toggleAlwaysOnTop: 'Ctrl+Shift+T',
      toggleMiniMode: 'Ctrl+Shift+M',
      maximizeWindow: 'F11',
      minimizeWindow: 'Ctrl+M',
      snapLeft: 'Win+Left',
      snapRight: 'Win+Right',
      snapTop: 'Win+Up',
      snapBottom: 'Win+Down',
      centerWindow: 'Ctrl+Shift+C'
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.mainWindow = null
    this.originalBounds = null
  }
}

// 导出单例实例
export const windowManager = new WindowManager()
