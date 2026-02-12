import { join, resolve, relative, sep } from 'path'
import {
  existsSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync as fsReadFileSync,
  realpathSync
} from 'fs'
import * as os from 'os'
import type { ExtensionInfo, ExtensionManifest, ExtensionConfig } from './types'
import {
  PROTOCOL_CONSTANTS,
  CRX_CONSTANTS,
  ERROR_CODES,
  STORAGE_CONSTANTS,
  LOG_PREFIXES
} from '../../shared/constants/extensionConstants'
import { extensionIsolationManager } from '../services/extensionIsolation'
import { extensionPermissionManager } from '../services/extensionPermissionManager'
import { extensionErrorManager } from '../services/extensionErrorManager'
import {
  ExtensionSettings,
  ExtensionIsolationLevel,
  ExtensionRiskLevel
} from '../../shared/types/store'
import type { Session } from 'electron'
import {
  generateChromePolyfillCode,
  CHROME_POLYFILL_INJECTED
} from '../../shared/utils/chromePolyfill'

// 动态导入 adm-zip 以避免在模块顶层导入
let AdmZip: typeof import('adm-zip').default | null = null
async function getAdmZip(): Promise<typeof import('adm-zip').default> {
  if (!AdmZip) {
    AdmZip = (await import('adm-zip')).default
  }
  return AdmZip
}

// 解析 CRX 文件
function parseCrxFile(crxPath: string): Buffer {
  const data = fsReadFileSync(crxPath)

  // 检查文件大小
  if (data.length < 16) {
    throw new Error('Invalid CRX file: file too small (less than 16 bytes)')
  }

  // 检查 CRX 魔数
  const magic = data.toString('ascii', 0, 4)

  if (magic !== 'Cr24') {
    throw new Error(`Invalid CRX file: magic number mismatch (expected "Cr24", got "${magic}")`)
  }

  // 读取版本号
  const version = data.readUInt32LE(4)

  if (version !== 2 && version !== 3) {
    throw new Error(`Unsupported CRX version: ${version} (only version 2 and 3 are supported)`)
  }

  let headerSize = 16
  let zipDataOffset = 16

  if (version === 3) {
    // CRX v3 有不同的头部结构
    if (data.length < 32) {
      throw new Error('Invalid CRX v3 file: file too small for v3 header')
    }

    // v3 格式: [magic(4)][version(4)][headerLength(4)][pubkeyOffset(4)][pubkeyLength(4)][sigLength(4)]
    const headerLength = data.readUInt32LE(8)
    const pubkeyOffset = headerLength + 12

    // 验证参数的合理性 - CRX v3 的偏移和长度可能很大，需要更宽松的检查
    if (headerLength > data.length || pubkeyOffset > data.length) {
      // 尝试搜索 ZIP 魔数
      return parseCrxV2Format(data)
    }

    // 对于 CRX v3，首先尝试使用 headerLength 作为 ZIP 数据偏移
    zipDataOffset = headerLength

    // 验证这个偏移是否有效
    if (zipDataOffset >= data.length) {
      return parseCrxV2Format(data)
    }

    // 检查这个位置是否真的是 ZIP 数据
    if (zipDataOffset + 4 <= data.length) {
      const zipMagic = data.toString('ascii', zipDataOffset, zipDataOffset + 4)
      if (zipMagic !== 'PK\x03\x04' && zipMagic !== 'PK\x05\x06' && zipMagic !== 'PK\x07\x08') {
        return parseCrxV2Format(data)
      }
    }
  } else {
    // CRX v2 格式
    const publicKeyLength = data.readUInt32LE(8)
    const signatureLength = data.readUInt32LE(12)

    // 验证公钥和签名长度的合理性
    if (publicKeyLength > CRX_CONSTANTS.MAX_PUBLIC_KEY_LENGTH) {
      throw new Error(
        `Invalid CRX file: public key length too large (${publicKeyLength} bytes, max ${CRX_CONSTANTS.MAX_PUBLIC_KEY_LENGTH})`
      )
    }

    if (signatureLength > CRX_CONSTANTS.MAX_SIGNATURE_LENGTH) {
      throw new Error(
        `Invalid CRX file: signature length too large (${signatureLength} bytes, max ${CRX_CONSTANTS.MAX_SIGNATURE_LENGTH})`
      )
    }

    headerSize = 16 + publicKeyLength + signatureLength
    zipDataOffset = headerSize
  }

  // 检查是否有足够的数据
  if (zipDataOffset >= data.length) {
    throw new Error(
      `Invalid CRX file: ZIP data offset (${zipDataOffset}) exceeds file size (${data.length} bytes)`
    )
  }

  // 返回 ZIP 数据
  return data.subarray(zipDataOffset)
}

// 回退到 v2 格式解析
function parseCrxV2Format(data: Buffer): Buffer {
  const publicKeyLength = data.readUInt32LE(8)
  const signatureLength = data.readUInt32LE(12)

  console.log(
    `${LOG_PREFIXES.DEBUG} CRX v2 format - publicKeyLength: ${publicKeyLength}, signatureLength: ${signatureLength}`
  )

  // 如果长度不合理，尝试搜索 ZIP 魔数
  if (
    publicKeyLength > CRX_CONSTANTS.MAX_PUBLIC_KEY_LENGTH ||
    signatureLength > CRX_CONSTANTS.MAX_SIGNATURE_LENGTH
  ) {
    console.log(`${LOG_PREFIXES.DEBUG} Invalid lengths, searching for ZIP magic...`)
    return searchForZipData(data)
  }

  const headerSize = 16 + publicKeyLength + signatureLength
  if (headerSize >= data.length) {
    console.log(`${LOG_PREFIXES.DEBUG} Header size too large, searching for ZIP magic...`)
    return searchForZipData(data)
  }

  const zipData = data.subarray(headerSize)

  // 验证是否是有效的ZIP数据
  if (zipData.length < 4) {
    throw new Error('Could not find valid ZIP data in CRX file')
  }

  const zipMagic = zipData.toString('ascii', 0, 4)
  if (zipMagic !== 'PK\x03\x04' && zipMagic !== 'PK\x05\x06' && zipMagic !== 'PK\x07\x08') {
    console.log(`${LOG_PREFIXES.DEBUG} Invalid ZIP magic at header offset, searching...`)
    return searchForZipData(data)
  }

  return zipData
}

// 搜索ZIP数据的辅助函数
function searchForZipData(data: Buffer): Buffer {
  console.log(`${LOG_PREFIXES.DEBUG} Searching for ZIP magic in ${data.length} bytes...`)

  // 输入验证
  if (!data || data.length < 4) {
    throw new Error('Invalid data buffer for ZIP search')
  }

  // 首先尝试更广泛的搜索范围
  const maxSearchOffset = Math.min(data.length - 4, CRX_CONSTANTS.MAX_SEARCH_OFFSET)
  console.log(
    `${LOG_PREFIXES.DEBUG} Searching in range ${CRX_CONSTANTS.SEARCH_START_OFFSET}-${maxSearchOffset}`
  )

  // 验证搜索范围合理性
  if (CRX_CONSTANTS.SEARCH_START_OFFSET >= maxSearchOffset) {
    throw new Error(
      `Invalid search range: start=${CRX_CONSTANTS.SEARCH_START_OFFSET}, end=${maxSearchOffset}`
    )
  }

  // 搜索所有可能的ZIP魔数
  for (let i = CRX_CONSTANTS.SEARCH_START_OFFSET; i < maxSearchOffset; i++) {
    for (const pattern of CRX_CONSTANTS.ZIP_MAGIC_PATTERNS) {
      // 边界检查
      if (i + pattern.length > data.length) {
        continue
      }

      const magic = data.toString('ascii', i, i + pattern.length)
      if (magic === pattern) {
        console.log(`${LOG_PREFIXES.DEBUG} Found ZIP magic "${pattern}" at offset: ${i}`)

        // 验证找到的ZIP数据
        const potentialZip = data.subarray(i)

        // 检查ZIP数据长度是否合理
        if (potentialZip.length < 22) {
          // ZIP文件最小长度
          console.log(
            `${LOG_PREFIXES.DEBUG} ZIP data too small (${potentialZip.length} bytes), skipping`
          )
          continue
        }

        // 验证ZIP头结构（检查中央目录记录结束标志）
        if (potentialZip.length >= 22) {
          const endOfCentralDirSignature = potentialZip.readUInt32LE(potentialZip.length - 22)
          if (endOfCentralDirSignature === 0x06054b50) {
            // 'PK\x05\x06'
            console.log(`${LOG_PREFIXES.DEBUG} Valid ZIP EOCD signature found`)
            return potentialZip
          } else {
            console.log(`${LOG_PREFIXES.DEBUG} EOCD signature not found, might be partial ZIP`)
            // 仍然返回，但记录警告
            console.warn(`${LOG_PREFIXES.DEBUG} Potential incomplete ZIP data at offset ${i}`)
            return potentialZip
          }
        }

        console.log(`${LOG_PREFIXES.DEBUG} ZIP data size: ${potentialZip.length} bytes`)
        return potentialZip
      }
    }
  }

  // 如果标准搜索失败，尝试字节级搜索
  console.log(`${LOG_PREFIXES.DEBUG} Standard search failed, trying byte-level search...`)

  // 搜索PK字节序列
  for (let i = CRX_CONSTANTS.SEARCH_START_OFFSET; i < maxSearchOffset; i++) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b) {
      // 'PK'
      // 验证有足够的数据进行检查
      if (i + 3 >= data.length) {
        continue
      }

      const thirdByte = data[i + 2]
      const fourthByte = data[i + 3]

      // 常见的ZIP第三、四字节组合
      if (
        (thirdByte === 0x03 && fourthByte === 0x04) || // PK\x03\x04 (本地文件头)
        (thirdByte === 0x05 && fourthByte === 0x06) || // PK\x05\x06 (中央目录结束)
        (thirdByte === 0x07 && fourthByte === 0x08) || // PK\x07\x08 (数据描述符)
        (thirdByte === 0x01 && fourthByte === 0x02)
      ) {
        // PK\x01\x02 (中央目录文件头)

        console.log(
          `${LOG_PREFIXES.DEBUG} Valid ZIP signature found at offset: ${i} (${thirdByte.toString(16)} ${fourthByte.toString(16)})`
        )

        const potentialZip = data.subarray(i)

        // 最终验证：确保数据长度合理
        if (potentialZip.length >= 22) {
          return potentialZip
        } else {
          console.log(`${LOG_PREFIXES.DEBUG} ZIP data too small after byte-level search, skipping`)
        }
      }
    }
  }

  // 最后的尝试：显示文件头部的十六进制数据用于调试
  console.log(
    `${LOG_PREFIXES.DEBUG} File header (first ${CRX_CONSTANTS.DEBUG_HEADER_BYTES} bytes):`
  )
  const headerBytes = data.subarray(0, Math.min(CRX_CONSTANTS.DEBUG_HEADER_BYTES, data.length))
  for (let i = 0; i < headerBytes.length; i += 16) {
    const chunk = headerBytes.subarray(i, Math.min(i + 16, headerBytes.length))
    const hex = Array.from(chunk)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
    const ascii = Array.from(chunk)
      .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
      .join('')
    console.log(`${LOG_PREFIXES.DEBUG} ${i.toString(16).padStart(4, '0')}: ${hex} ${ascii}`)
  }

  throw new Error(
    `Could not find valid ZIP data in CRX file. Searched ${maxSearchOffset - CRX_CONSTANTS.SEARCH_START_OFFSET} bytes.`
  )
}

// 检查是否是有效的 CRX 文件
function isValidCrxFile(crxPath: string): boolean {
  try {
    const data = fsReadFileSync(crxPath)

    if (data.length < 4) {
      return false
    }

    const magic = data.toString('ascii', 0, 4)
    return magic === 'Cr24'
  } catch {
    return false
  }
}

export class ExtensionManager {
  private static instance: ExtensionManager
  private extensions: Map<string, ExtensionInfo> = new Map()
  private configPath: string = ''
  private config: ExtensionConfig = { extensions: [] }
  private settings: ExtensionSettings = {
    enableExtensions: true,
    autoLoadExtensions: true,
    defaultIsolationLevel: ExtensionIsolationLevel.STANDARD,
    defaultRiskTolerance: ExtensionRiskLevel.MEDIUM
  }
  private extensionSessions: Map<
    string,
    import('../services/extensionIsolation').ExtensionSession
  > = new Map()
  private tempFiles: Set<string> = new Set() // 跟踪所有临时文件
  private extensionIdLocks: Map<string, Promise<unknown>> = new Map() // 扩展ID更新锁

  static getInstance(): ExtensionManager {
    if (!ExtensionManager.instance) {
      ExtensionManager.instance = new ExtensionManager()
    }
    return ExtensionManager.instance
  }

  initialize(userDataPath: string): void {
    this.configPath = join(userDataPath, 'extensions', STORAGE_CONSTANTS.CONFIG_FILE_NAME)
    this.loadConfig()

    // 注册 chrome-extension:// 协议处理器
    this.registerChromeExtensionProtocol()
  }

  /**
   * 注册 chrome-extension:// 协议处理器
   * 支持解析扩展资源 URL，如 chrome-extension://extensionId/options.html
   */
  private async registerChromeExtensionProtocol(): Promise<void> {
    try {
      const { protocol } = await import('electron')

      // 注册 chrome-extension:// 协议
      protocol.registerFileProtocol(
        PROTOCOL_CONSTANTS.CHROME_EXTENSION_SCHEME,
        (request, callback) => {
          const url = new URL(request.url)
          const extensionId = url.hostname

          // 查找扩展
          const extension = this.extensions.get(extensionId)

          if (!extension) {
            console.error(`Extension not found: ${extensionId}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          // 验证扩展是否已启用
          if (!extension.enabled) {
            console.error(`Extension not enabled: ${extensionId}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          // 解析文件路径
          const requestedPath = url.pathname.substring(1)

          // 路径遍历安全检查：在解析路径之前验证
          if (
            !requestedPath ||
            requestedPath.includes('..') ||
            requestedPath.includes('\\') ||
            (requestedPath.includes('/') &&
              requestedPath.split('/').some((segment) => segment === '..'))
          ) {
            console.error(`[Security] Path traversal attempt blocked: ${url.pathname}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          // 检查是否尝试使用绝对路径
          if (
            requestedPath.startsWith('/') ||
            requestedPath.startsWith('\\') ||
            /^[a-zA-Z]:/.test(requestedPath)
          ) {
            console.error(`[Security] Absolute path attempt blocked: ${url.pathname}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          const filePath = resolve(extension.path, requestedPath)

          // 确保路径在扩展目录内（安全检查）
          // 使用更严格的路径验证
          if (!this.isPathSafe(extension.path, filePath)) {
            console.error(`Invalid path traversal attempt: ${url.pathname} -> ${filePath}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          // 检查文件是否存在
          if (!existsSync(filePath)) {
            console.error(`File not found: ${filePath}`)
            callback({ error: ERROR_CODES.FILE_NOT_FOUND })
            return
          }

          // 只对扩展自己的JS文件注入polyfill，而非所有通过chrome-extension://协议提供的JS文件
          // 检查文件是否在扩展目录内
          if (filePath.toLowerCase().endsWith('.js') && this.isPathSafe(extension.path, filePath)) {
            const jsContent = readFileSync(filePath, 'utf-8')

            // 检查是否已经注入了polyfill，避免重复注入
            if (jsContent.includes(CHROME_POLYFILL_INJECTED)) {
              console.log(
                `${LOG_PREFIXES.POLYFILL} Polyfill already injected, skipping: ${filePath}`
              )
              callback(filePath)
              return
            }

            const polyfillCode = generateChromePolyfillCode()

            const modifiedJs = polyfillCode + jsContent

            // 创建临时文件并跟踪它
            const tempJsPath = this.createTempFile(modifiedJs, '.js', extension.id)

            console.log(`[Polyfill] Injected polyfill into extension JS file: ${filePath}`)
            callback(tempJsPath)
            return
          }

          // 返回文件路径
          callback(filePath)
        }
      )

      console.log('Chrome extension protocol registered successfully')
    } catch (error) {
      console.error('Failed to register chrome extension protocol:', error)
    }
  }

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8')
        const config = JSON.parse(data)

        this.config = { extensions: config.extensions || [] }
        this.settings = { ...this.settings, ...(config.settings || {}) }

        // 将配置中的扩展加载到内存
        this.config.extensions.forEach((ext) => {
          this.extensions.set(ext.id, ext)
        })
      } else {
        this.config = { extensions: [] }
        this.saveConfig()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Failed to load extension config:', errorMessage)
      this.config = { extensions: [] }
    }
  }

  private saveConfig(): void {
    try {
      const dir = join(this.configPath, '..')
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      this.config.extensions = Array.from(this.extensions.values())
      // 将 settings 和 config 一起保存
      const configWithSettings = {
        extensions: this.config.extensions,
        settings: this.settings
      }
      writeFileSync(this.configPath, JSON.stringify(configWithSettings, null, 2))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Failed to save extension config:', errorMessage)
    }
  }

  // 验证扩展 manifest
  private validateManifest(manifest: ExtensionManifest): { valid: boolean; warnings: string[] } {
    const warnings: string[] = []

    // 检查 manifest 版本
    if (!manifest.manifest_version) {
      return { valid: false, warnings: ['manifest_version is required'] }
    }

    // 检查 Manifest V2 兼容性
    if (manifest.manifest_version === 2) {
      warnings.push('Manifest V2 is deprecated, consider upgrading to V3')

      // 检查 background.scripts
      if (manifest.background?.scripts) {
        warnings.push('background.scripts is only supported in Manifest V2')
      }
    }

    // 检查不支持的权限
    const unsupportedPermissions = [
      'contextMenus',
      'webNavigation',
      'background',
      'debugger',
      'pageCapture',
      'privacy'
    ]

    if (manifest.permissions) {
      const foundUnsupported = manifest.permissions.filter((p) =>
        unsupportedPermissions.includes(p)
      )
      if (foundUnsupported.length > 0) {
        warnings.push(`Unsupported permissions: ${foundUnsupported.join(', ')}`)
      }
    }

    // 检查必需字段
    if (!manifest.name) {
      return { valid: false, warnings: ['Extension name is required'] }
    }

    if (!manifest.version) {
      return { valid: false, warnings: ['Extension version is required'] }
    }

    return { valid: true, warnings }
  }

  async validateExtension(
    extensionPath: string
  ): Promise<{ valid: boolean; manifest?: ExtensionManifest; error?: string }> {
    try {
      // 检查是否是 CRX 文件
      if (extensionPath.toLowerCase().endsWith('.crx')) {
        return await this.validateExtensionFromCrx(extensionPath)
      }

      // 检查是否是 ZIP 文件
      if (extensionPath.toLowerCase().endsWith('.zip')) {
        return await this.validateExtensionFromZip(extensionPath)
      }

      if (!existsSync(extensionPath)) {
        return { valid: false, error: 'Extension path does not exist' }
      }

      const manifestPath = join(extensionPath, 'manifest.json')
      if (!existsSync(manifestPath)) {
        return { valid: false, error: 'manifest.json not found' }
      }

      const manifestData = readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(manifestData)

      // 基本验证
      if (!manifest.name) {
        return { valid: false, error: 'Extension name is required' }
      }

      if (!manifest.version) {
        return { valid: false, error: 'Extension version is required' }
      }

      // Chrome 扩展需要 manifest_version
      if (!manifest.manifest_version) {
        return { valid: false, error: 'manifest_version is required' }
      }

      return { valid: true, manifest }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { valid: false, error: `Failed to validate extension: ${errorMessage}` }
    }
  }

  async validateExtensionFromZip(
    zipPath: string
  ): Promise<{ valid: boolean; manifest?: ExtensionManifest; error?: string }> {
    try {
      const AdmZip = await getAdmZip()
      const zip = new AdmZip(zipPath)

      // 读取 manifest.json
      const manifestEntry = zip.getEntry('manifest.json')
      if (!manifestEntry) {
        return { valid: false, error: 'manifest.json not found in ZIP file' }
      }

      const manifestData = manifestEntry.getData().toString('utf-8')
      const manifest: ExtensionManifest = JSON.parse(manifestData)

      // 验证扩展 manifest
      const manifestValidation = this.validateManifest(manifest)
      if (!manifestValidation.valid) {
        return { valid: false, error: manifestValidation.warnings.join(', ') }
      }

      // 显示兼容性警告
      if (manifestValidation.warnings.length > 0) {
        console.log(`[EXTENSION WARNING] ${manifest.name}:`)
        manifestValidation.warnings.forEach((warning) => {
          console.log(`  - ${warning}`)
        })
      }

      // 基本验证
      if (!manifest.name) {
        return { valid: false, error: 'Extension name is required' }
      }

      if (!manifest.version) {
        return { valid: false, error: 'Extension version is required' }
      }

      if (!manifest.manifest_version) {
        return { valid: false, error: 'manifest_version is required' }
      }

      return { valid: true, manifest }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { valid: false, error: `Failed to validate ZIP extension: ${errorMessage}` }
    }
  }

  async addExtension(
    extensionPath: string
  ): Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }> {
    try {
      // 检查是否是 CRX 文件
      if (extensionPath.toLowerCase().endsWith('.crx')) {
        return await this.addExtensionFromCrx(extensionPath)
      }

      // 检查是否是 ZIP 文件
      if (extensionPath.toLowerCase().endsWith('.zip')) {
        return await this.addExtensionFromZip(extensionPath)
      }

      const validation = await this.validateExtension(extensionPath)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      const manifest = validation.manifest!
      const extensionId = this.generateExtensionId(manifest.name, manifest.version)

      // 检查是否已存在
      if (this.extensions.has(extensionId)) {
        return { success: false, error: 'Extension already exists' }
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name: manifest.name,
        version: manifest.version,
        path: extensionPath,
        enabled: true,
        manifest
      }

      this.extensions.set(extensionId, extension)
      this.saveConfig()

      // 如果启用，立即加载
      if (extension.enabled) {
        await this.loadExtension(extension)
      }

      return { success: true, extension }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to add extension: ${errorMessage}` }
    }
  }

  async addExtensionFromZip(
    zipPath: string
  ): Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }> {
    try {
      const AdmZip = await getAdmZip()
      const zip = new AdmZip(zipPath)

      // 读取 manifest.json
      const manifestEntry = zip.getEntry('manifest.json')
      if (!manifestEntry) {
        return { success: false, error: 'manifest.json not found in ZIP file' }
      }

      const manifestData = manifestEntry.getData().toString('utf-8')
      const manifest: ExtensionManifest = JSON.parse(manifestData)

      // 基本验证
      if (!manifest.name) {
        return { success: false, error: 'Extension name is required' }
      }

      if (!manifest.version) {
        return { success: false, error: 'Extension version is required' }
      }

      if (!manifest.manifest_version) {
        return { success: false, error: 'manifest_version is required' }
      }

      const extensionId = this.generateExtensionId(manifest.name, manifest.version)

      // 检查是否已存在
      if (this.extensions.has(extensionId)) {
        return { success: false, error: 'Extension already exists' }
      }

      // 创建解压目录
      const extractDir = join(this.configPath, '..', 'extracted', extensionId)
      try {
        if (existsSync(extractDir)) {
          rmSync(extractDir, { recursive: true, force: true })
        }
        mkdirSync(extractDir, { recursive: true })

        // 解压 ZIP 文件
        zip.extractAllTo(extractDir, true)
      } catch (fileError) {
        console.error(`Failed to extract extension to ${extractDir}:`, fileError)
        return {
          success: false,
          error: `Failed to extract extension: ${fileError instanceof Error ? fileError.message : String(fileError)}`
        }
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name: manifest.name,
        version: manifest.version,
        path: extractDir,
        enabled: true,
        manifest
      }

      this.extensions.set(extensionId, extension)
      this.saveConfig()

      // 如果启用，立即加载
      if (extension.enabled) {
        await this.loadExtension(extension)
      }

      return { success: true, extension }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to add extension from ZIP: ${errorMessage}` }
    }
  }

  async addExtensionFromCrx(
    crxPath: string
  ): Promise<{ success: boolean; extension?: ExtensionInfo; error?: string }> {
    try {
      // 检查是否是有效的 CRX 文件
      if (!isValidCrxFile(crxPath)) {
        // 如果不是 CRX 格式，尝试作为 ZIP 文件处理
        return await this.addExtensionFromZip(crxPath)
      }

      // 解析 CRX 文件获取 ZIP 数据
      const zipData = parseCrxFile(crxPath)

      // 使用 adm-zip 处理 ZIP 数据
      const AdmZip = await getAdmZip()
      const zip = new AdmZip(zipData)

      // 读取 manifest.json
      const manifestEntry = zip.getEntry('manifest.json')
      if (!manifestEntry) {
        return { success: false, error: 'manifest.json not found in CRX file' }
      }

      const manifestData = manifestEntry.getData().toString('utf-8')
      const manifest: ExtensionManifest = JSON.parse(manifestData)

      // 基本验证
      if (!manifest.name) {
        return { success: false, error: 'Extension name is required' }
      }

      if (!manifest.version) {
        return { success: false, error: 'Extension version is required' }
      }

      if (!manifest.manifest_version) {
        return { success: false, error: 'manifest_version is required' }
      }

      const extensionId = this.generateExtensionId(manifest.name, manifest.version)

      // 检查是否已存在
      if (this.extensions.has(extensionId)) {
        return { success: false, error: 'Extension already exists' }
      }

      // 创建解压目录
      const extractDir = join(this.configPath, '..', 'extracted', extensionId)
      try {
        if (existsSync(extractDir)) {
          rmSync(extractDir, { recursive: true, force: true })
        }
        mkdirSync(extractDir, { recursive: true })

        // 解压 ZIP 数据
        zip.extractAllTo(extractDir, true)
      } catch (fileError) {
        console.error(`Failed to extract extension to ${extractDir}:`, fileError)
        return {
          success: false,
          error: `Failed to extract extension: ${fileError instanceof Error ? fileError.message : String(fileError)}`
        }
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name: manifest.name,
        version: manifest.version,
        path: extractDir,
        enabled: true,
        manifest
      }

      this.extensions.set(extensionId, extension)
      this.saveConfig()

      // 如果启用，立即加载
      if (extension.enabled) {
        await this.loadExtension(extension)
      }

      return { success: true, extension }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to add extension from CRX: ${errorMessage}` }
    }
  }

  async validateExtensionFromCrx(
    crxPath: string
  ): Promise<{ valid: boolean; manifest?: ExtensionManifest; error?: string }> {
    try {
      console.log(`[DEBUG] Validating CRX file: ${crxPath}`)

      // 检查文件是否存在
      if (!existsSync(crxPath)) {
        return { valid: false, error: `CRX file does not exist: ${crxPath}` }
      }

      // 检查文件大小
      const stats = fsReadFileSync(crxPath)
      console.log(`[DEBUG] CRX file size: ${stats.length} bytes`)

      // 检查是否是有效的 CRX 文件
      if (!isValidCrxFile(crxPath)) {
        console.log(`[DEBUG] Not a valid CRX file, trying as ZIP...`)
        // 如果不是 CRX 格式，尝试作为 ZIP 文件处理
        return await this.validateExtensionFromZip(crxPath)
      }

      console.log(`[DEBUG] Valid CRX format detected, parsing...`)

      try {
        // 解析 CRX 文件获取 ZIP 数据
        const zipData = parseCrxFile(crxPath)
        console.log(`[DEBUG] Extracted ZIP data size: ${zipData.length} bytes`)

        // 使用 adm-zip 处理 ZIP 数据
        const AdmZip = await getAdmZip()
        const zip = new AdmZip(zipData)

        // 读取 manifest.json
        const manifestEntry = zip.getEntry('manifest.json')
        if (!manifestEntry) {
          return { valid: false, error: 'manifest.json not found in CRX file' }
        }

        const manifestData = manifestEntry.getData().toString('utf-8')
        console.log(`[DEBUG] Manifest data: ${manifestData.substring(0, 200)}...`)

        const manifest: ExtensionManifest = JSON.parse(manifestData)

        // 基本验证
        if (!manifest.name) {
          return { valid: false, error: 'Extension name is required' }
        }

        if (!manifest.version) {
          return { valid: false, error: 'Extension version is required' }
        }

        if (!manifest.manifest_version) {
          return { valid: false, error: 'manifest_version is required' }
        }

        console.log(`[DEBUG] CRX validation successful for: ${manifest.name} v${manifest.version}`)
        return { valid: true, manifest }
      } catch (crxError) {
        console.error(`[DEBUG] CRX parsing failed:`, crxError)
        console.log(`[DEBUG] Trying fallback to ZIP processing...`)

        // 如果 CRX 解析失败，尝试直接作为 ZIP 处理
        // 这可能对某些损坏的 CRX 文件有效
        try {
          return await this.validateExtensionFromZip(crxPath)
        } catch (zipError) {
          console.error(`[DEBUG] ZIP fallback also failed:`, zipError)
          return {
            valid: false,
            error: `CRX parsing failed: ${(crxError as Error).message}. ZIP fallback also failed: ${(zipError as Error).message}`
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[DEBUG] CRX validation failed:`, error)
      return { valid: false, error: `Failed to validate CRX extension: ${errorMessage}` }
    }
  }

  async removeExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const extension = this.extensions.get(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      // 销毁扩展会话
      await this.destroyExtensionSession(extensionId)

      // 如果已加载，先卸载
      if (extension.enabled) {
        await this.unloadExtension(extensionId)
      }

      // 清理扩展数据
      await this.cleanupExtensionData(extension)

      this.extensions.delete(extensionId)
      this.saveConfig()

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to remove extension: ${errorMessage}` }
    }
  }

  /**
   * 清理扩展数据
   */
  private async cleanupExtensionData(_extension: ExtensionInfo): Promise<void> {
    try {
      // 清理提取的扩展文件
      // 暂时不需要额外的清理逻辑
    } catch (error) {
      console.error('Failed to clean up extension data:', error)
      // 不抛出错误，因为清理失败不应该阻止删除操作
    }
  }

  async toggleExtension(extensionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const extension = this.extensions.get(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      extension.enabled = !extension.enabled
      this.saveConfig()

      if (extension.enabled) {
        await this.loadExtension(extension)
      } else {
        await this.unloadExtension(extensionId)
      }

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to toggle extension: ${errorMessage}` }
    }
  }

  getAllExtensions(): ExtensionInfo[] {
    return Array.from(this.extensions.values())
  }

  getExtension(extensionId: string): ExtensionInfo | undefined {
    return this.extensions.get(extensionId)
  }

  async loadAllExtensions(): Promise<void> {
    // 检查是否启用扩展功能
    if (!this.settings.enableExtensions) {
      console.log('Extensions are disabled in settings')
      return
    }

    // 检查是否自动加载扩展
    if (!this.settings.autoLoadExtensions) {
      console.log('Auto-load extensions is disabled in settings')
      return
    }

    const extensions = this.getAllExtensions()
    for (const extension of extensions) {
      if (extension.enabled) {
        try {
          await this.loadExtension(extension)
        } catch (error) {
          console.error(`Failed to load extension ${extension.name}:`, error)
        }
      }
    }
  }

  getSettings(): ExtensionSettings {
    return { ...this.settings }
  }

  updateSettings(newSettings: Partial<ExtensionSettings>): void {
    this.settings = { ...this.settings, ...newSettings }
    this.saveConfig()
    console.log('Extension settings updated:', this.settings)
  }

  private async loadExtension(extension: ExtensionInfo): Promise<void> {
    try {
      // 验证扩展权限
      const riskLevel = this.settings.defaultRiskTolerance
      const permissionValidation = await extensionPermissionManager.validateExtensionPermissions(
        extension,
        riskLevel
      )

      if (!permissionValidation.valid) {
        throw new Error(
          `Permission validation failed: ${permissionValidation.blockedPermissions.map((p) => p.permission).join(', ')}`
        )
      }

      // 使用扩展专用 session 加载扩展（用于webview）
      console.log('[DEBUG] Loading extension from path:', extension.path)

      const extensionSession = await this.getExtensionSession()

      // 在扩展session中加载扩展
      if (extensionSession.extensions && extensionSession.extensions.loadExtension) {
        console.log(
          `[DEBUG] Attempting to load extension with new API from path: ${extension.path}`
        )
        const loadedExtension = await extensionSession.extensions.loadExtension(extension.path)

        console.log(`[DEBUG] loadedExtension result:`, loadedExtension)

        // 更新扩展ID和realId
        if (loadedExtension) {
          console.log(`Loaded extension with ID: ${loadedExtension.id}`)

          // 使用安全的ID更新方法
          await this.updateExtensionIdSafely(extension, loadedExtension.id, loadedExtension.id)
        } else {
          console.log(
            `${LOG_PREFIXES.DEBUG} loadedExtension is undefined/null, extension loading may have failed`
          )
        }
      } else {
        console.log(
          `${LOG_PREFIXES.DEBUG} session.extensions.loadExtension not available, using legacy API`
        )
        // 回退到旧的 API
        await extensionSession.loadExtension(extension.path)
      }
    } catch (error) {
      console.error(`Failed to load extension ${extension.name}:`, error)

      // 使用错误管理器处理错误
      await extensionErrorManager.handleLoadError(extension, error as Error)

      throw error
    }
  }

  private async unloadExtension(extensionId: string): Promise<void> {
    try {
      // 注意：Electron 的 Extensions API 可能没有 unloadExtension 方法
      // 扩展一旦加载就很难完全卸载，这里只是记录操作
      console.log(`[DEBUG] Attempting to unload extension ${extensionId} from extension session`)

      // 检查是否有 unloadExtension 方法
      const extensionSession = await this.getExtensionSession()
      const extensionsAPI = extensionSession.extensions as
        | { unloadExtension?: (id: string) => Promise<void> }
        | undefined

      if (extensionsAPI?.unloadExtension) {
        await extensionsAPI.unloadExtension(extensionId)
        console.log(`[DEBUG] Extension ${extensionId} unloaded from extension session`)
      } else {
        console.warn(
          `[DEBUG] unloadExtension method not available, extension ${extensionId} may remain loaded`
        )
      }
    } catch (error) {
      console.error(`Failed to unload extension ${extensionId}:`, error)
      // 不抛出错误，因为卸载失败不应该阻止其他操作
    }
  }

  private async destroyExtensionSession(extensionId: string): Promise<void> {
    try {
      // 从隔离管理器销毁会话
      await extensionIsolationManager.destroyExtensionSession(extensionId)

      // 从本地会话映射中移除
      this.extensionSessions.delete(extensionId)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('Failed to destroy extension session:', errorMessage)
    }
  }

  private generateExtensionId(name: string, version: string): string {
    // 生成URL安全的ID：移除非字母数字字符，用单横线替换，移除首尾横线
    const cleanName = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/^-+|-+$/g, '') // 移除首尾横线
      .replace(/-+/g, '-') // 将多个横线替换为单个
    const cleanVersion = version
      .replace(/[^a-z0-9.-]/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
    return `${cleanName}-${cleanVersion}`
  }

  getLoadedExtensions(): string[] {
    // 返回已加载的扩展 ID 列表
    const extensions = this.getAllExtensions()
    return extensions.filter((ext) => ext.enabled).map((ext) => ext.id)
  }

  // 新增方法：使用隔离加载扩展
  async loadExtensionWithIsolation(
    extensionPath: string,
    isolationLevel?: ExtensionIsolationLevel
  ): Promise<{
    success: boolean
    extension?: { id: string; name: string; version: string; enabled: boolean }
    sessionId?: string
    error?: string
  }> {
    try {
      console.log('[DEBUG] loadExtensionWithIsolation called with path:', extensionPath)
      console.log(
        '[DEBUG] File extension:',
        extensionPath.toLowerCase().endsWith('.zip')
          ? 'ZIP'
          : extensionPath.toLowerCase().endsWith('.crx')
            ? 'CRX'
            : 'Directory'
      )

      // 验证扩展
      const validation = await this.validateExtension(extensionPath)
      console.log('[DEBUG] Validation result:', validation)

      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      const manifest = validation.manifest!
      const extensionId = this.generateExtensionId(manifest.name, manifest.version)

      // 检查是否已存在
      if (this.extensions.has(extensionId)) {
        return { success: false, error: 'Extension already exists' }
      }

      // 处理 ZIP 和 CRX 文件 - 需要先解压
      let actualPath = extensionPath
      if (
        extensionPath.toLowerCase().endsWith('.zip') ||
        extensionPath.toLowerCase().endsWith('.crx')
      ) {
        console.log(
          `[DEBUG] ${extensionPath.toLowerCase().endsWith('.zip') ? 'ZIP' : 'CRX'} file detected, extracting...`
        )

        let zipData: Buffer

        if (extensionPath.toLowerCase().endsWith('.crx')) {
          // 处理 CRX 文件 - 先解析获取 ZIP 数据
          zipData = parseCrxFile(extensionPath)
          console.log('[DEBUG] CRX parsed, ZIP data extracted')
        } else {
          // 处理 ZIP 文件 - 直接读取
          zipData = fsReadFileSync(extensionPath)
        }

        const AdmZip = await getAdmZip()
        const zip = new AdmZip(zipData)

        // 创建解压目录
        const extractDir = join(this.configPath, '..', 'extracted', extensionId)
        console.log('[DEBUG] Extracting to:', extractDir)

        try {
          if (existsSync(extractDir)) {
            rmSync(extractDir, { recursive: true, force: true })
          }
          mkdirSync(extractDir, { recursive: true })

          // 解压 ZIP 文件
          zip.extractAllTo(extractDir, true)
        } catch (fileError) {
          console.error(`Failed to extract extension to ${extractDir}:`, fileError)
          return {
            success: false,
            error: `Failed to extract extension: ${fileError instanceof Error ? fileError.message : String(fileError)}`
          }
        }
        actualPath = extractDir
        console.log('[DEBUG] Extraction complete, actual path:', actualPath)
      }

      const extension: ExtensionInfo = {
        id: extensionId,
        name: manifest.name,
        version: manifest.version,
        path: actualPath,
        enabled: true,
        manifest
      }

      // 创建扩展会话（仅用于权限管理）
      const level = isolationLevel || undefined
      const isolationSession = await extensionIsolationManager.createExtensionSession(
        extension,
        level
      )

      // 验证权限
      const riskLevel = this.settings.defaultRiskTolerance
      const permissionValidation = await extensionPermissionManager.validateExtensionPermissions(
        extension,
        riskLevel
      )

      if (!permissionValidation.valid) {
        // 销毁会话
        await extensionIsolationManager.destroyExtensionSession(extensionId)
        throw new Error(
          `Permission validation failed: ${permissionValidation.blockedPermissions.map((p) => p.permission).join(', ')}`
        )
      }

      // 注册扩展
      this.extensions.set(extensionId, extension)
      this.saveConfig()

      // 使用扩展专用 session 加载扩展（用于webview）
      console.log('[DEBUG] Loading extension from path:', actualPath)

      const extensionSession = await this.getExtensionSession()

      // 在扩展session中加载扩展
      try {
        if (extensionSession.extensions && extensionSession.extensions.loadExtension) {
          const loadedExtension = await extensionSession.extensions.loadExtension(actualPath)
          console.log(`[DEBUG] Extension ${extension.name} loaded in extension session`)

          // 设置真实ID
          if (loadedExtension) {
            console.log(`[DEBUG] Loaded extension with real ID: ${loadedExtension.id}`)
            // 使用安全的ID更新方法
            await this.updateExtensionIdSafely(extension, loadedExtension.id, loadedExtension.id)
          }
        } else {
          await extensionSession.loadExtension(actualPath)
          console.log(
            `[DEBUG] Extension ${extension.name} loaded in extension session (legacy API)`
          )
        }
      } catch (extensionSessionError) {
        console.error(
          `[DEBUG] Failed to load extension ${extension.name} in extension session:`,
          extensionSessionError
        )
        throw extensionSessionError
      }
      console.log('[DEBUG] Extension loaded successfully')

      return {
        success: true,
        extension: {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: true
        },
        sessionId: isolationSession.id
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to load extension with isolation: ${errorMessage}` }
    }
  }

  // 新增方法：使用隔离卸载扩展
  async unloadExtensionWithIsolation(
    extensionId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const extension = this.extensions.get(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      // 销毁扩展会话
      await this.destroyExtensionSession(extensionId)

      // 注销扩展
      this.extensions.delete(extensionId)
      this.saveConfig()

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to unload extension with isolation: ${errorMessage}` }
    }
  }

  // 新增方法：获取扩展及其权限信息
  async getExtensionWithPermissions(extensionId: string): Promise<{
    success: boolean
    extension?: {
      id: string
      name: string
      version: string
      enabled: boolean
      manifest?: ExtensionManifest
    }
    session?: {
      id: string
      isolationLevel: ExtensionIsolationLevel
      isActive: boolean
      memoryUsage: number
    } | null
    permissions?: { settings: string[]; riskLevel: ExtensionRiskLevel }
    error?: string
  }> {
    try {
      const extension = this.getExtension(extensionId)
      if (!extension) {
        return { success: false, error: 'Extension not found' }
      }

      const isolationSession = extensionIsolationManager.getExtensionSession(extensionId)
      const permissionSettings = extensionPermissionManager.getUserPermissionSettings(extensionId)

      return {
        success: true,
        extension: {
          id: extension.id,
          name: extension.name,
          version: extension.version,
          enabled: extension.enabled,
          manifest: extension.manifest
        },
        session: isolationSession
          ? {
              id: isolationSession.id,
              isolationLevel: isolationSession.isolationLevel,
              isActive: isolationSession.isActive,
              memoryUsage: isolationSession.memoryUsage
            }
          : null,
        permissions: {
          settings: Array.from(permissionSettings),
          riskLevel:
            extensionPermissionManager.getUserPermissionSettings().size > 0
              ? ExtensionRiskLevel.MEDIUM
              : ExtensionRiskLevel.LOW
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to get extension with permissions: ${errorMessage}` }
    }
  }

  /**
   * 获取扩展专用session（用于webview）
   */
  private async getExtensionSession(): Promise<Session> {
    const { session } = await import('electron')
    const extensionSession = session.fromPartition(PROTOCOL_CONSTANTS.EXTENSION_PARTITION)
    return extensionSession
  }

  // 新增方法：更新权限设置
  async updatePermissionSettings(
    extensionId: string,
    permissions: string[],
    allowed: boolean
  ): Promise<{ success: boolean; error?: string }> {
    try {
      extensionPermissionManager.updateUserPermissionSettings(extensionId, permissions, allowed)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to update permission settings: ${errorMessage}` }
    }
  }

  /**
   * 注册扩展到管理器
   */
  registerExtension(extension: ExtensionInfo): void {
    this.extensions.set(extension.id, extension)
    this.saveConfig()
  }

  /**
   * 从管理器中注销扩展
   */
  unregisterExtension(extensionId: string): void {
    this.extensions.delete(extensionId)
    this.saveConfig()
  }

  /**
   * 保存扩展配置
   */
  saveExtensionConfig(): void {
    this.saveConfig()
  }

  // 新增方法：获取错误统计
  async getErrorStats(): Promise<{
    success: boolean
    stats?: {
      totalErrors: number
      errorsByType: Record<string, number>
      recentErrors: Array<{ type: string; message: string; timestamp: number }>
    }
    error?: string
  }> {
    try {
      const stats = extensionErrorManager.getErrorStats()
      return { success: true, stats }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to get error stats: ${errorMessage}` }
    }
  }

  // 新增方法：获取权限统计
  async getPermissionStats(): Promise<{
    success: boolean
    stats?: {
      totalExtensions: number
      totalPermissions: number
      permissionsByCategory: Record<string, number>
      permissionsByRisk: Record<string, number>
      userSettingsCount: number
    }
    error?: string
  }> {
    try {
      const rawStats = extensionPermissionManager.getPermissionStats()
      const stats = {
        totalExtensions: this.extensions.size,
        totalPermissions: rawStats.totalPermissions,
        permissionsByCategory: rawStats.permissionsByCategory,
        permissionsByRisk: rawStats.permissionsByRisk,
        userSettingsCount: rawStats.userSettings.size
      }
      return { success: true, stats }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to get permission stats: ${errorMessage}` }
    }
  }

  // 新增方法：清除错误历史
  async clearErrorHistory(): Promise<{ success: boolean; error?: string }> {
    try {
      extensionErrorManager.clearErrorHistory()
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: `Failed to clear error history: ${errorMessage}` }
    }
  }

  /**
   * 安全地更新扩展ID（防止竞态条件）
   */
  private async updateExtensionIdSafely(
    extension: ExtensionInfo,
    newId: string,
    realId: string
  ): Promise<void> {
    const oldId = extension.id
    const lockTimeout = 30000 // 30秒超时

    // 如果没有变化，直接返回
    if (oldId === newId) {
      extension.realId = realId
      this.saveConfig()
      return
    }

    // 创建更新操作的promise
    const performUpdate = async (): Promise<void> => {
      try {
        console.log(`[ID Update] Starting atomic ID update from ${oldId} to ${newId}`)

        // 原子性地更新所有相关的映射
        const extensionCopy = { ...extension }
        extensionCopy.id = newId
        extensionCopy.realId = realId

        // 更新extensions map
        this.extensions.delete(oldId)
        this.extensions.set(newId, extensionCopy)

        // 更新extensionSessions map
        if (this.extensionSessions.has(oldId)) {
          const session = this.extensionSessions.get(oldId)!
          this.extensionSessions.delete(oldId)
          this.extensionSessions.set(newId, session)
        }

        // 更新配置
        this.saveConfig()

        console.log(`[ID Update] Successfully updated extension ID from ${oldId} to ${newId}`)
      } catch (error) {
        console.error(`[ID Update] Failed to update extension ID from ${oldId} to ${newId}:`, error)
        throw error
      }
    }

    // 使用带有超时的互斥锁
    const acquireLock = async (): Promise<void> => {
      const startTime = Date.now()

      while (Date.now() - startTime < lockTimeout) {
        const existingLock = this.extensionIdLocks.get(oldId)

        if (!existingLock) {
          // 尝试获取锁
          const lockPromise = performUpdate().finally(() => {
            // 总是清理锁
            this.extensionIdLocks.delete(oldId)
            console.log(`[ID Update] Lock released for extension ID update: ${oldId}`)
          })

          // 原子性地设置锁
          if (!this.extensionIdLocks.has(oldId)) {
            this.extensionIdLocks.set(oldId, lockPromise)
            await lockPromise
            return
          }
          // 如果设置锁失败，继续循环
        } else {
          // 等待现有锁完成，但有超时保护
          try {
            await Promise.race([
              existingLock,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Lock timeout')), 5000))
            ])
          } catch (error) {
            console.warn(`[ID Update] Lock wait failed for ${oldId}, retrying:`, error)
            // 继续循环，锁可能已被释放
          }
        }

        // 短暂延迟避免忙等待
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      throw new Error(
        `Failed to acquire lock for extension ID update after ${lockTimeout}ms timeout`
      )
    }

    await acquireLock()
  }

  /**
   * 检查路径是否安全（防止路径遍历攻击）
   */
  private isPathSafe(basePath: string, targetPath: string): boolean {
    try {
      // 输入验证
      if (!basePath || !targetPath) {
        console.error('[Security] Invalid input paths for safety check')
        return false
      }

      // 规范化基础路径和目标路径
      const normalizedBase = resolve(basePath)
      const normalizedTarget = resolve(targetPath)

      // 解析符号链接并获取绝对路径
      const resolvedBasePath = realpathSync(normalizedBase)
      const resolvedTargetPath = realpathSync(normalizedTarget)

      // 确保基础路径以路径分隔符结尾，以便正确检查子路径
      const normalizedBasePath = resolvedBasePath.endsWith(sep)
        ? resolvedBasePath
        : resolvedBasePath + sep

      // 基本检查：目标路径必须在基础路径内
      if (!resolvedTargetPath.startsWith(normalizedBasePath)) {
        console.error(
          `[Security] Path traversal detected: ${resolvedTargetPath} is outside ${resolvedBasePath}`
        )
        return false
      }

      // 计算相对路径并验证没有向上遍历
      const relativePath = relative(resolvedBasePath, resolvedTargetPath)

      // 检查相对路径是否包含向上遍历模式
      if (
        relativePath.startsWith('..') ||
        relativePath.includes('..' + sep) ||
        relativePath.includes(sep + '..') ||
        relativePath === '..'
      ) {
        console.error(`[Security] Relative path traversal detected: ${relativePath}`)
        return false
      }

      // 验证原始输入路径不包含危险模式
      const originalRelative = relative(normalizedBase, normalizedTarget)
      if (originalRelative.includes('..')) {
        console.error(`[Security] Original path contains traversal: ${originalRelative}`)
        return false
      }

      // 确保路径长度合理，防止DOS攻击
      if (resolvedTargetPath.length > 4096) {
        console.error(`[Security] Path too long: ${resolvedTargetPath.length} characters`)
        return false
      }

      // 验证解析后的路径没有发生意外变化
      // （realpathSync应该已经解析了符号链接，这里是额外验证）
      const doubleResolved = realpathSync(resolvedTargetPath)
      if (doubleResolved !== resolvedTargetPath) {
        console.error(`[Security] Path resolution inconsistency detected`)
        return false
      }

      return true
    } catch (error) {
      console.error('[Security] Error checking path safety:', error)
      // 出错时拒绝访问，确保安全
      return false
    }
  }

  /**
   * 创建临时文件并跟踪它（按扩展ID）
   */
  private createTempFile(
    content: string,
    suffix: string = STORAGE_CONSTANTS.TEMP_FILE_SUFFIX,
    _extensionId?: string
  ): string {
    const tempPath = `${os.tmpdir()}/${STORAGE_CONSTANTS.TEMP_FILE_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2)}${suffix}`
    try {
      writeFileSync(tempPath, content, 'utf-8')

      // 跟踪临时文件
      this.tempFiles.add(tempPath)

      return tempPath
    } catch (error) {
      console.error(`Failed to create temp file: ${tempPath}`, error)
      throw new Error(
        `Failed to create temp file: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
