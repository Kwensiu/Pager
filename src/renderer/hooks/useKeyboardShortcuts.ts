import React, { useEffect, useCallback, useRef } from 'react'

export interface ShortcutAction {
  id: string
  cmd: string
  isOpen: boolean
}

interface UseKeyboardShortcutsProps {
  shortcuts: ShortcutAction[]
  onShortcut: (shortcutId: string) => void
  enabled?: boolean
}

export const useKeyboardShortcuts = ({
  shortcuts,
  onShortcut,
  enabled = true
}: UseKeyboardShortcutsProps): void => {
  // 使用 ref 来跟踪正在执行的快捷键，避免竞态条件
  const executingShortcutsRef = useRef<Set<string>>(new Set())

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // 检查是否是快捷键组合，且不是修饰键本身
    if (
      (event.ctrlKey || event.altKey) &&
      event.key &&
      !event.metaKey &&
      event.key !== 'Control' &&
      event.key !== 'Shift' &&
      event.key !== 'Alt' &&
      event.key !== 'Meta'
    ) {
      let shortcut = ''

      // 构建快捷键字符串
      if (event.ctrlKey) {
        shortcut += 'Ctrl+'
      }
      if (event.altKey) {
        shortcut += 'Alt+'
      }
      if (event.shiftKey) {
        shortcut += 'Shift+'
      }
      shortcut += event.key.toUpperCase()

      // 查找对应的快捷键
      const registeredShortcut = shortcuts.find((s) => s.cmd === shortcut && s.isOpen)

      if (registeredShortcut) {
        // 检查是否正在执行中（防重复触发）
        if (executingShortcutsRef.current.has(registeredShortcut.id)) {
          return
        }

        event.preventDefault()

        // 标记为正在执行
        executingShortcutsRef.current.add(registeredShortcut.id)

        // 执行快捷键回调
        onShortcut(registeredShortcut.id)

        // 延迟清除执行标志
        setTimeout(() => {
          executingShortcutsRef.current.delete(registeredShortcut.id)
        }, 100)
      }
    }
  }, [shortcuts, onShortcut, enabled])

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyDown)
    }
  }, [handleKeyDown, enabled])
}

// 防重复触发钩子
export const useShortcutDebounce = (callback: () => void, delay: number = 100): (() => void) => {
  const [isExecuting, setIsExecuting] = React.useState(false)

  const debouncedCallback = useCallback(() => {
    if (isExecuting) return

    setIsExecuting(true)
    callback()

    setTimeout(() => {
      setIsExecuting(false)
    }, delay)
  }, [callback, delay, isExecuting])

  return debouncedCallback
}
