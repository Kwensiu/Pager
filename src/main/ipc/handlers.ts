import { URL } from 'url'
import { get as httpRequest } from 'https'
import { get as httpRequestHttp } from 'http'
import { ipcMain } from 'electron'
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

export async function registerIpcHandlers(mainWindow: Electron.BrowserWindow): Promise<void> {
  const { storeService } = await import('../services')

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

  // 窗口管理相关 IPC
  ipcMain.on('window:open-dev-tools', () => {
    if (mainWindow) {
      mainWindow.webContents.openDevTools()
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

  // ===== Favicon 相关 IPC 处理器 =====

  // 获取网站 favicon 的 IPC 处理器
  ipcMain.handle('get-favicon', async (_, url: string) => {
    try {
      // 解析输入的 URL
      const parsedUrl = new URL(url)
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`
      const hostname = parsedUrl.hostname

      // 定义常见的 favicon 路径
      const commonFaviconPaths = [
        '/favicon.ico',
        '/favicon.png',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png',
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png',
        '/icon-192x192.png',
        '/icon-512x512.png',
        '/static/favicon.ico',
        '/assets/favicon.ico'
      ]

      // 首先尝试常见 favicon 文件路径
      for (const path of commonFaviconPaths) {
        try {
          const faviconUrl = `${baseUrl}${path}`
          const statusCode = await checkUrlStatus(faviconUrl)
          if (statusCode < 400) {
            return faviconUrl
          }
        } catch {
          // 继续尝试下一个路径
          continue
        }
      }

      // 如果直接访问失败，尝试解析页面HTML获取图标链接
      try {
        const html = await fetchUrlContent(url)
        if (html) {
          // 按优先级排序的图标选择器
          const iconSelectors = [
            'link[rel="apple-touch-icon"][sizes="180x180"]', // 高优先级：特定尺寸的apple touch icon
            'link[rel="icon"][sizes="192x192"]', // 高优先级：Android规范尺寸
            'link[rel="icon"][sizes="32x32"]', // 标准favicon尺寸
            'link[rel="icon"][sizes="16x16"]', // 标准favicon尺寸
            'link[rel="shortcut icon"]', // 传统快捷方式图标
            'link[rel="apple-touch-icon"]', // apple touch icon（无特定尺寸）
            'link[rel="icon"]', // 通用图标标签
            'link[rel*="icon"]' // 包含icon的rel属性
          ]

          // 按优先级顺序尝试每个选择器
          for (const selector of iconSelectors) {
            const iconLinks = extractLinkTags(html, selector)

            // 按文档顺序尝试每个匹配的元素
            for (const iconLink of iconLinks) {
              let href = extractHref(iconLink)

              if (href) {
                // 处理相对路径
                if (href.startsWith('//')) {
                  href = parsedUrl.protocol + href
                } else if (href.startsWith('/')) {
                  href = baseUrl + href
                } else if (!href.startsWith('http')) {
                  href = new URL(href, url).href
                }

                // 验证图标 URL 是否有效
                try {
                  const statusCode = await checkUrlStatus(href)
                  if (statusCode < 400) {
                    return href
                  }
                } catch {
                  console.log(`Icon URL not accessible: ${href}`)
                  continue
                }
              }
            }
          }
        }
      } catch {
        console.error('Error fetching page to extract favicon')
      }

      // 尝试多个第三方favicon服务作为备选方案
      const faviconServices = [
        `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
        `https://t0.gstatic.com/favicon?domain=${hostname}&sz=64`,
        `https://icon.horse/icon/${hostname}`,
        `https://favicon.io/favicon/${hostname}/`
      ]

      for (const serviceUrl of faviconServices) {
        try {
          const statusCode = await checkUrlStatus(serviceUrl)
          if (statusCode < 400) {
            return serviceUrl
          }
        } catch {
          console.log(`Favicon service failed: ${serviceUrl}`)
          continue
        }
      }

      // 如果所有尝试都失败了，返回 null
      return null
    } catch {
      console.error('Error getting favicon')
      return null
    }
  })
}

// 检查URL状态的辅助函数
function checkUrlStatus(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'HEAD',
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
      }
    }

    const request = parsedUrl.protocol === 'https:' ? httpRequest : httpRequestHttp

    const req = request(options, (res) => {
      resolve(res.statusCode || 500)
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

// 获取URL内容的辅助函数
function fetchUrlContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; favicon-fetcher)'
      }
    }

    const request = parsedUrl.protocol === 'https:' ? httpRequest : httpRequestHttp

    let data = ''
    const req = request(options, (res) => {
      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        resolve(data)
      })
    })

    req.on('error', (e) => {
      reject(e)
    })

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('Request timeout'))
    })

    req.end()
  })
}

// 从HTML中提取link标签的辅助函数
function extractLinkTags(html: string, selector: string): string[] {
  // 通过正则表达式解析HTML，提取匹配的link标签
  // 这是一个简化的实现，可以处理基本的link标签匹配
  const relMatch = selector.includes('[rel=')
    ? selector.match(/link\[rel=["']?([^"'\]]*)["']?\]/)?.[1]
    : null
  const sizesMatch = selector.includes('sizes=')
    ? selector.match(/sizes=["']?([^"'\]]*)["']?\]/)?.[1]
    : null

  // 提取所有link标签
  const linkTagRegex = /<link\s+([^>]+)>/gi
  const matches: string[] = []

  let match
  while ((match = linkTagRegex.exec(html)) !== null) {
    const tag = match[0]
    const tagContent = match[1]

    // 检查是否匹配选择器条件
    let matchesSelector = true

    if (relMatch) {
      const relPattern = new RegExp(`rel\\s*=\\s*["']([^"']*)["']`, 'i')
      const relMatchResult = relPattern.exec(tagContent)
      if (!relMatchResult) {
        matchesSelector = false
      } else {
        const relValue = relMatchResult[1].toLowerCase()
        if (relMatch.includes('*')) {
          // 处理包含匹配，例如 [rel*="icon"]
          if (!relValue.includes(relMatch.replace('*=', '').replace(/["'\]]/g, ''))) {
            matchesSelector = false
          }
        } else if (relValue !== relMatch) {
          // 完全匹配
          matchesSelector = false
        }
      }
    }

    if (sizesMatch && matchesSelector) {
      const sizesPattern = new RegExp(`sizes\\s*=\\s*["']([^"']*)["']`, 'i')
      const sizesMatchResult = sizesPattern.exec(tagContent)
      if (!sizesMatchResult || sizesMatchResult[1] !== sizesMatch) {
        matchesSelector = false
      }
    }

    if (matchesSelector) {
      matches.push(tag)
    }
  }

  return matches
}

// 从link标签中提取href属性的辅助函数
function extractHref(linkTag: string): string | null {
  const hrefPattern = /href\s*=\s*["']([^"']*)["']/i
  const match = hrefPattern.exec(linkTag)
  return match ? match[1] : null
}
