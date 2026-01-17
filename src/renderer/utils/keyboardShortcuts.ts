/**
 * 键盘快捷键工具函数
 */

export interface KeyboardShortcutConfig {
  ctrl?: boolean
  alt?: boolean
  shift?: boolean
  meta?: boolean
  key: string
}

/**
 * 检查键盘事件是否匹配快捷键配置
 */
export function matchesShortcut(event: KeyboardEvent, config: KeyboardShortcutConfig): boolean {
  return (
    !!event.ctrlKey === !!config.ctrl &&
    !!event.altKey === !!config.alt &&
    !!event.shiftKey === !!config.shift &&
    !!event.metaKey === !!config.meta &&
    event.key.toLowerCase() === config.key.toLowerCase()
  )
}

/**
 * 预定义的快捷键配置
 */
export const SHORTCUTS = {
  REFRESH_PAGE: {
    alt: true,
    key: 'r'
  } as KeyboardShortcutConfig,

  COPY_URL: {
    ctrl: true,
    shift: true,
    key: 'l'
  } as KeyboardShortcutConfig,

  TOGGLE_SIDEBAR: {
    ctrl: true,
    key: 'b'
  } as KeyboardShortcutConfig,

  OPEN_SETTINGS: {
    ctrl: true,
    key: 's'
  } as KeyboardShortcutConfig
} as const

/**
 * 快捷键类型
 */
export type ShortcutType = keyof typeof SHORTCUTS

/**
 * 检查事件是否匹配预定义的快捷键
 */
export function matchesPredefinedShortcut(event: KeyboardEvent, type: ShortcutType): boolean {
  return matchesShortcut(event, SHORTCUTS[type])
}
