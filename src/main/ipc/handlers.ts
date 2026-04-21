import { ipcMain, Menu, shell, app, session, BrowserWindow } from 'electron'
import { join, resolve, sep } from 'path'
import { existsSync, readFileSync } from 'fs'
import { lstat, readdir } from 'fs/promises'
import type {
  PrimaryGroup,
  SecondaryGroup,
  Website,
  WindowState,
  Settings,
  WebsiteOrderUpdate
} from '../types/store'
import { registerEnhancedIpcHandlers } from './enhancedHandlers'
import { extensionEnhancedHandlers } from './extensionEnhancedHandlers'
import { ExtensionManager } from '../extensions/extensionManager'
import { ExtensionIsolationLevel } from '../../shared/types/store'
import { globalProxyService } from '../services/proxyService'

const extensionManager = ExtensionManager.getInstance()

// 动态导入storeService以避免循环依赖
export const getStoreService = async (): Promise<
  typeof import('../services/store').storeService
> => {
  const { storeService } = await import('../services/store')
  return storeService
}

// 输入验证函数
function validateExtensionId(extensionId: string): boolean {
  // 扩展ID应该是非空的字符串，包含字母数字字符和连字符
  return (
    typeof extensionId === 'string' &&
    extensionId.length > 0 &&
    extensionId.length <= 100 &&
    /^[a-zA-Z0-9_-]+$/.test(extensionId)
  )
}

function validateUrl(url: string): boolean {
  // URL应该是非空的字符串，且是有效的URL格式
  if (typeof url !== 'string' || url.length === 0 || url.length > 2000) {
    return false
  }
  try {
    const urlObj = new URL(url)
    // 只允许 http, https, chrome-extension 协议
    return ['http:', 'https:', 'chrome-extension:'].includes(urlObj.protocol)
  } catch {
    return false
  }
}

function validateFilePath(filePath: string): boolean {
  // 基本输入验证
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.length > 1000) {
    return false
  }

  // 检查路径遍历模式
  if (filePath.includes('..')) {
    return false
  }

  // 检查空字节
  if (filePath.includes('\0')) {
    return false
  }

  return true
}

function validateTitle(title: string): boolean {
  // 标题应该是非空的字符串，不超过合理长度
  return typeof title === 'string' && title.length > 0 && title.length <= 200
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isPathInsideBase(basePath: string, targetPath: string): boolean {
  const resolvedBase = resolve(basePath)
  const resolvedTarget = resolve(targetPath)
  const normalizedBase = process.platform === 'win32' ? resolvedBase.toLowerCase() : resolvedBase
  const normalizedTarget =
    process.platform === 'win32' ? resolvedTarget.toLowerCase() : resolvedTarget

  return (
    normalizedTarget === normalizedBase || normalizedTarget.startsWith(`${normalizedBase}${sep}`)
  )
}

function normalizeExtensionRelativePath(rawPath?: string): string | undefined {
  if (!rawPath) {
    return undefined
  }

  const normalized = rawPath.replaceAll('\\', '/').replace(/^\/+/, '')
  if (
    normalized.length === 0 ||
    normalized.length > 500 ||
    normalized.includes('..') ||
    normalized.includes('\0')
  ) {
    return undefined
  }

  if (!/^[a-zA-Z0-9._/-]+$/.test(normalized)) {
    return undefined
  }

  return normalized
}

/**
 * 从本地存储获取弹窗设置
 * @returns 是否允许弹窗，默认为 true
 */
function getAllowPopupsSetting(): boolean {
  try {
    const userDataPath = app.getPath('userData')
    const storePath = join(userDataPath, 'pager-store.json')

    if (existsSync(storePath)) {
      const storeData = JSON.parse(readFileSync(storePath, 'utf-8'))
      return storeData.settings?.allowPopups ?? true
    }
  } catch (error) {
    console.error('读取弹窗设置失败:', error)
  }
  return true // 默认允许
}

/**
 * 处理新窗口请求的通用逻辑
 * @param details 新窗口详情
 * @param webContents 目标 webContents
 * @param windowType 窗口类型（主窗口或 WebView）
 * @returns 新窗口处理动作
 */
function handleNewWindow(
  details: Electron.HandlerDetails,
  webContents: Electron.WebContents,
  windowType: 'main' | 'webview'
): { action: 'allow' | 'deny' } {
  const allowPopups = getAllowPopupsSetting()

  if (allowPopups) {
    console.log(`${windowType} 允许弹窗，在应用内打开:`, details.url)
    return { action: 'allow' }
  } else {
    console.log(`${windowType} 禁止弹窗，在当前窗口导航:`, details.url)
    // 在当前窗口中导航到新页面
    webContents.loadURL(details.url)
    return { action: 'deny' }
  }
}

interface ExtensionStructure {
  id: string
  path: string
  files: Array<{ name: string; path: string; type: string; size?: number }>
  directories: Array<{ name: string; path: string; files: string[]; type?: string }>
}

interface ExtensionManifest {
  options_page?: string
  permissions?: string[]
  action?: {
    default_popup?: string
  }
  browser_action?: {
    default_popup?: string
  }
  [key: string]: unknown
}

export async function registerIpcHandlers(mainWindow: Electron.BrowserWindow): Promise<void> {
  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // 注册增强功能的 IPC 处理器
  registerEnhancedIpcHandlers(mainWindow)

  // 创建并注册扩展增强处理器（实例化时会自动注册IPC处理器）
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  extensionEnhancedHandlers

  // ===== 扩展管理相关 IPC 处理器 =====

  // 获取所有扩展
  ipcMain.handle('extension:getAll', async () => {
    try {
      const extensions = extensionManager.getAllExtensions()
      return {
        success: true,
        extensions: extensions.map((ext) => ({
          id: ext.id,
          realId: ext.realId,
          name: ext.name,
          version: ext.version,
          path: ext.path,
          enabled: ext.enabled,
          manifest: ext.manifest
        }))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 添加扩展
  ipcMain.handle('extension:add', async (_, extensionPath: string) => {
    try {
      const result = await extensionManager.addExtension(extensionPath)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 移除扩展
  ipcMain.handle('extension:remove', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.removeExtension(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 切换扩展状态
  ipcMain.handle('extension:toggle', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.toggleExtension(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 验证扩展
  ipcMain.handle('extension:validate', async (_, extensionPath: string) => {
    try {
      const result = await extensionManager.validateExtension(extensionPath)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { valid: false, error: errorMessage }
    }
  })

  // 获取已加载的扩展
  ipcMain.handle('extension:getLoaded', async () => {
    try {
      const loadedExtensions = extensionManager.getLoadedExtensions()
      return {
        success: true,
        extensions: loadedExtensions
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取扩展设置
  ipcMain.handle('extension:getSettings', async () => {
    try {
      const settings = extensionManager.getSettings()
      return {
        success: true,
        settings
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新扩展设置
  ipcMain.handle(
    'extension:updateSettings',
    async (_, settings: { enableExtensions?: boolean; autoLoadExtensions?: boolean }) => {
      try {
        extensionManager.updateSettings(settings)
        return { success: true }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 使用隔离加载扩展
  ipcMain.handle(
    'extension:loadWithIsolation',
    async (_, extensionPath: string, isolationLevel?: string) => {
      try {
        const result = await extensionManager.loadExtensionWithIsolation(
          extensionPath,
          isolationLevel as ExtensionIsolationLevel | undefined
        )
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 使用隔离卸载扩展
  ipcMain.handle('extension:unloadWithIsolation', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.unloadExtensionWithIsolation(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取扩展及其权限信息
  ipcMain.handle('extension:getWithPermissions', async (_, extensionId: string) => {
    try {
      const result = await extensionManager.getExtensionWithPermissions(extensionId)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 更新权限设置
  ipcMain.handle(
    'extension:updatePermissionSettings',
    async (_, extensionId: string, permissions: string[], allowed: boolean) => {
      try {
        const result = await extensionManager.updatePermissionSettings(
          extensionId,
          permissions,
          allowed
        )
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        return { success: false, error: errorMessage }
      }
    }
  )

  // 获取错误统计
  ipcMain.handle('extension:getErrorStats', async () => {
    try {
      const result = await extensionManager.getErrorStats()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 获取权限统计
  ipcMain.handle('extension:getPermissionStats', async () => {
    try {
      const result = await extensionManager.getPermissionStats()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // 清除错误历史
  ipcMain.handle('extension:clearErrorHistory', async () => {
    try {
      const result = await extensionManager.clearErrorHistory()
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // ===== 代理设置相关 IPC 处理器 =====

  // 获取当前代理设置
  ipcMain.handle('proxy:get-current-settings', async () => {
    try {
      const proxySettings = globalProxyService.getCurrentProxySettings()
      return { success: true, settings: proxySettings }
    } catch (error) {
      console.error('Failed to get proxy settings:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 监听所有 webview 的右键菜单事件
  mainWindow.webContents.on('did-attach-webview', (_event, webContents) => {
    console.log('Webview attached, setting up context menu listener and window open handler')

    // 为 WebView 设置新窗口处理器
    webContents.setWindowOpenHandler((details) => {
      try {
        return handleNewWindow(details, webContents, 'webview')
      } catch (error) {
        console.error('WebView window open handler error:', error)
        // 出错时保持原有行为：外部浏览器打开
        shell.openExternal(details.url)
        return { action: 'deny' }
      }
    })

    // 监听 webview 的右键菜单事件
    webContents.on('context-menu', (_, params) => {
      console.log('=== WebView Context Menu Event ===')
      console.log('Context menu triggered in webview:', params)

      // 构建右键菜单
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '后退',
          accelerator: 'Alt+Left',
          click: () => {
            webContents.goBack()
          }
        },
        {
          label: '前进',
          accelerator: 'Alt+Right',
          click: () => {
            webContents.goForward()
          }
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'F5',
          click: () => {
            webContents.reload()
          }
        },
        {
          label: '强制重新加载',
          accelerator: 'Ctrl+F5',
          click: () => {
            webContents.reloadIgnoringCache()
          }
        },
        { type: 'separator' },
        {
          label: '复制',
          accelerator: 'Ctrl+C',
          enabled: params.selectionText?.length > 0,
          click: () => {
            webContents.copy()
          }
        },
        {
          label: '粘贴',
          accelerator: 'Ctrl+V',
          enabled: params.isEditable,
          click: () => {
            webContents.paste()
          }
        },
        {
          label: '全选',
          accelerator: 'Ctrl+A',
          click: () => {
            webContents.selectAll()
          }
        },
        { type: 'separator' },
        {
          label: '查看源代码',
          click: () => {
            webContents.openDevTools()
          }
        },
        {
          label: '检查元素',
          click: () => {
            webContents.inspectElement(params.x, params.y)
          }
        },
        { type: 'separator' },
        {
          label: '在外部浏览器中打开',
          click: () => {
            if (params.pageURL) {
              shell.openExternal(params.pageURL)
            }
          }
        }
      ])

      // 显示菜单
      contextMenu.popup({
        window: mainWindow,
        x: params.x,
        y: params.y
      })
    })
  })

  // 监听 webview 创建事件
  ipcMain.on('webview-created', (_, webviewId: string) => {
    console.log('Webview created:', webviewId)

    // 尝试获取 webview 的 webContents
    // 注意：这需要在主进程中处理
  })

  // WebView 右键菜单
  ipcMain.on('webview:show-context-menu', (_, params) => {
    try {
      console.log('=== WebView Context Menu Debug ===')
      console.log('Received webview context menu request:', params)
      console.log('Main window available:', !!mainWindow)
      console.log('Main window webContents available:', !!mainWindow?.webContents)

      const contextMenu = Menu.buildFromTemplate([
        {
          label: '后退',
          accelerator: 'Alt+Left',
          click: () => {
            // 发送后退命令到渲染进程
            mainWindow.webContents.send('webview:navigate-back')
          }
        },
        {
          label: '前进',
          accelerator: 'Alt+Right',
          click: () => {
            // 发送前进命令到渲染进程
            mainWindow.webContents.send('webview:navigate-forward')
          }
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'F5',
          click: () => {
            // 发送重新加载命令到渲染进程
            mainWindow.webContents.send('webview:reload')
          }
        },
        {
          label: '强制重新加载',
          accelerator: 'Ctrl+F5',
          click: () => {
            // 发送强制重新加载命令到渲染进程
            mainWindow.webContents.send('webview:reload-force')
          }
        },
        { type: 'separator' },
        {
          label: '复制',
          accelerator: 'Ctrl+C',
          enabled: params.selectionText?.length > 0,
          click: () => {
            // 发送复制命令到渲染进程
            mainWindow.webContents.send('webview:copy')
          }
        },
        {
          label: '粘贴',
          accelerator: 'Ctrl+V',
          enabled: params.isEditable,
          click: () => {
            // 发送粘贴命令到渲染进程
            mainWindow.webContents.send('webview:paste')
          }
        },
        {
          label: '全选',
          accelerator: 'Ctrl+A',
          click: () => {
            // 发送全选命令到渲染进程
            mainWindow.webContents.send('webview:select-all')
          }
        },
        { type: 'separator' },
        {
          label: '查看源代码',
          click: () => {
            // 发送查看源代码命令到渲染进程
            mainWindow.webContents.send('webview:view-source')
          }
        },
        {
          label: '检查元素',
          click: () => {
            // 发送检查元素命令到渲染进程
            mainWindow.webContents.send('webview:inspect-element')
          }
        },
        { type: 'separator' },
        {
          label: '在外部浏览器中打开',
          click: () => {
            if (params.pageURL) {
              shell.openExternal(params.pageURL)
            }
          }
        }
      ])

      console.log('Context menu built successfully, showing menu...')
      console.log('Menu position:', { x: params.x, y: params.y })

      // 显示菜单
      contextMenu.popup({
        window: mainWindow,
        x: params.x,
        y: params.y
      })

      console.log('Context menu popup called')
    } catch (error) {
      console.error('Error showing webview context menu:', error)
    }
  })

  // WebView 导航控制
  const forwardWebviewLoadUrl = (url: string): { success: boolean; error?: string } => {
    const webContents = mainWindow?.webContents
    if (webContents) {
      try {
        webContents.send('webview:load-url', url)
        return { success: true }
      } catch (error) {
        console.error('发送webview:load-url失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }

    return { success: false, error: 'Main window webContents unavailable' }
  }

  ipcMain.on('webview:load-url', (_, url: string) => {
    forwardWebviewLoadUrl(url)
  })

  ipcMain.handle('webview:load-url', async (_, url: string) => {
    return forwardWebviewLoadUrl(url)
  })

  ipcMain.on('webview:hide', () => {
    // 发送隐藏webview命令到渲染进程
    mainWindow.webContents.send('webview:hide')
  })

  ipcMain.on('webview:reload', () => {
    // 发送重新加载命令到渲染进程
    mainWindow.webContents.send('webview:reload')
  })

  ipcMain.on('webview:go-back', () => {
    // 发送后退命令到渲染进程
    mainWindow.webContents.send('webview:navigate-back')
  })

  ipcMain.on('webview:go-forward', () => {
    // 发送前进命令到渲染进程
    mainWindow.webContents.send('webview:navigate-forward')
  })

  // 窗口管理相关 IPC
  ipcMain.on('window:open-dev-tools', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools()
    }
  })

  // 在新窗口中打开扩展页面（不受弹窗设置限制）
  ipcMain.handle('window:open-extension-in-new-window', async (_, url: string, title?: string) => {
    try {
      // 输入验证
      if (!validateUrl(url)) {
        return { success: false, error: 'Invalid URL format' }
      }
      if (title && !validateTitle(title)) {
        return { success: false, error: 'Invalid title format' }
      }

      console.log(`Opening extension in new window: ${url}`)

      // 解析扩展ID
      const urlObj = new URL(url)
      const extensionId = urlObj.hostname

      // 验证扩展ID
      if (!validateExtensionId(extensionId)) {
        return { success: false, error: 'Invalid extension ID format' }
      }

      // 获取扩展信息
      const extension = extensionManager.getExtension(extensionId)
      if (!extension) {
        throw new Error(`Extension not found: ${extensionId}`)
      }

      // 检查是否是弹出页面，如果是，使用悬浮窗模式
      const isPopup =
        url.includes('popup.html') || url.includes('popup') || title?.includes('popup')

      if (isPopup) {
        // 创建悬浮窗（类似浏览器扩展弹出）
        return await createExtensionPopup(url, title || 'Extension Popup', extensionId)
      } else {
        // 选项页面使用普通窗口
        return await createExtensionOptionsWindow(url, title || 'Extension Options', extensionId)
      }
    } catch (error) {
      console.error('Failed to open extension in new window:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 创建扩展悬浮窗
  async function createExtensionPopup(
    url: string,
    title: string,
    _extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Creating extension popup: ${title}`)

      // 获取主窗口位置
      const mainWindow = BrowserWindow.getAllWindows().find((w) => w.webContents.id === 1)
      const mainWindowBounds = mainWindow?.getBounds() || {
        x: 100,
        y: 100,
        width: 1200,
        height: 800
      }

      // 计算悬浮窗位置（在主窗口右上角）
      const popupWidth = 400
      const popupHeight = 600
      const popupX = mainWindowBounds.x + mainWindowBounds.width - popupWidth - 20
      const popupY = mainWindowBounds.y + 80 // 留出标题栏空间

      const extensionSession = session.fromPartition('persist:extensions')

      const popupWindow = new BrowserWindow({
        width: popupWidth,
        height: popupHeight,
        x: popupX,
        y: popupY,
        title: title,
        show: false,
        frame: false, // 无边框，更像悬浮窗
        alwaysOnTop: true, // 始终置顶
        skipTaskbar: true, // 不在任务栏显示
        resizable: false, // 不可调整大小
        minimizable: false, // 不可最小化
        maximizable: false, // 不可最大化
        hasShadow: true, // 添加阴影效果
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webviewTag: false,
          session: extensionSession,
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: true,
          javascript: true,
          plugins: true,
          images: true,
          preload: undefined,
          additionalArguments: ['--disable-features=VizDisplayCompositor', '--disable-gpu']
        }
      })

      // 添加错误处理
      popupWindow.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
          console.error(
            `Extension popup failed to load: ${errorCode} - ${errorDescription} for URL: ${validatedURL}`
          )
          popupWindow.destroy()
        }
      )

      // 监听页面加载完成后的错误
      popupWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        if (level >= 2) {
          console.warn(`Extension popup console [${level}]: ${message} at ${sourceId}:${line}`)

          // 如果检测到扩展内部的JavaScript错误，尝试修复
          if (
            message.includes('Cannot read properties of undefined') &&
            (sourceId.includes('popup') || sourceId.includes('fenix'))
          ) {
            console.log('Detected extension internal error in popup, attempting to fix...')

            setTimeout(() => {
              popupWindow.webContents
                .executeJavaScript(
                  `
                console.log('=== Attempting to fix popup extension errors ===');
                
                try {
                  // 重写可能出错的函数
                  const originalSplit = String.prototype.split;
                  String.prototype.split = function(separator) {
                    if (this === undefined || this === null) {
                      console.warn('String.split called on undefined/null, returning empty array');
                      return [''];
                    }
                    return originalSplit.call(this, separator);
                  };
                  
                  console.log('Applied String.prototype.split safety fix for popup');
                } catch (e) {
                  console.log('Error fix attempt failed:', e);
                }
                
                console.log('=== End popup error fix attempt ===');
              `
                )
                .catch((err) => console.log('Failed to inject popup error fix:', err))
            }, 1000)
          }
        }
      })

      // 监听DOM内容加载完成
      popupWindow.webContents.on('dom-ready', () => {
        console.log('Extension popup DOM ready')

        // 注入调试和修复脚本
        popupWindow.webContents
          .executeJavaScript(
            `
          console.log('=== Extension Popup Debug Info ===');
          
          // 添加全局错误处理
          window.addEventListener('error', function(e) {
            console.error('Popup error caught:', e.error);
            
            // 如果是split相关的错误，提供简化界面
            if (e.message.includes('Cannot read properties of undefined') && e.message.includes('split')) {
              console.log('Detected split-related error in popup, providing fallback...');
              
              setTimeout(() => {
                const body = document.body;
                if (body) {
                  body.innerHTML = \`
                    <div style="padding: 15px; font-family: Arial, sans-serif; text-align: center;">
                      <h4 style="margin: 0 0 10px 0;">扩展控制</h4>
                      <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="alert('广告拦截已启用')" style="padding: 6px 12px; background: #d32f2f; color: white; border: none; border-radius: 3px; cursor: pointer;">启用拦截</button>
                        <button onclick="alert('已暂停拦截')" style="padding: 6px 12px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;">暂停拦截</button>
                        <button onclick="window.close()" style="padding: 6px 12px; background: #dc3545; color: white; border: none; border-radius: 3px; cursor: pointer;">关闭</button>
                      </div>
                      <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">简化模式 - 扩展兼容性问题</p>
                    </div>
                  \`;
                }
              }, 1000);
            }
          });
          
          // 确保悬浮窗样式正确
          document.body.style.margin = '0';
          document.body.style.padding = '0';
          document.body.style.overflow = 'hidden';
          document.body.style.backgroundColor = '#ffffff';
          
          console.log('=== End Extension Popup Debug Info ===');
        `
          )
          .catch((err) => console.log('Failed to inject popup debug script:', err))
      })

      // 点击外部区域关闭悬浮窗
      popupWindow.on('blur', () => {
        // 延迟关闭，给用户时间点击内部元素
        setTimeout(() => {
          if (!popupWindow.isDestroyed()) {
            popupWindow.close()
          }
        }, 200)
      })

      // 失去焦点时也可以关闭
      popupWindow.on('focus', () => {
        // 获得焦点时取消关闭定时器
      })

      popupWindow.on('ready-to-show', () => {
        popupWindow.show()
        // 添加动画效果
        popupWindow.setOpacity(0)
        popupWindow.setOpacity(1)
      })

      await popupWindow.loadURL(url)

      return { success: true }
    } catch (error) {
      console.error('Failed to create extension popup:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 创建扩展选项窗口
  async function createExtensionOptionsWindow(
    url: string,
    title: string,
    _extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`Creating extension options window: ${title}`)

      const extensionSession = session.fromPartition('persist:extensions')

      const optionsWindow = new BrowserWindow({
        width: 900,
        height: 700,
        minWidth: 600,
        minHeight: 400,
        title: title,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webviewTag: false,
          session: extensionSession,
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: true,
          javascript: true,
          plugins: true,
          images: true,
          preload: undefined,
          additionalArguments: [
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--disable-software-rasterizer'
          ]
        }
      })

      // 添加错误处理（复用之前的代码）
      optionsWindow.webContents.on(
        'did-fail-load',
        (_event, errorCode, errorDescription, validatedURL) => {
          console.error(
            `Extension options failed to load: ${errorCode} - ${errorDescription} for URL: ${validatedURL}`
          )
          optionsWindow.destroy()
        }
      )

      optionsWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
        if (level >= 2) {
          console.warn(`Extension options console [${level}]: ${message} at ${sourceId}:${line}`)
        }
      })

      optionsWindow.on('ready-to-show', () => {
        optionsWindow.show()
      })

      await optionsWindow.loadURL(url)

      return { success: true }
    } catch (error) {
      console.error('Failed to create extension options window:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // 在主窗口中加载扩展页面
  ipcMain.handle('window:load-extension-url', async (_, url: string) => {
    try {
      // 输入验证
      if (!validateUrl(url)) {
        return { success: false, error: 'Invalid URL format' }
      }

      if (mainWindow) {
        console.log(`Loading extension URL in main window: ${url}`)
        await mainWindow.webContents.loadURL(url)
        return { success: true }
      } else {
        throw new Error('Main window not available')
      }
    } catch (error) {
      console.error('Failed to load extension URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 创建扩展配置页面
  ipcMain.handle(
    'extension:create-config-page',
    async (
      _,
      extensionId: string,
      extensionName: string,
      extensionPath: string,
      manifest: ExtensionManifest
    ) => {
      try {
        // 输入验证
        if (!validateExtensionId(extensionId)) {
          return { success: false, error: 'Invalid extension ID format' }
        }
        if (!validateFilePath(extensionPath)) {
          return { success: false, error: 'Invalid file path format' }
        }
        if (
          typeof extensionName !== 'string' ||
          extensionName.length === 0 ||
          extensionName.length > 200
        ) {
          return { success: false, error: 'Invalid extension name format' }
        }

        const extension = extensionManager.getExtension(extensionId)
        if (!extension) {
          return { success: false, error: 'Extension not found' }
        }

        const registeredExtensionPath = resolve(extension.path)
        if (!isPathInsideBase(registeredExtensionPath, resolve(extensionPath))) {
          return { success: false, error: 'Extension path mismatch' }
        }

        const trustedManifest = (extension.manifest ?? manifest ?? {}) as ExtensionManifest
        const displayNameRaw =
          typeof extension.name === 'string' && extension.name.trim().length > 0
            ? extension.name
            : extensionName
        const displayName = escapeHtml(displayNameRaw)
        const safeExtensionId = escapeHtml(extensionId)
        const versionValue =
          typeof trustedManifest.version === 'string' && trustedManifest.version.trim().length > 0
            ? trustedManifest.version
            : '未知'
        const descriptionValue =
          typeof trustedManifest.description === 'string' &&
          trustedManifest.description.trim().length > 0
            ? trustedManifest.description
            : '无描述'
        const homepageRaw =
          typeof trustedManifest.homepage_url === 'string'
            ? trustedManifest.homepage_url.trim()
            : ''
        const homepageValue = homepageRaw.length > 0 ? homepageRaw : '未提供'
        const trustedHomepageUrl = (() => {
          if (homepageRaw.length === 0) {
            return undefined
          }

          try {
            const homepageUrl = new URL(homepageRaw)
            if (!['http:', 'https:'].includes(homepageUrl.protocol)) {
              return undefined
            }
            return homepageUrl.toString()
          } catch {
            return undefined
          }
        })()
        const safeVersion = escapeHtml(versionValue)
        const safeDescription = escapeHtml(descriptionValue)
        const safeHomepage = escapeHtml(homepageValue)
        const safeExtensionPath = escapeHtml(registeredExtensionPath)
        const resolvedExtensionId = extension.id
        const rawPermissions = Array.isArray(trustedManifest.permissions)
          ? trustedManifest.permissions
          : []
        const permissions = rawPermissions.filter(
          (permission): permission is string =>
            typeof permission === 'string' && permission.trim().length > 0
        )
        const permissionItems =
          permissions.length > 0
            ? permissions.map((permission) => `<li>${escapeHtml(permission)}</li>`).join('')
            : '<li>无特殊权限要求</li>'

        const optionsEntries = [
          {
            key: 'options',
            label: 'Options 页面',
            path: normalizeExtensionRelativePath(trustedManifest.options_page),
            openAsPopup: false
          },
          {
            key: 'action-popup',
            label: 'Action 弹出页',
            path: normalizeExtensionRelativePath(trustedManifest.action?.default_popup),
            openAsPopup: true
          },
          {
            key: 'browser-action-popup',
            label: 'Browser Action 弹出页',
            path: normalizeExtensionRelativePath(trustedManifest.browser_action?.default_popup),
            openAsPopup: true
          }
        ].filter(
          (
            entry
          ): entry is {
            key: string
            label: string
            path: string
            openAsPopup: boolean
          } => Boolean(entry.path)
        )

        type ConfigAction =
          | { type: 'open-folder' }
          | { type: 'close-window' }
          | { type: 'open-homepage'; url: string }
          | { type: 'open-extension-page'; url: string; title: string; openAsPopup: boolean }

        const configActions = new Map<string, ConfigAction>()
        const buildActionHref = (actionKey: string, action: ConfigAction): string => {
          configActions.set(actionKey, action)
          return `app://extension-config/?action=${encodeURIComponent(actionKey)}`
        }

        const openFolderHref = buildActionHref('open-folder', { type: 'open-folder' })
        const closeWindowHref = buildActionHref('close-window', { type: 'close-window' })
        const openHomepageHref = trustedHomepageUrl
          ? buildActionHref('open-homepage', { type: 'open-homepage', url: trustedHomepageUrl })
          : undefined
        const extensionRootUrl = `chrome-extension://${resolvedExtensionId}/`
        const openRootHref = buildActionHref('open-root-page', {
          type: 'open-extension-page',
          url: extensionRootUrl,
          title: `${displayNameRaw} - 扩展主页`,
          openAsPopup: false
        })

        const optionsItems =
          optionsEntries.length > 0
            ? optionsEntries
                .map((entry) => {
                  const extensionUrl = `chrome-extension://${resolvedExtensionId}/${entry.path}`
                  const openPageHref = buildActionHref(`open-page:${entry.key}`, {
                    type: 'open-extension-page',
                    url: extensionUrl,
                    title: `${displayNameRaw} - ${entry.label}`,
                    openAsPopup: entry.openAsPopup
                  })
                  return `<li><strong>${escapeHtml(entry.label)}:</strong> <code>${escapeHtml(extensionUrl)}</code> <a class="inline-action" href="${openPageHref}">打开</a></li>`
                })
                .join('')
            : '<li>Manifest 中未发现 options/popup 路径</li>'

        const quickActionItems = [
          `<a class="action-button" href="${openFolderHref}">打开扩展目录</a>`,
          `<a class="action-button secondary" href="${openRootHref}">打开扩展主页</a>`,
          `<a class="action-button secondary" href="${closeWindowHref}">关闭配置页面</a>`,
          openHomepageHref
            ? `<a class="action-button secondary" href="${openHomepageHref}">打开项目主页</a>`
            : '<span class="action-disabled">未提供可用主页 URL</span>'
        ].join('')

        console.log(`Creating secure config page for extension: ${displayNameRaw}`)
        const configHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; base-uri 'none'; form-action 'none';">
  <title>${displayName} - 配置页面</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
      color: #333;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      padding: 28px;
    }
    .header {
      border-bottom: 1px solid #eee;
      margin-bottom: 20px;
      padding-bottom: 14px;
    }
    .warning {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      color: #856404;
      margin: 14px 0 20px;
      padding: 12px;
    }
    .info-item {
      display: grid;
      gap: 8px;
      grid-template-columns: 120px 1fr;
      margin: 8px 0;
    }
    .label {
      font-weight: 600;
    }
    .value {
      color: #555;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .section {
      margin-top: 20px;
    }
    .section h3 {
      margin: 0 0 12px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 8px;
    }
    .action-button,
    .inline-action {
      border: 1px solid #2563eb;
      border-radius: 6px;
      color: #1d4ed8;
      font-size: 13px;
      font-weight: 600;
      padding: 6px 10px;
      text-decoration: none;
      background: #eff6ff;
    }
    .action-button.secondary {
      border-color: #475569;
      color: #334155;
      background: #f8fafc;
    }
    .action-button:hover,
    .inline-action:hover {
      background: #dbeafe;
    }
    .inline-action {
      margin-left: 8px;
    }
    .action-disabled {
      color: #6b7280;
      font-size: 13px;
      padding: 6px 0;
    }
    ul {
      margin: 8px 0 0;
      padding-left: 18px;
    }
    code {
      background: #f3f4f6;
      border-radius: 4px;
      color: #374151;
      display: inline-block;
      padding: 2px 6px;
      white-space: pre-wrap;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${displayName}</h1>
      <p>扩展配置与元信息（安全交互视图）</p>
    </div>

    <div class="warning">
      <strong>说明：</strong>页面内按钮由主进程白名单动作处理，不注入脚本、不启用 Node 权限。
    </div>

    <div class="section">
      <div class="info-item"><span class="label">扩展 ID</span><span class="value">${safeExtensionId}</span></div>
      <div class="info-item"><span class="label">版本</span><span class="value">${safeVersion}</span></div>
      <div class="info-item"><span class="label">描述</span><span class="value">${safeDescription}</span></div>
      <div class="info-item"><span class="label">主页</span><span class="value">${safeHomepage}</span></div>
      <div class="info-item"><span class="label">路径</span><span class="value">${safeExtensionPath}</span></div>
    </div>

    <div class="section">
      <h3>快速操作</h3>
      <div class="actions">${quickActionItems}</div>
    </div>

    <div class="section">
      <h3>可识别页面</h3>
      <ul>${optionsItems}</ul>
    </div>

    <div class="section">
      <h3>权限</h3>
      <ul>${permissionItems}</ul>
    </div>
  </div>
</body>
</html>`

        // 创建新窗口显示配置页面
        const configWindow = new BrowserWindow({
          width: 900,
          height: 700,
          minWidth: 600,
          minHeight: 400,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          },
          title: `${displayNameRaw} - 配置页面`,
          show: false
        })

        const isConfigActionUrl = (targetUrl: string): boolean => {
          try {
            const parsedUrl = new URL(targetUrl)
            return parsedUrl.protocol === 'app:' && parsedUrl.hostname === 'extension-config'
          } catch {
            return false
          }
        }

        const handleConfigAction = async (targetUrl: string): Promise<void> => {
          if (!isConfigActionUrl(targetUrl)) {
            return
          }

          try {
            const parsedUrl = new URL(targetUrl)
            const actionKey = parsedUrl.searchParams.get('action')
            if (!actionKey) {
              return
            }

            const action = configActions.get(actionKey)
            if (!action) {
              console.warn(`Unknown config action: ${actionKey}`)
              return
            }

            if (action.type === 'open-folder') {
              const openPathResult = await shell.openPath(registeredExtensionPath)
              if (typeof openPathResult === 'string' && openPathResult.trim().length > 0) {
                console.warn('Failed to open extension folder:', openPathResult)
              }
              return
            }

            if (action.type === 'close-window') {
              configWindow.close()
              return
            }

            if (action.type === 'open-homepage') {
              const homepageUrl = new URL(action.url)
              if (!['http:', 'https:'].includes(homepageUrl.protocol)) {
                return
              }

              await shell.openExternal(homepageUrl.toString())
              return
            }

            const targetExtensionUrl = new URL(action.url)
            if (
              targetExtensionUrl.protocol !== 'chrome-extension:' ||
              targetExtensionUrl.hostname !== resolvedExtensionId
            ) {
              return
            }

            if (action.openAsPopup) {
              await createExtensionPopup(action.url, action.title, resolvedExtensionId)
            } else {
              await createExtensionOptionsWindow(action.url, action.title, resolvedExtensionId)
            }
          } catch (actionError) {
            console.error('Failed to handle config action:', actionError)
          }
        }

        configWindow.webContents.on('will-navigate', (event, targetUrl) => {
          event.preventDefault()

          if (isConfigActionUrl(targetUrl)) {
            void handleConfigAction(targetUrl)
          }
        })

        configWindow.webContents.setWindowOpenHandler((details) => {
          if (isConfigActionUrl(details.url)) {
            void handleConfigAction(details.url)
          }
          return { action: 'deny' }
        })

        // 加载配置页面
        await configWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(configHtml)}`)

        // 窗口准备好后显示
        configWindow.once('ready-to-show', () => {
          configWindow.show()
          configWindow.focus()
        })

        return {
          success: true,
          windowId: configWindow.id
        }
      } catch (error) {
        console.error('Failed to create config page:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // 打开文件或文件夹
  ipcMain.handle('shell:openPath', async (_, path: string) => {
    try {
      // 输入验证
      if (!validateFilePath(path)) {
        return { success: false, error: 'Invalid file path format' }
      }

      const { shell } = await import('electron')

      await shell.openPath(path)
      return { success: true }
    } catch (error) {
      console.error('Failed to open path:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 在外部浏览器中打开 URL
  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    try {
      // 验证 URL 格式
      const urlObj = new URL(url)
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { success: false, error: 'Invalid URL protocol, only http and https are allowed' }
      }

      const { shell } = await import('electron')
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open external URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  })

  // 检查扩展文件结构
  ipcMain.handle(
    'extension:inspect-structure',
    async (_, extensionId: string, extensionPath?: string) => {
      try {
        // 输入验证
        if (!validateExtensionId(extensionId)) {
          return { success: false, error: 'Invalid extension ID format' }
        }
        if (extensionPath && !validateFilePath(extensionPath)) {
          return { success: false, error: 'Invalid file path format' }
        }

        const extension = extensionManager.getExtension(extensionId)
        if (!extension) {
          return { success: false, error: 'Extension not found' }
        }

        const registeredPath = resolve(extension.path)
        const targetPath = extensionPath ? resolve(extensionPath) : registeredPath
        if (!isPathInsideBase(registeredPath, targetPath)) {
          return { success: false, error: 'Path is outside extension directory' }
        }

        console.log(`Inspecting extension structure for: ${extensionId} at ${targetPath}`)
        const structure: ExtensionStructure = {
          id: extensionId,
          path: targetPath,
          files: [],
          directories: []
        }

        async function scanDirectory(dirPath: string, relativePath: string = ''): Promise<void> {
          if (!isPathInsideBase(registeredPath, dirPath)) {
            return
          }

          const items = await readdir(dirPath)

          for (const item of items) {
            const itemPath = resolve(dirPath, item)
            if (!isPathInsideBase(registeredPath, itemPath)) {
              continue
            }

            const itemRelativePath = relativePath ? join(relativePath, item) : item
            const stats = await lstat(itemPath)

            if (stats.isSymbolicLink()) {
              structure.files.push({
                name: item,
                path: itemRelativePath,
                type: 'symlink',
                size: stats.size
              })
              continue
            }

            if (stats.isDirectory()) {
              structure.directories.push({
                name: item,
                path: itemRelativePath,
                files: [],
                type: 'directory'
              })
              await scanDirectory(itemPath, itemRelativePath)
            } else {
              structure.files.push({
                name: item,
                path: itemRelativePath,
                type: 'file',
                size: stats.size
              })
            }
          }
        }

        await scanDirectory(targetPath)

        // 查找可能的选项页面
        const optionFiles = structure.files.filter(
          (file) =>
            file.name.toLowerCase().includes('option') ||
            file.name.toLowerCase().includes('setting') ||
            file.name.toLowerCase().includes('config') ||
            file.name.toLowerCase().includes('popup') ||
            file.name.toLowerCase().includes('index')
        )

        console.log(`Found ${optionFiles.length} potential option files:`, optionFiles)

        return {
          success: true,
          structure,
          optionFiles
        }
      } catch (error) {
        console.error(`Failed to inspect extension structure: ${extensionId}`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // 在主窗口中打开扩展选项页面
  ipcMain.handle(
    'window:open-extension-options-in-main',
    async (_, extensionIdOrUrl: string, optionsPath?: string) => {
      try {
        if (
          typeof extensionIdOrUrl !== 'string' ||
          extensionIdOrUrl.length === 0 ||
          extensionIdOrUrl.length > 2000
        ) {
          return { success: false, error: 'Invalid extension target format' }
        }

        let extensionId = extensionIdOrUrl
        let normalizedOptionsPath = normalizeExtensionRelativePath(optionsPath)

        // 兼容旧调用：直接传入 chrome-extension:// URL
        if (extensionIdOrUrl.startsWith('chrome-extension://')) {
          if (!validateUrl(extensionIdOrUrl)) {
            return { success: false, error: 'Invalid extension URL format' }
          }

          const parsedUrl = new URL(extensionIdOrUrl)
          extensionId = parsedUrl.hostname
          const urlPath = parsedUrl.pathname.replace(/^\/+/, '')
          const decodedUrlPath = decodeURIComponent(urlPath)
          const normalizedPathFromUrl = normalizeExtensionRelativePath(decodedUrlPath)
          if (urlPath.length > 0 && !normalizedPathFromUrl) {
            return { success: false, error: 'Invalid options path in URL' }
          }
          normalizedOptionsPath = normalizedPathFromUrl ?? normalizedOptionsPath
        } else if (optionsPath && !normalizedOptionsPath) {
          return { success: false, error: 'Invalid options path format' }
        }

        if (!validateExtensionId(extensionId)) {
          return { success: false, error: 'Invalid extension ID format' }
        }

        if (!mainWindow) {
          return {
            success: false,
            error: 'Main window not available'
          }
        }

        const extension = extensionManager.getExtension(extensionId)
        if (!extension) {
          return { success: false, error: 'Extension not found' }
        }

        const manifest = (extension.manifest ?? {}) as ExtensionManifest
        const candidatePaths = new Set<string>()
        if (normalizedOptionsPath) {
          candidatePaths.add(normalizedOptionsPath)
        }

        const manifestOptions = normalizeExtensionRelativePath(manifest.options_page)
        if (manifestOptions) {
          candidatePaths.add(manifestOptions)
        }

        const manifestActionPopup = normalizeExtensionRelativePath(manifest.action?.default_popup)
        if (manifestActionPopup) {
          candidatePaths.add(manifestActionPopup)
        }

        const manifestBrowserActionPopup = normalizeExtensionRelativePath(
          manifest.browser_action?.default_popup
        )
        if (manifestBrowserActionPopup) {
          candidatePaths.add(manifestBrowserActionPopup)
        }

        for (const fallbackPath of [
          'options.html',
          'options/index.html',
          'assets/options.html',
          'popup.html',
          'index.html',
          'settings.html',
          'config.html',
          'preferences.html',
          'page/options.html',
          'src/options.html'
        ]) {
          candidatePaths.add(fallbackPath)
        }

        console.log(`Opening extension options in main window for: ${extensionId}`)
        for (const candidatePath of candidatePaths) {
          const targetUrl = `chrome-extension://${extensionId}/${candidatePath}`
          if (!validateUrl(targetUrl)) {
            continue
          }

          try {
            await mainWindow.webContents.loadURL(targetUrl)
            return {
              success: true,
              url: targetUrl
            }
          } catch (error) {
            console.warn(`Failed to load extension options candidate path: ${candidatePath}`, error)
          }
        }

        const fallbackUrl = `chrome-extension://${extensionId}/`
        await mainWindow.webContents.loadURL(fallbackUrl)

        return {
          success: true,
          url: fallbackUrl
        }
      } catch (error: unknown) {
        console.error(`Failed to open extension options in main window: ${extensionIdOrUrl}`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    }
  )

  // 创建新窗口用于打开扩展选项页面
  ipcMain.handle('window:create-extension-options', async (_, url: string, title: string) => {
    const { BrowserWindow } = await import('electron')

    console.log(`Creating extension options window for: ${url}`)

    // 检查 URL 是否是 chrome-extension://
    if (url.startsWith('chrome-extension://')) {
      console.log('Chrome extension URL detected, using alternative approach')

      // 对于 chrome-extension:// URL，我们需要在主窗口的 webContents 中加载
      // 然后创建一个新窗口来显示内容

      const optionsWindow = new BrowserWindow({
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // 允许加载 chrome-extension:// URL
          allowRunningInsecureContent: false,
          experimentalFeatures: false
        },
        title: title,
        show: false
      })

      // 添加加载事件监听
      optionsWindow.webContents.on('did-start-loading', () => {
        console.log(`Extension options window started loading: ${url}`)
      })

      optionsWindow.webContents.on('did-finish-load', () => {
        console.log(`Extension options window finished loading: ${url}`)
      })

      optionsWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        console.error(
          `Extension options window failed to load: ${url}`,
          errorCode,
          errorDescription
        )
      })

      // 窗口准备好后显示
      optionsWindow.once('ready-to-show', () => {
        console.log(`Extension options window ready to show: ${title}`)
        optionsWindow.show()
        optionsWindow.focus() // 确保窗口获得焦点
      })

      // 窗口关闭时清理
      optionsWindow.on('closed', () => {
        console.log(`Extension options window closed: ${title}`)
      })

      try {
        // 尝试直接加载扩展 URL
        await optionsWindow.loadURL(url)
        console.log(`Extension options URL loaded successfully: ${url}`)
      } catch (error) {
        console.error(`Failed to load extension options URL: ${url}`, error)

        // 如果直接加载失败，尝试创建一个简单的 HTML 页面来加载扩展内容
        const fallbackHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>${title}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
              .error { color: red; }
              .info { color: #666; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>扩展选项页面</h1>
            <div class="error">
              <p>无法直接加载扩展页面: ${url}</p>
              <p>错误: ${error instanceof Error ? error.message : String(error)}</p>
            </div>
            <div class="info">
              <p>请尝试以下方法：</p>
              <ul>
                <li>右键点击浏览器工具栏中的扩展图标</li>
                <li>选择"选项"或"设置"</li>
                <li>或者在扩展管理页面中点击"选项"</li>
              </ul>
            </div>
          </body>
          </html>
        `

        await optionsWindow.loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(fallbackHtml)}`
        )
        console.log('Fallback HTML page loaded')
      }

      return {
        success: true,
        windowId: optionsWindow.id
      }
    }

    // 对于非 chrome-extension:// URL，使用原来的逻辑
    const optionsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true, // 修复类型检查错误
        allowRunningInsecureContent: false,
        experimentalFeatures: false
      },
      title: title,
      show: false
    })

    // 添加加载事件监听
    optionsWindow.webContents.on('did-start-loading', () => {
      console.log(`Extension options window started loading: ${url}`)
    })

    optionsWindow.webContents.on('did-finish-load', () => {
      console.log(`Extension options window finished loading: ${url}`)
    })

    optionsWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
      console.error(`Extension options window failed to load: ${url}`, errorCode, errorDescription)
    })

    // 窗口准备好后显示
    optionsWindow.once('ready-to-show', () => {
      console.log(`Extension options window ready to show: ${title}`)
      optionsWindow.show()
      optionsWindow.focus() // 确保窗口获得焦点
    })

    // 窗口关闭时清理
    optionsWindow.on('closed', () => {
      console.log(`Extension options window closed: ${title}`)
    })

    try {
      // 加载扩展选项页面
      await optionsWindow.loadURL(url)
      console.log(`Extension options URL loaded successfully: ${url}`)
    } catch (error) {
      console.error(`Failed to load extension options URL: ${url}`, error)
      optionsWindow.destroy()
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }

    return {
      success: true,
      windowId: optionsWindow.id
    }
  })

  // 对话框相关 IPC
  ipcMain.handle('dialog:open-directory', async (_, options?: Electron.OpenDialogOptions) => {
    const { dialog } = await import('electron')
    return dialog.showOpenDialog(mainWindow!, {
      ...options,
      properties: ['openDirectory']
    })
  })

  ipcMain.handle('dialog:open-file', async (_, options?: Electron.OpenDialogOptions) => {
    const { dialog } = await import('electron')
    return dialog.showOpenDialog(mainWindow!, {
      ...options,
      properties: ['openFile']
    })
  })

  // ===== Store 相关 IPC 处理器 =====

  // 获取所有主要分组
  ipcMain.handle('store:get-primary-groups', async () => {
    const storeService = await getStoreService()
    return storeService.getPrimaryGroups()
  })

  // 保存所有主要分组
  ipcMain.handle('store:set-primary-groups', async (_, groups: PrimaryGroup[]) => {
    const storeService = await getStoreService()
    return storeService.setPrimaryGroups(groups)
  })

  // 清除所有主要分组
  ipcMain.handle('store:clear-primary-groups', async () => {
    const storeService = await getStoreService()
    return storeService.clearPrimaryGroups()
  })

  // 添加主要分组
  ipcMain.handle('store:add-primary-group', async (_, group: Partial<PrimaryGroup>) => {
    const storeService = await getStoreService()
    return storeService.addPrimaryGroup(group)
  })

  // 更新主要分组
  ipcMain.handle(
    'store:update-primary-group',
    async (_, groupId: string, updates: Partial<PrimaryGroup>) => {
      const storeService = await getStoreService()
      return storeService.updatePrimaryGroup(groupId, updates)
    }
  )

  // 删除主要分组
  ipcMain.handle('store:delete-primary-group', async (_, groupId: string) => {
    const storeService = await getStoreService()
    return storeService.deletePrimaryGroup(groupId)
  })

  // 添加次要分组
  ipcMain.handle(
    'store:add-secondary-group',
    async (_, primaryGroupId: string, secondaryGroup: SecondaryGroup) => {
      const storeService = await getStoreService()
      return storeService.addSecondaryGroup(primaryGroupId, secondaryGroup)
    }
  )

  // 更新次要分组
  ipcMain.handle(
    'store:update-secondary-group',
    async (_, secondaryGroupId: string, updates: Partial<SecondaryGroup>) => {
      const storeService = await getStoreService()
      return storeService.updateSecondaryGroup(secondaryGroupId, updates)
    }
  )

  // 删除次要分组
  ipcMain.handle('store:delete-secondary-group', async (_, secondaryGroupId: string) => {
    const storeService = await getStoreService()
    return storeService.deleteSecondaryGroup(secondaryGroupId)
  })

  // 在主要分组中添加网站
  ipcMain.handle(
    'store:add-website-to-primary',
    async (_, primaryGroupId: string, website: Website) => {
      const storeService = await getStoreService()
      return storeService.addWebsiteToPrimaryGroup(primaryGroupId, website)
    }
  )

  // 在次要分组中添加网站
  ipcMain.handle(
    'store:add-website-to-secondary',
    async (_, secondaryGroupId: string, website: Website) => {
      const storeService = await getStoreService()
      return storeService.addWebsiteToSecondaryGroup(secondaryGroupId, website)
    }
  )

  // 更新网站
  ipcMain.handle(
    'store:update-website',
    async (_, websiteId: string, updates: Partial<Website>) => {
      const storeService = await getStoreService()
      return storeService.updateWebsite(websiteId, updates)
    }
  )

  // 删除网站
  ipcMain.handle('store:delete-website', async (_, websiteId: string) => {
    const storeService = await getStoreService()
    return storeService.deleteWebsite(websiteId)
  })

  // 更新二级分组排序
  ipcMain.handle(
    'store:update-secondary-group-order',
    async (_, primaryGroupId: string, secondaryGroupIds: string[]) => {
      const storeService = await getStoreService()
      return storeService.updateSecondaryGroupOrder(primaryGroupId, secondaryGroupIds)
    }
  )

  // 更新网站排序
  ipcMain.handle(
    'store:update-website-order',
    async (_, secondaryGroupId: string, websiteIds: string[]) => {
      const storeService = await getStoreService()
      return storeService.updateWebsiteOrder(secondaryGroupId, websiteIds)
    }
  )

  // 批量更新网站排序
  ipcMain.handle('store:batch-update-website-orders', async (_, updates: WebsiteOrderUpdate[]) => {
    const storeService = await getStoreService()
    return storeService.batchUpdateWebsiteOrders(updates)
  })

  // 获取窗口状态
  ipcMain.handle('store:get-window-state', async () => {
    const storeService = await getStoreService()
    return storeService.getWindowState()
  })

  // 设置窗口状态
  ipcMain.handle('store:set-window-state', async (_, state: Partial<WindowState>) => {
    const storeService = await getStoreService()
    return storeService.setWindowState(state)
  })

  // 获取设置
  ipcMain.handle('store:get-settings', async () => {
    const storeService = await getStoreService()
    return storeService.getSettings()
  })

  // 更新设置
  ipcMain.handle('store:update-settings', async (_, updates: Partial<Settings>) => {
    const storeService = await getStoreService()
    return storeService.updateSettings(updates)
  })

  // 重置为默认值
  ipcMain.handle('store:reset-to-defaults', async (_, defaultGroups: PrimaryGroup[]) => {
    const storeService = await getStoreService()
    return storeService.resetToDefaults(defaultGroups)
  })

  // 清除所有数据
  ipcMain.handle('store:clear-all', async () => {
    const storeService = await getStoreService()
    return storeService.clearAll()
  })

  // 获取数据路径
  ipcMain.handle('store:get-data-path', () => {
    try {
      const path = app.getPath('userData')
      return { success: true, path }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })

  // ===== Favicon 相关 IPC 处理器 =====

  // 获取网站 favicon 的 IPC 处理器
  ipcMain.handle('get-favicon', async (_, url: string, options?: { force?: boolean }) => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return await faviconService.getFavicon(url, options)
    } catch (error) {
      console.error('Error getting favicon:', error)
      return null
    }
  })

  // 批量预加载 favicon 的 IPC 处理器
  ipcMain.handle('preload-favicons', async (_, urls: string[], priority?: string[]) => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return await faviconService.preloadFavicons({ urls, priority })
    } catch (error) {
      console.error('Error preloading favicons:', error)
      return []
    }
  })

  // 获取 favicon 缓存统计信息的 IPC 处理器
  ipcMain.handle('get-favicon-stats', async () => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return faviconService.getCacheStats()
    } catch (error) {
      console.error('Error getting favicon stats:', error)
      return { totalEntries: 0, hitRate: 0, memoryUsage: 0 }
    }
  })

  // 清理 favicon 缓存的 IPC 处理器
  ipcMain.handle('clear-favicon-cache', async () => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      faviconService.clearCache()
      return { success: true }
    } catch (error) {
      console.error('Error clearing favicon cache:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // 获取扩展目录中的文件列表
  ipcMain.handle('extension:get-files', async (_, extensionId: string) => {
    try {
      const { existsSync, readdirSync } = await import('fs')
      const { join } = await import('path')

      // 获取扩展信息
      const extension = extensionManager.getExtension(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      // 检查扩展目录是否存在
      if (!existsSync(extension.path)) {
        return { success: false, error: 'Extension directory not found' }
      }

      // 读取目录中的文件和子目录
      const allFiles = readdirSync(extension.path, { withFileTypes: true })

      // 收集可能的页面文件
      const possiblePages: string[] = []

      for (const dirent of allFiles) {
        if (dirent.isFile()) {
          // 直接的 HTML 文件
          const name = dirent.name.toLowerCase()
          if (name.endsWith('.html') || name.endsWith('.htm') || name.endsWith('.xhtml')) {
            possiblePages.push(dirent.name)
          }
        } else if (dirent.isDirectory()) {
          // 检查目录中是否有 index.html
          const indexPath = join(extension.path, dirent.name, 'index.html')
          const htmPath = join(extension.path, dirent.name, 'index.htm')

          if (existsSync(indexPath)) {
            possiblePages.push(`${dirent.name}/index.html`)
          } else if (existsSync(htmPath)) {
            possiblePages.push(`${dirent.name}/index.htm`)
          }

          // 也检查目录中是否有其他 HTML 文件
          try {
            const dirFiles = readdirSync(join(extension.path, dirent.name))
            for (const dirFile of dirFiles) {
              if (
                dirFile.toLowerCase().endsWith('.html') ||
                dirFile.toLowerCase().endsWith('.htm')
              ) {
                possiblePages.push(`${dirent.name}/${dirFile}`)
              }
            }
          } catch {
            // 忽略无法读取的目录
          }
        }
      }

      // 按优先级排序：options, popup, index
      const priorityOrder = ['options', 'popup', 'index', 'home', 'main']
      possiblePages.sort((a, b) => {
        const aPriority = priorityOrder.findIndex((p) => a.toLowerCase().includes(p))
        const bPriority = priorityOrder.findIndex((p) => b.toLowerCase().includes(p))
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority
        if (aPriority !== -1) return -1
        if (bPriority !== -1) return 1
        return 0
      })

      return { success: true, files: possiblePages, manifest: extension.manifest }
    } catch (error) {
      console.error('Error getting extension files:', error)
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

// 存储相关处理器 - 用于跨 WebView 共享数据
const sharedStorage = new Map<string, string>()

ipcMain.handle('storage:get-item', (_, key: string) => {
  try {
    if (typeof key !== 'string' || key.length === 0 || key.length > 1000) {
      console.warn('Invalid storage key:', key)
      return null
    }
    return sharedStorage.get(key) || null
  } catch (error) {
    console.error('Error getting storage item:', error)
    return null
  }
})

ipcMain.handle('storage:set-item', (_, key: string, value: string) => {
  try {
    if (typeof key !== 'string' || key.length === 0 || key.length > 1000) {
      console.warn('Invalid storage key:', key)
      return false
    }
    if (typeof value !== 'string' || value.length > 10000) {
      console.warn('Invalid storage value, too large')
      return false
    }
    sharedStorage.set(key, value)
    return true
  } catch (error) {
    console.error('Error setting storage item:', error)
    return false
  }
})

ipcMain.handle('storage:remove-item', (_, key: string) => {
  try {
    if (typeof key !== 'string' || key.length === 0 || key.length > 1000) {
      console.warn('Invalid storage key:', key)
      return false
    }
    sharedStorage.delete(key)
    return true
  } catch (error) {
    console.error('Error removing storage item:', error)
    return false
  }
})

ipcMain.handle('storage:clear', () => {
  try {
    sharedStorage.clear()
    return true
  } catch (error) {
    console.error('Error clearing storage:', error)
    return false
  }
})

ipcMain.handle('storage:get-all', () => {
  try {
    return Object.fromEntries(sharedStorage)
  } catch (error) {
    console.error('Error getting all storage items:', error)
    return {}
  }
})
