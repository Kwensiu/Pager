import { useState, useEffect } from 'react'
import { storageService } from '@/core/storage'

export interface UseStorageOptions<T> {
  key: string
  defaultValue: T
  storageType?: 'localStorage' | 'electron'
}

export function useStorage<T>({
  key,
  defaultValue,
  storageType = 'localStorage'
}: UseStorageOptions<T>): [T, (newValue: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    // 初始化时从存储读取
    if (storageType === 'electron') {
      // Electron环境下使用storageService
      return defaultValue // 实际应该从storageService读取，这里简化
    } else {
      // localStorage环境
      try {
        const saved = localStorage.getItem(key)
        return saved ? JSON.parse(saved) : defaultValue
      } catch {
        return defaultValue
      }
    }
  })

  // 监听localStorage变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue)
          setValue(newValue)
        } catch (error) {
          console.error(`Failed to parse ${key} from storage event:`, error)
        }
      }
    }

    // 监听storage事件（其他标签页的变化）
    window.addEventListener('storage', handleStorageChange)

    return (): void => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  // 监听自定义localStorage变化事件
  useEffect(() => {
    const handleLocalStorageChange = (e: CustomEvent): void => {
      if (e.detail?.key === key) {
        try {
          // 使用requestAnimationFrame确保在下一个渲染帧更新状态
          requestAnimationFrame(() => {
            setValue(e.detail.value)
          })
        } catch (error) {
          console.error(`Failed to parse ${key} from custom storage event:`, error)
        }
      }
    }

    window.addEventListener('localStorageChange', handleLocalStorageChange as EventListener)

    return (): void =>
      window.removeEventListener('localStorageChange', handleLocalStorageChange as EventListener)
  }, [key])

  // 更新存储的函数
  const updateValue = (newValue: T | ((prev: T) => T)): void => {
    setValue((prev) => {
      const finalValue =
        typeof newValue === 'function' ? (newValue as (prev: T) => T)(prev) : newValue

      // 保存到存储
      if (storageType === 'electron') {
        // 使用storageService保存 - 需要根据数据类型调用不同的方法
        if (key === 'primary-groups') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(storageService as any).setPrimaryGroups(finalValue)
        }
        // 可以在这里添加其他存储类型的处理
      } else {
        // 保存到localStorage
        try {
          localStorage.setItem(key, JSON.stringify(finalValue))
          // 触发自定义事件通知其他组件
          window.dispatchEvent(
            new CustomEvent('localStorageChange', {
              detail: { key, value: finalValue }
            })
          )
        } catch (error) {
          console.error(`Failed to save ${key} to localStorage:`, error)
        }
      }

      return finalValue
    })
  }

  // 监听其他标签页的变化
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === key && e.newValue) {
        try {
          const newValue = JSON.parse(e.newValue)
          setValue(newValue)
        } catch (error) {
          console.error(`Failed to parse ${key} from storage event:`, error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return (): void => window.removeEventListener('storage', handleStorageChange)
  }, [key])

  return [value, updateValue]
}
