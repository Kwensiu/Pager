import { ipcMain, Menu, shell, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
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

const extensionManager = ExtensionManager.getInstance()

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
  const { storeService } = await import('../services/store')

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

  // ===== WebView 相关 IPC 处理器 =====

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
  ipcMain.on('webview:load-url', (_, url: string) => {
    // 发送URL加载命令到渲染进程
    mainWindow.webContents.send('webview:load-url', url)
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

  // 在主窗口中加载扩展页面
  ipcMain.handle('window:load-extension-url', async (_, url: string) => {
    try {
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
      const { BrowserWindow } = await import('electron')

      console.log(`Creating config page for extension: ${extensionName}`)

      try {
        // 创建一个简单的配置页面
        const configHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${extensionName} - 配置页面</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
            color: #333;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 30px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .extension-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .info-item {
            margin: 8px 0;
            display: flex;
            align-items: center;
        }
        .info-label {
            font-weight: 600;
            margin-right: 10px;
            min-width: 100px;
        }
        .info-value {
            color: #666;
            word-break: break-all;
        }
        .config-section {
            margin: 20px 0;
        }
        .config-section h3 {
            color: #2c3e50;
            margin-bottom: 15px;
        }
        .config-item {
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            margin: 10px 0;
        }
        .config-item h4 {
            margin: 0 0 10px 0;
            color: #34495e;
        }
        .config-item p {
            margin: 0;
            color: #7f8c8d;
            font-size: 14px;
        }
        .actions {
            margin-top: 30px;
            text-align: center;
        }
        .btn {
            background: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 0 10px;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover {
            background: #2980b9;
        }
        .btn.secondary {
            background: #95a5a6;
        }
        .btn.secondary:hover {
            background: #7f8c8d;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${extensionName}</h1>
            <p>扩展配置页面</p>
        </div>

        <div class="warning">
            <strong>注意：</strong>这是一个简化的配置页面。完整的扩展功能需要在 Chrome 环境中运行。
        </div>

        <div class="extension-info">
            <div class="info-item">
                <span class="info-label">扩展 ID:</span>
                <span class="info-value">${extensionId}</span>
            </div>
            <div class="info-item">
                <span class="info-label">版本:</span>
                <span class="info-value">${manifest.version || '未知'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">描述:</span>
                <span class="info-value">${manifest.description || '无描述'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">路径:</span>
                <span class="info-value">${extensionPath}</span>
            </div>
            ${
              manifest.homepage_url
                ? `
            <div class="info-item">
                <span class="info-label">主页:</span>
                <span class="info-value"><a href="${manifest.homepage_url}" target="_blank">${manifest.homepage_url}</a></span>
            </div>
            `
                : ''
            }
        </div>

        <div class="config-section">
            <h3>配置选项</h3>
            
            ${
              manifest.options_page
                ? `
            <div class="config-item">
                <h4>选项页面</h4>
                <p>扩展提供了专门的选项页面: ${manifest.options_page}</p>
                <button class="btn" onclick="openOptionsPage()">打开原始选项页面</button>
            </div>
            `
                : ''
            }
            
            ${
              manifest.action?.default_popup
                ? `
            <div class="config-item">
                <h4>弹出页面</h4>
                <p>扩展提供了弹出页面: ${manifest.action.default_popup}</p>
                <button class="btn" onclick="openPopupPage()">打开弹出页面</button>
            </div>
            `
                : ''
            }
            
            ${
              manifest.browser_action?.default_popup
                ? `
            <div class="config-item">
                <h4>浏览器操作弹出页面</h4>
                <p>扩展提供了浏览器操作弹出页面: ${manifest.browser_action.default_popup}</p>
                <button class="btn" onclick="openBrowserActionPage()">打开弹出页面</button>
            </div>
            `
                : ''
            }
        </div>

        <div class="config-section">
            <h3>权限信息</h3>
            ${
              manifest.permissions && manifest.permissions.length > 0
                ? `
            <div class="config-item">
                <h4>所需权限</h4>
                <ul>
                    ${manifest.permissions.map((perm: string) => `<li>${perm}</li>`).join('')}
                </ul>
            </div>
            `
                : '<div class="config-item"><p>无特殊权限要求</p></div>'
            }
        </div>

        <div class="actions">
            <button class="btn secondary" onclick="openExtensionFolder()">打开扩展文件夹</button>
            <button class="btn" onclick="closeWindow()">关闭窗口</button>
        </div>
    </div>

    <script>
        const { ipcRenderer } = require('electron');
        
        function openOptionsPage() {
            const path = '${extensionPath.replace(/\\/g, '\\\\')}/${manifest.options_page || ''}';
            if (path) {
                ipcRenderer.invoke('shell:openPath', path);
            }
        }
        
        function openPopupPage() {
            const path = '${extensionPath.replace(/\\/g, '\\\\')}/${manifest.action?.default_popup || ''}';
            if (path) {
                ipcRenderer.invoke('shell:openPath', path);
            }
        }
        
        function openBrowserActionPage() {
            const path = '${extensionPath.replace(/\\/g, '\\\\')}/${manifest.browser_action?.default_popup || ''}';
            if (path) {
                ipcRenderer.invoke('shell:openPath', path);
            }
        }
        
        function openExtensionFolder() {
            const path = '${extensionPath.replace(/\\/g, '\\\\')}';
            ipcRenderer.invoke('shell:openPath', path);
        }
        
        function closeWindow() {
            window.close();
        }
    </script>
</body>
</html>
      `

        // 创建新窗口显示配置页面
        const configWindow = new BrowserWindow({
          width: 900,
          height: 700,
          minWidth: 600,
          minHeight: 400,
          webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: true
          },
          title: `${extensionName} - 配置页面`,
          show: false
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
    const { shell } = await import('electron')

    try {
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

  // 检查扩展文件结构
  ipcMain.handle(
    'extension:inspect-structure',
    async (_, extensionId: string, extensionPath: string) => {
      const { readdir, stat } = await import('fs/promises')
      const { join } = await import('path')

      console.log(`Inspecting extension structure for: ${extensionId} at ${extensionPath}`)

      try {
        const structure: ExtensionStructure = {
          id: extensionId,
          path: extensionPath,
          files: [],
          directories: []
        }

        async function scanDirectory(dirPath: string, relativePath: string = ''): Promise<void> {
          const items = await readdir(dirPath)

          for (const item of items) {
            const itemPath = join(dirPath, item)
            const itemRelativePath = relativePath ? join(relativePath, item) : item
            const stats = await stat(itemPath)

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

        await scanDirectory(extensionPath)

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
    async (_, extensionId: string, optionsPath?: string) => {
      console.log(`Opening extension options in main window for: ${extensionId}`)

      if (!mainWindow) {
        return {
          success: false,
          error: 'Main window not available'
        }
      }

      try {
        // 使用 Chrome 扩展 API 来打开选项页面
        const script = `
        console.log('Attempting to open extension options for:', '${extensionId}');
        
        // 尝试使用 Chrome 扩展 API
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          console.log('Using chrome.runtime.sendMessage');
          chrome.runtime.sendMessage('${extensionId}', { action: 'openOptions' }, (response) => {
            console.log('Extension options response:', response);
            if (chrome.runtime.lastError) {
              console.error('Chrome runtime error:', chrome.runtime.lastError);
            }
          });
        } else if (chrome && chrome.management && chrome.management.launchApp) {
          console.log('Using chrome.management.launchApp');
          chrome.management.launchApp('${extensionId}', (launchInfo) => {
            console.log('Extension launched:', launchInfo);
          });
        } else {
          console.log('Chrome APIs not available, trying direct navigation');
          
          // 如果 API 不可用，尝试直接导航
          ${
            optionsPath
              ? `
          console.log('Trying specific path:', '${optionsPath}');
          try {
            window.location.href = 'chrome-extension://${extensionId}/${optionsPath}';
            console.log('Navigation to specific path completed');
          } catch (e) {
            console.error('Failed to load specific path:', e);
          }`
              : `
          // 尝试常见的选项页面路径
          const possiblePaths = [
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
          ];
          
          console.log('Trying possible paths:', possiblePaths);
          
          for (const path of possiblePaths) {
            console.log('Trying path:', path);
            try {
              window.location.href = 'chrome-extension://${extensionId}/' + path;
              console.log('Successfully navigated to:', path);
              break;
            } catch (e) {
              console.log('Failed to load path:', path, e);
            }
          }
          
          // 如果所有路径都失败，尝试打开扩展根目录
          console.log('All paths failed, trying extension root');
          try {
            window.location.href = 'chrome-extension://${extensionId}/';
            console.log('Navigated to extension root');
          } catch (e) {
            console.error('Failed to navigate to extension root:', e);
          }
          `
          }
        }
        
        // 添加一个检查函数来验证页面是否加载成功
        setTimeout(() => {
          console.log('Current URL after navigation attempts:', window.location.href);
          console.log('Page title:', document.title);
        }, 1000);
      `

        await mainWindow.webContents.executeJavaScript(script)
        console.log(`Extension options script executed for: ${extensionId}`)

        return {
          success: true
        }
      } catch (error) {
        console.error(`Failed to open extension options in main window: ${extensionId}`, error)
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
  ipcMain.handle('store:get-primary-groups', () => {
    return storeService.getPrimaryGroups()
  })

  // 保存所有主要分组
  ipcMain.handle('store:set-primary-groups', (_, groups: PrimaryGroup[]) => {
    return storeService.setPrimaryGroups(groups)
  })

  // 清除所有主要分组
  ipcMain.handle('store:clear-primary-groups', () => {
    return storeService.clearPrimaryGroups()
  })

  // 添加主要分组
  ipcMain.handle('store:add-primary-group', (_, group: Partial<PrimaryGroup>) => {
    return storeService.addPrimaryGroup(group)
  })

  // 更新主要分组
  ipcMain.handle(
    'store:update-primary-group',
    (_, groupId: string, updates: Partial<PrimaryGroup>) => {
      return storeService.updatePrimaryGroup(groupId, updates)
    }
  )

  // 删除主要分组
  ipcMain.handle('store:delete-primary-group', (_, groupId: string) => {
    return storeService.deletePrimaryGroup(groupId)
  })

  // 添加次要分组
  ipcMain.handle(
    'store:add-secondary-group',
    (_, primaryGroupId: string, secondaryGroup: SecondaryGroup) => {
      return storeService.addSecondaryGroup(primaryGroupId, secondaryGroup)
    }
  )

  // 更新次要分组
  ipcMain.handle(
    'store:update-secondary-group',
    (_, secondaryGroupId: string, updates: Partial<SecondaryGroup>) => {
      return storeService.updateSecondaryGroup(secondaryGroupId, updates)
    }
  )

  // 删除次要分组
  ipcMain.handle('store:delete-secondary-group', (_, secondaryGroupId: string) => {
    return storeService.deleteSecondaryGroup(secondaryGroupId)
  })

  // 在主要分组中添加网站
  ipcMain.handle('store:add-website-to-primary', (_, primaryGroupId: string, website: Website) => {
    return storeService.addWebsiteToPrimaryGroup(primaryGroupId, website)
  })

  // 在次要分组中添加网站
  ipcMain.handle(
    'store:add-website-to-secondary',
    (_, secondaryGroupId: string, website: Website) => {
      return storeService.addWebsiteToSecondaryGroup(secondaryGroupId, website)
    }
  )

  // 更新网站
  ipcMain.handle('store:update-website', (_, websiteId: string, updates: Partial<Website>) => {
    return storeService.updateWebsite(websiteId, updates)
  })

  // 删除网站
  ipcMain.handle('store:delete-website', (_, websiteId: string) => {
    return storeService.deleteWebsite(websiteId)
  })

  // 更新二级分组排序
  ipcMain.handle(
    'store:update-secondary-group-order',
    (_, primaryGroupId: string, secondaryGroupIds: string[]) => {
      return storeService.updateSecondaryGroupOrder(primaryGroupId, secondaryGroupIds)
    }
  )

  // 更新网站排序
  ipcMain.handle(
    'store:update-website-order',
    (_, secondaryGroupId: string, websiteIds: string[]) => {
      return storeService.updateWebsiteOrder(secondaryGroupId, websiteIds)
    }
  )

  // 批量更新网站排序
  ipcMain.handle('store:batch-update-website-orders', (_, updates: WebsiteOrderUpdate[]) => {
    return storeService.batchUpdateWebsiteOrders(updates)
  })

  // 获取窗口状态
  ipcMain.handle('store:get-window-state', () => {
    return storeService.getWindowState()
  })

  // 设置窗口状态
  ipcMain.handle('store:set-window-state', (_, state: Partial<WindowState>) => {
    return storeService.setWindowState(state)
  })

  // 获取设置
  ipcMain.handle('store:get-settings', () => {
    return storeService.getSettings()
  })

  // 更新设置
  ipcMain.handle('store:update-settings', (_, updates: Partial<Settings>) => {
    return storeService.updateSettings(updates)
  })

  // 重置为默认值
  ipcMain.handle('store:reset-to-defaults', (_, defaultGroups: PrimaryGroup[]) => {
    return storeService.resetToDefaults(defaultGroups)
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
  ipcMain.handle('get-favicon', async (_, url: string) => {
    try {
      const { FaviconService } = await import('../services')
      const faviconService = FaviconService.getInstance()
      return await faviconService.getFavicon(url)
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
}
