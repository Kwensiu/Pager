type ThemeMode = 'light' | 'dark' // 删除 'system'

/**
 * 极简主题服务
 * 1. 只支持 light/dark 两种模式
 * 2. 主题仅在应用内部生效，不影响系统原生控件
 */
class ThemeService {
  private currentTheme: ThemeMode = 'dark' // 默认深色

  constructor() {
    // Initialize with system theme
  }

  /**
   * 设置主题
   */
  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme
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
