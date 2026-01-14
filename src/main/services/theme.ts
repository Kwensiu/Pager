import { nativeTheme } from 'electron'

type ThemeMode = 'light' | 'dark' // 删除 'system'

/**
 * 极简主题服务
 * 1. 只支持 light/dark 两种模式
 * 2. 窗口固定为深色
 */
class ThemeService {
  private currentTheme: ThemeMode = 'dark' // 默认深色

  constructor() {
    console.log('[ThemeService] Initialized')
    // 延迟设置窗口主题，确保 nativeTheme 已初始化
    setTimeout(() => {
      this.setWindowDark()
    }, 100)
  }

  /**
   * 设置窗口为深色
   */
  private setWindowDark(): void {
    try {
      console.log('[ThemeService] Setting window to dark')
      nativeTheme.themeSource = 'dark' // 窗口固定深色
    } catch (error) {
      console.error('[ThemeService] Failed to set window theme:', error)
    }
  }

  /**
   * 设置主题
   */
  setTheme(theme: ThemeMode): void {
    console.log(`[ThemeService] Setting content theme to: ${theme}`)
    console.log(`[ThemeService] Window remains dark (fixed)`)

    this.currentTheme = theme

    // 窗口保持深色不变
    this.setWindowDark()
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): ThemeMode {
    return this.currentTheme
  }

  /**
   * 获取实际应用的主题
   */
  getAppliedTheme(): 'light' | 'dark' {
    return this.currentTheme
  }

  /**
   * 切换主题
   */
  toggleTheme(): ThemeMode {
    const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light'
    this.setTheme(nextTheme)
    return nextTheme
  }
}

// 导出单例实例
export const themeService = new ThemeService()
