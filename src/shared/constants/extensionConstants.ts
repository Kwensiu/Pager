/**
 * 扩展相关常量 - 渲染进程和主进程共享
 */

// 协议相关常量
export const PROTOCOL_CONSTANTS = {
  CHROME_EXTENSION_PROTOCOL: 'chrome-extension://',
  CHROME_EXTENSION_SCHEME: 'chrome-extension',
  EXTENSION_PARTITION: 'persist:extensions'
} as const

// CRX文件解析常量
export const CRX_CONSTANTS = {
  // 长度限制
  MAX_PUBLIC_KEY_LENGTH: 10000,
  MAX_SIGNATURE_LENGTH: 1000000,
  MAX_SEARCH_OFFSET: 100000, // 100KB

  // ZIP魔数
  ZIP_MAGIC_PATTERNS: [
    'PK\x03\x04', // 本地文件头
    'PK\x05\x06', // 中央目录记录
    'PK\x07\x08', // 空压缩文件
    'PK\x01\x02' // 中央目录文件头
  ] as const,

  // 搜索起始位置
  SEARCH_START_OFFSET: 16,

  // 调试显示字节数
  DEBUG_HEADER_BYTES: 64
} as const

// 错误代码常量
export const ERROR_CODES = {
  FILE_NOT_FOUND: -6
} as const

// 存储相关常量
export const STORAGE_CONSTANTS = {
  CONFIG_FILE_NAME: 'extensions.json',
  TEMP_FILE_PREFIX: 'extension-js-',
  TEMP_FILE_SUFFIX: '.js'
} as const

// 日志前缀常量
export const LOG_PREFIXES = {
  POLYFILL: '[Polyfill]',
  DEBUG: '[DEBUG]',
  SECURITY: '[Security]',
  CLEANUP: '[Cleanup]',
  ID_UPDATE: '[ID Update]'
} as const
