// 从共享类型导入,保持向后兼容
import type {
  ExtensionInfo,
  ExtensionManifest,
  ContentScript,
  BackgroundConfig,
  ExtensionConfig,
  ExtensionSettings,
  ExtensionIsolationLevel,
  ExtensionRiskLevel,
  ExtensionPermissionCategory
} from '../../shared/types/store'

// 重新导出共享类型
export type {
  ExtensionInfo,
  ExtensionManifest,
  ContentScript,
  BackgroundConfig,
  ExtensionConfig,
  ExtensionSettings,
  ExtensionIsolationLevel,
  ExtensionRiskLevel,
  ExtensionPermissionCategory
}

/**
 * 扩展加载结果
 */
export interface ExtensionLoadResult {
  id: string
  name: string
  version: string
  path: string
  enabled: boolean
  manifest: ExtensionManifest
}
