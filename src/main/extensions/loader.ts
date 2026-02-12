import path from 'path'
import fs from 'fs/promises'
import { session } from 'electron'
import type { ExtensionManifest, ExtensionInfo, ExtensionLoadResult } from './types'
import { PROTOCOL_CONSTANTS } from '../../shared/constants/extensionConstants'

/**
 * 扩展加载器类
 * 负责加载和卸载 Chrome 扩展
 */
export class ExtensionLoader {
  private loadedExtensions = new Map<string, ExtensionInfo>()

  /**
   * 验证扩展文件夹是否有效
   */
  private async validateExtension(extensionPath: string): Promise<ExtensionManifest> {
    const manifestPath = path.join(extensionPath, 'manifest.json')

    try {
      // 检查 manifest.json 是否存在
      await fs.access(manifestPath)
    } catch {
      throw new Error('Extension manifest.json not found')
    }

    // 读取并解析 manifest.json
    const manifestContent = await fs.readFile(manifestPath, 'utf-8')
    let manifest: ExtensionManifest

    try {
      manifest = JSON.parse(manifestContent)
    } catch {
      throw new Error('Invalid manifest.json format')
    }

    // 验证必需字段
    if (!manifest.name || !manifest.version) {
      throw new Error('Manifest must contain name and version')
    }

    return manifest
  }

  /**
   * 加载扩展
   * @param extensionPath 扩展文件夹路径
   * @returns 扩展信息
   */
  async loadExtension(extensionPath: string): Promise<ExtensionLoadResult> {
    // 验证扩展
    const manifest = await this.validateExtension(extensionPath)

    // 加载扩展到专用 session（而不是主session）
    const extensionSession = session.fromPartition(PROTOCOL_CONSTANTS.EXTENSION_PARTITION)
    const { id } = await extensionSession.loadExtension(extensionPath)

    const extensionInfo: ExtensionInfo = {
      id,
      name: manifest.name,
      version: manifest.version,
      path: extensionPath,
      enabled: true,
      manifest
    }

    // 返回符合 ExtensionLoadResult 接口的结果
    const result: ExtensionLoadResult = {
      id,
      name: manifest.name,
      version: manifest.version,
      path: extensionPath,
      enabled: true,
      manifest
    }

    this.loadedExtensions.set(id, extensionInfo)

    console.log(`Extension loaded: ${manifest.name} (${id})`)

    return result
  }

  /**
   * 卸载扩展
   * @param extensionId 扩展 ID
   */
  async unloadExtension(extensionId: string): Promise<void> {
    try {
      // 使用专用session卸载扩展
      const extensionSession = session.fromPartition(PROTOCOL_CONSTANTS.EXTENSION_PARTITION)
      await extensionSession.removeExtension(extensionId)
      this.loadedExtensions.delete(extensionId)
      console.log(`Extension unloaded: ${extensionId}`)
    } catch (error) {
      console.error(`Failed to unload extension ${extensionId}:`, error)
      throw error
    }
  }

  /**
   * 获取所有已加载的扩展
   */
  getLoadedExtensions(): ExtensionInfo[] {
    return Array.from(this.loadedExtensions.values())
  }

  /**
   * 获取指定扩展的信息
   * @param extensionId 扩展 ID
   */
  getExtension(extensionId: string): ExtensionInfo | undefined {
    return this.loadedExtensions.get(extensionId)
  }

  /**
   * 检查扩展是否已加载
   * @param extensionId 扩展 ID
   */
  isExtensionLoaded(extensionId: string): boolean {
    return this.loadedExtensions.has(extensionId)
  }

  /**
   * 清空所有已加载的扩展
   */
  async unloadAllExtensions(): Promise<void> {
    const extensionIds = Array.from(this.loadedExtensions.keys())

    for (const id of extensionIds) {
      try {
        await this.unloadExtension(id)
      } catch (error) {
        console.error(`Failed to unload extension ${id}:`, error)
      }
    }
  }
}
