import { Tray, Menu, app, nativeImage, BrowserWindow, shell } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * 系统托盘服务
 * 管理系统托盘图标和菜单
 */
class TrayService {
  private tray: Tray | null = null
  private mainWindow: BrowserWindow | null = null
  private isWindowVisible = true
  private readonly isMac = process.platform === 'darwin'
  private readonly websiteUrl = 'https://github.com/Kwensiu/pager'

  /**
   * 创建托盘图标
   * @param mainWindow 主窗口引用
   */
  createTray(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow

    try {
      // 获取图标路径
      const iconPath = this.getIconPath()
      const icon = nativeImage.createFromPath(iconPath)

      // 创建托盘图标
      this.tray = new Tray(icon)

      // 设置托盘工具提示
      this.tray.setToolTip('Pager - 多网站管理工具')

      // 创建上下文菜单
      this.updateContextMenu()

      // 跨平台差异化交互
      if (this.isMac) {
        // Mac 上右键显示菜单
        this.tray.on('right-click', () => {
          this.tray?.popUpContextMenu()
        })
        
        // Mac 上双击显示窗口
        this.tray.on('double-click', () => {
          this.showWindow()
        })
      } else {
        // 其他平台单击切换窗口
        this.tray.on('click', () => {
          this.toggleWindow()
        })
        
        // 双击直接显示窗口
        this.tray.on('double-click', () => {
          this.showWindow()
        })
      }

      // Tray created successfully
    } catch (error) {
      console.error('Failed to create tray:', error)
    }
  }

  /**
   * 获取图标路径
   */
  private getIconPath(): string {
    // 尝试多种路径
    const possiblePaths = [
      path.join(__dirname, '../../resources/icon.png'),
      path.join(__dirname, '../../resources/icon.ico'),
      path.join(process.resourcesPath, 'resources/icon.png'),
      path.join(process.resourcesPath, 'resources/icon.ico')
    ]

    for (const iconPath of possiblePaths) {
      try {
        if (fs.existsSync(iconPath)) {
          return iconPath
        }
      } catch {
        // 继续尝试下一个路径
      }
    }

    // 如果找不到图标，使用默认图标
    return path.join(__dirname, '../../resources/icon.png')
  }

  /**
   * 更新上下文菜单
   */
  updateContextMenu(): void {
    if (!this.tray) return

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示窗口',
        click: () => this.showWindow()
      },
      {
        label: '隐藏窗口',
        click: () => this.hideWindow(),
        visible: this.isWindowVisible
      },
      { type: 'separator' },
      {
        label: 'GitHub',
        click: () => this.openWebsite()
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => this.quitApp()
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  /**
   * 切换窗口显示/隐藏
   */
  toggleWindow(): void {
    if (!this.mainWindow) return

    if (this.isWindowVisible) {
      this.mainWindow.hide()
      this.isWindowVisible = false
      // Mac 上隐藏窗口时隐藏 Dock 图标
      if (this.isMac && app.dock) {
        try {
          app.dock.hide()
        } catch {
          // Failed to hide Dock icon
        }
      }
    } else {
      this.mainWindow.show()
      this.mainWindow.focus()
      this.isWindowVisible = true
      // Mac 上显示窗口时显示 Dock 图标
      if (this.isMac && app.dock) {
        try {
          app.dock.show()
        } catch {
          // Failed to show Dock icon
        }
      }
    }

    this.updateContextMenu()
  }

  /**
   * 显示窗口
   */
  showWindow(): void {
    if (!this.mainWindow) return

    this.mainWindow.show()
    this.mainWindow.focus()
    this.isWindowVisible = true
    this.updateContextMenu()
  }

  /**
   * 隐藏窗口
   */
  hideWindow(): void {
    if (!this.mainWindow) return

    this.mainWindow.hide()
    this.isWindowVisible = false
    this.updateContextMenu()
  }

  /**
   * 打开官网
   */
  private openWebsite(): void {
    shell.openExternal(this.websiteUrl).catch(() => {
      // Failed to open GitHub link
    })
  }

  /**
   * 退出应用
   */
  private quitApp(): void {
    app.quit()
  }

  /**
   * 销毁托盘图标
   */
  destroyTray(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }

  /**
   * 设置托盘工具提示
   * @param tooltip 工具提示文本
   */
  setToolTip(tooltip: string): void {
    if (this.tray) {
      this.tray.setToolTip(tooltip)
    }
  }

  /**
   * 设置托盘图标
   * @param iconPath 图标路径
   */
  setIcon(iconPath: string): void {
    if (!this.tray) return

    try {
      const icon = nativeImage.createFromPath(iconPath)
      this.tray.setImage(icon)
    } catch {
      // Failed to set tray icon
    }
  }

  /**
   * 显示通知
   * @param title 通知标题
   * @param body 通知内容
   */
  showNotification(title: string, body: string): void {
    if (!this.tray) return

    // 在托盘图标上显示通知（通过工具提示）
    this.tray.setToolTip(`${title}: ${body}`)

    // 3秒后恢复原始工具提示
    setTimeout(() => {
      this.tray?.setToolTip('Pager - 多网站管理工具')
    }, 3000)
  }

  /**
   * 获取窗口可见状态
   */
  getWindowVisibility(): boolean {
    return this.isWindowVisible
  }
}

// 导出单例实例
export const trayService = new TrayService()
