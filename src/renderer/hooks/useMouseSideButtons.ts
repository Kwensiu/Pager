import { useEffect, useRef } from 'react'

interface UseMouseSideButtonsOptions {
  /** 是否启用鼠标侧键功能 */
  enabled?: boolean
  /** 忽略鼠标事件的元素选择器 */
  ignoreSelectors?: string[]
  /** 后退回调 */
  onBack?: () => void
  /** 前进回调 */
  onForward?: () => void
  /** 是否阻止默认行为 */
  preventDefault?: boolean
}

/**
 * 鼠标侧键集成钩子
 *
 * 这个钩子监听鼠标侧键事件（通常是后退 button 3 和前进 button 4）
 * 并提供相应的回调函数。
 *
 * @param options 配置选项
 * @returns 清理函数（如果需要手动清理）
 */
export function useMouseSideButtons({
  enabled = true,
  ignoreSelectors = ['input', 'textarea', '[contenteditable="true"]'],
  onBack,
  onForward,
  preventDefault = true
}: UseMouseSideButtonsOptions = {}): () => void {
  const handlersRef = useRef({ onBack, onForward })

  // 更新处理器引用
  useEffect(() => {
    handlersRef.current = { onBack, onForward }
  }, [onBack, onForward])

  useEffect(() => {
    if (!enabled) return

    const handleMouseDown = (e: MouseEvent): void => {
      // 检查是否应该忽略此事件
      const target = e.target as HTMLElement

      // 检查目标元素是否在忽略列表中
      const shouldIgnore = ignoreSelectors.some((selector) => {
        if (selector.startsWith('[') && selector.endsWith(']')) {
          // 属性选择器
          const attr = selector.slice(1, -1)
          return target.hasAttribute(attr)
        }
        return target.matches(selector)
      })

      if (shouldIgnore) {
        return
      }

      // 鼠标侧键检测
      // button 3: 后退（通常）
      // button 4: 前进（通常）
      // 注意：不同浏览器/系统可能不同
      if (e.button === 3) {
        // 后退按钮
        if (preventDefault) {
          e.preventDefault()
        }
        handlersRef.current.onBack?.()
      } else if (e.button === 4) {
        // 前进按钮
        if (preventDefault) {
          e.preventDefault()
        }
        handlersRef.current.onForward?.()
      }
    }

    // 添加事件监听器
    document.addEventListener('mousedown', handleMouseDown)

    // 清理函数
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [enabled, ignoreSelectors, preventDefault])

  // 返回清理函数（如果需要）
  return () => {
    // 这里可以添加手动清理逻辑
  }
}

/**
 * 检测鼠标侧键是否可用
 *
 * @returns 返回一个对象，包含检测到的鼠标侧键信息
 */
export function detectMouseSideButtons(): {
  hasBackButton: boolean
  hasForwardButton: boolean
  backButtonCode: number | null
  forwardButtonCode: number | null
} {
  // 默认假设 button 3 是后退，button 4 是前进
  // 这是大多数浏览器的标准
  return {
    hasBackButton: true,
    hasForwardButton: true,
    backButtonCode: 3,
    forwardButtonCode: 4
  }
}

/**
 * 鼠标侧键配置
 */
export const mouseSideButtonConfig = {
  // 标准鼠标侧键映射
  STANDARD: {
    BACK: 3,
    FORWARD: 4
  },
  // 备用映射（某些系统可能不同）
  ALTERNATIVE: {
    BACK: 4,
    FORWARD: 5
  },
  // 检测当前配置
  detect(): { BACK: number; FORWARD: number } {
    // 这里可以添加更复杂的检测逻辑
    return this.STANDARD
  }
}
