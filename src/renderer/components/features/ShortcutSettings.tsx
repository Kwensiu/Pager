import { useState, useEffect, useCallback } from 'react'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { Badge } from '../../ui/badge'
import { ScrollArea } from '../../ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip'
import { toast } from 'sonner'
import type { Shortcut } from '../../../shared/types/store'
import { Keyboard, RotateCcw, Plus, HelpCircle, Undo } from 'lucide-react'

export function ShortcutSettings(): React.ReactElement {
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [capturedKeys, setCapturedKeys] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshTime, setLastRefreshTime] = useState(0)

  // 启动所有默认快捷键
  const enableAllShortcuts = async (): Promise<void> => {
    // 添加确认对话框
    const confirmed = await confirm('确定要启动所有快捷键吗？这将启用所有默认快捷键配置。')
    if (!confirmed) return

    setIsLoading(true)
    try {
      const result = await window.api.enhanced.shortcut.enableAll()
      if (result.success) {
        toast.success(result.message || '快捷键启用成功')
        await loadShortcuts()
      } else {
        toast.error(result.message || '快捷键启用失败')
      }
    } catch (error) {
      console.error('启用快捷键失败:', error)
      toast.error(error instanceof Error ? `启用快捷键失败: ${error.message}` : '启用快捷键失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 恢复默认快捷键配置
  const resetToDefaults = async (): Promise<void> => {
    // 添加确认对话框
    const confirmed = await confirm('确定要恢复默认快捷键配置吗？这将覆盖所有当前的自定义设置。')
    if (!confirmed) return

    setIsLoading(true)
    try {
      // 获取默认快捷键配置
      const defaults = await window.api.enhanced.shortcut.getDefaults()
      
      // 批量保存默认配置
      let successCount = 0
      const errors: Array<{ id: string; error: string }> = []

      for (const shortcut of defaults) {
        try {
          const result = await window.api.enhanced.shortcut.update(shortcut)
          if (result.success) {
            successCount++
          } else {
            errors.push({
              id: shortcut.id,
              error: result.message || '保存失败'
            })
          }
        } catch (error) {
          errors.push({
            id: shortcut.id,
            error: error instanceof Error ? error.message : '未知错误'
          })
        }
      }

      if (errors.length > 0) {
        toast.error(`部分快捷键恢复失败：${errors.length}/${defaults.length} 个失败`)
      } else {
        toast.success(`成功恢复 ${successCount} 个默认快捷键配置`)
      }

      // 重新加载列表
      await loadShortcuts()
    } catch (error) {
      console.error('恢复默认配置失败:', error)
      toast.error(error instanceof Error ? `恢复默认配置失败: ${error.message}` : '恢复默认配置失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 禁用所有快捷键
  const disableAllShortcuts = async (): Promise<void> => {
    // 添加确认对话框
    const confirmed = await confirm('确定要禁用所有快捷键吗？此操作不可撤销。')
    if (!confirmed) return

    setIsLoading(true)
    try {
      const result = await window.api.enhanced.shortcut.disableAll()
      if (result.success) {
        toast.success(result.message || '快捷键禁用成功')
        // 正确更新UI状态：重新加载数据而不是清空列表
        await loadShortcuts()
      } else {
        toast.error(result.message || '快捷键禁用失败')
      }
    } catch (error) {
      console.error('禁用快捷键失败:', error)
      toast.error(error instanceof Error ? `禁用快捷键失败: ${error.message}` : '禁用快捷键失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 加载快捷键列表
  const loadShortcuts = useCallback(async (): Promise<void> => {
    // 防抖：如果距离上次刷新不足1秒，则忽略
    const now = Date.now()
    if (isRefreshing || now - lastRefreshTime < 1000) {
      return
    }

    setIsRefreshing(true)
    setLastRefreshTime(now)

    try {
      // 显示加载指示器
      const toastId = toast.loading('正在加载快捷键列表...')

      const current = await window.api.enhanced.shortcut.getAll()
      setShortcuts(current)

      // 清除加载指示器并显示成功消息
      toast.dismiss(toastId)
      toast.success('快捷键列表已刷新')
    } catch (error) {
      console.error('加载快捷键失败:', error)
      toast.error(error instanceof Error ? `加载快捷键失败: ${error.message}` : '加载快捷键失败')
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, lastRefreshTime])

  // 保存快捷键
  const saveShortcut = useCallback(
    async (shortcut: Shortcut): Promise<void> => {
      setIsLoading(true)
      try {
        const result = await window.api.enhanced.shortcut.update(shortcut)
        if (result.success) {
          toast.success(result.message || '快捷键保存成功')
          await loadShortcuts()
          setEditingShortcut(null)
        } else {
          toast.error(result.message || '快捷键保存失败')
        }
      } catch (error) {
        console.error('保存快捷键失败:', error)
        toast.error(error instanceof Error ? `保存快捷键失败: ${error.message}` : '保存快捷键失败')
      } finally {
        setIsLoading(false)
      }
    },
    [loadShortcuts]
  )

  // 验证快捷键格式
  const validateShortcut = useCallback(async (cmd: string): Promise<boolean> => {
    try {
      const result = await window.api.enhanced.shortcut.validate(cmd)
      return result.valid
    } catch (error) {
      console.error('验证快捷键失败:', error)
      return false
    }
  }, [])

  // 检查快捷键冲突
  const checkShortcutConflict = useCallback(
    async (cmd: string, excludeId?: string): Promise<Shortcut | null> => {
      try {
        const result = await window.api.enhanced.shortcut.checkConflict(cmd, excludeId)
        return result.conflict
      } catch (error) {
        console.error('检查快捷键冲突失败:', error)
        return null
      }
    },
    []
  )

  // 保存快捷键前验证和检查冲突
  const saveShortcutWithValidation = useCallback(
    async (shortcut: Shortcut): Promise<void> => {
      // 验证格式
      const isValid = await validateShortcut(shortcut.cmd)
      if (!isValid) {
        toast.error('快捷键格式不正确，请使用如 Ctrl+Shift+A 的格式')
        return
      }

      // 检查冲突
      const conflict = await checkShortcutConflict(shortcut.cmd, shortcut.id)
      if (conflict) {
        toast.error(`快捷键 "${shortcut.cmd}" 与 "${conflict.tag}" 冲突`)
        return
      }

      // 保存快捷键
      await saveShortcut(shortcut)
    },
    [validateShortcut, checkShortcutConflict, saveShortcut]
  )

  // 键盘监听功能
  const startListening = async (): Promise<void> => {
    setIsListening(true)
    setCapturedKeys([])
  }

  const stopListening = async (): Promise<void> => {
    setIsListening(false)
    setCapturedKeys([])
  }

  const formatShortcut = (keys: string[]): string => {
    const keyOrder = ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Meta']
    const otherKeys = keys.filter((key) => !keyOrder.includes(key))
    const modifierKeys = keys.filter((key) => keyOrder.includes(key))

    const orderedKeys = [
      ...modifierKeys.sort((a, b) => keyOrder.indexOf(a) - keyOrder.indexOf(b)),
      ...otherKeys
    ]
    return orderedKeys.join('+')
  }

  useEffect(() => {
    if (!isListening) return

    const handleKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()

      const key = e.key
      const keyMap: Record<string, string> = {
        Control: 'Ctrl',
        Meta: 'Cmd',
        Command: 'Cmd',
        ' ': 'Space',
        ArrowUp: 'Up',
        ArrowDown: 'Down',
        ArrowLeft: 'Left',
        ArrowRight: 'Right'
      }

      const mappedKey = keyMap[key] || key
      const upperKey = mappedKey.length === 1 ? mappedKey.toUpperCase() : mappedKey

      if (!capturedKeys.includes(upperKey)) {
        setCapturedKeys((prev) => [...prev, upperKey])
      }
    }

    const handleKeyUp = async (e: KeyboardEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()

      // 当释放所有按键时，停止监听并设置快捷键
      if (capturedKeys.length > 0) {
        const shortcut = formatShortcut(capturedKeys)
        if (editingShortcut) {
          const updatedShortcut = { ...editingShortcut, cmd: shortcut }
          // 保存快捷键
          await saveShortcutWithValidation(updatedShortcut)
          // 延迟重新加载数据，避免在渲染过程中更新状态
          setTimeout(() => {
            loadShortcuts()
          }, 0)
        }
        await stopListening()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keyup', handleKeyUp, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keyup', handleKeyUp, true)
    }
  }, [isListening, capturedKeys, editingShortcut, saveShortcutWithValidation, loadShortcuts])

  useEffect(() => {
    // 组件挂载时加载快捷键列表
    loadShortcuts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 获取快捷键类型显示文本
  const getShortcutTypeText = (shortcut: Shortcut): React.ReactElement => {
    if (shortcut.isGlobal) {
      return <Badge variant="default">全局</Badge>
    }
    return <Badge variant="secondary">应用内</Badge>
  }

  // 获取快捷键实际注册状态
  const getShortcutRegisteredStatus = (shortcut: Shortcut): boolean => {
    // 检查实际注册状态：查找相同ID且已注册的快捷键
    return shortcuts.some((s) => s.id === shortcut.id && s.isOpen)
  }

  // 获取状态显示文本
  const getStatusText = (shortcut: Shortcut): React.ReactElement => {
    const isRegistered = getShortcutRegisteredStatus(shortcut)
    if (isRegistered) {
      return (
        <Badge variant="default" className="bg-green-500">
          已启用
        </Badge>
      )
    }
    return <Badge variant="outline">未启用</Badge>
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-semibold">全局快捷键</Label>
          <p className="text-sm text-muted-foreground">管理全局快捷键功能，提升操作效率</p>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={enableAllShortcuts} disabled={isLoading} variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          启动所有快捷键
        </Button>
        <Button onClick={disableAllShortcuts} disabled={isLoading} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          禁用所有快捷键
        </Button>
        <Button onClick={resetToDefaults} disabled={isLoading} variant="outline" size="sm">
          <Undo className="h-4 w-4 mr-2" />
          恢复默认配置
        </Button>
        <Button onClick={loadShortcuts} disabled={isLoading || isRefreshing} variant="outline" size="sm">
          <RotateCcw className="h-4 w-4 mr-2" />
          刷新列表
        </Button>
      </div>

      {/* 快捷键列表 - 紧凑表格形式 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-4">
          <Keyboard className="h-5 w-5" />
          <h3 className="text-lg font-semibold">快捷键列表</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          管理应用的快捷键配置，支持全局和应用内快捷键。点击类型、快捷键或状态可直接修改。
        </p>

        <div className="border rounded-lg">
          <div className="grid grid-cols-4 gap-4 p-3 border-b bg-muted/50">
            <div className="font-medium text-sm">功能</div>
            <div className="font-medium text-sm">类型</div>
            <div className="font-medium text-sm">快捷键</div>
            <div className="font-medium text-sm text-right">状态</div>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="divide-y">
              {shortcuts.map((shortcut) => {
                const isRegistered = getShortcutRegisteredStatus(shortcut)
                const isCurrentlyEditing = isListening && editingShortcut?.id === shortcut.id
                return (
                  <div
                    key={shortcut.id}
                    className="grid grid-cols-4 gap-4 p-3 items-center hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{shortcut.tag}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const updatedShortcut = { ...shortcut, isGlobal: !shortcut.isGlobal }
                          await saveShortcutWithValidation(updatedShortcut)
                          // 重新加载状态以确保UI更新
                          await loadShortcuts()
                        }}
                        disabled={
                          isLoading ||
                          isListening ||
                          shortcut.id === 'refresh-page' ||
                          shortcut.id === 'copy-url' ||
                          shortcut.id === 'toggle-sidebar' ||
                          shortcut.id === 'open-settings'
                        }
                        className="h-auto p-1"
                      >
                        {getShortcutTypeText(shortcut)}
                      </Button>
                      {(shortcut.id === 'refresh-page' ||
                        shortcut.id === 'copy-url' ||
                        shortcut.id === 'toggle-sidebar' ||
                        shortcut.id === 'open-settings') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center justify-center w-4 h-4 rounded-full bg-muted hover:bg-muted/80 cursor-help">
                                <HelpCircle className="w-3 h-3 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {shortcut.id === 'refresh-page'
                                  ? '刷新快捷键只能在应用内生效'
                                  : shortcut.id === 'copy-url'
                                    ? '复制URL快捷键只能在应用内生效'
                                    : shortcut.id === 'toggle-sidebar'
                                      ? '侧边栏导航快捷键只能在应用内生效'
                                      : '设置界面快捷键只能在应用内生效'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          setEditingShortcut(shortcut)
                          await startListening()
                        }}
                        disabled={isListening || !isRegistered}
                        className={`h-auto p-1 font-mono text-sm transition-colors ${
                          isCurrentlyEditing
                            ? 'bg-red-100 dark:bg-red-900 border-red-300 dark:border-red-700'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <code
                          className={`px-2 py-1 rounded ${
                            isCurrentlyEditing
                              ? 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100'
                              : 'bg-muted'
                          }`}
                        >
                          {isCurrentlyEditing
                            ? capturedKeys.length > 0
                              ? formatShortcut(capturedKeys) + '...'
                              : '监听中...'
                            : shortcut.cmd}
                        </code>
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          if (isRegistered) {
                            // 禁用快捷键：更新 isOpen 为 false
                            await saveShortcutWithValidation({ ...shortcut, isOpen: false })
                          } else {
                            // 启用快捷键：更新 isOpen 为 true
                            await saveShortcutWithValidation({ ...shortcut, isOpen: true })
                          }
                          // 重新加载状态以确保UI更新
                          await loadShortcuts()
                        }}
                        disabled={isLoading}
                        className="h-auto p-1"
                      >
                        {getStatusText(shortcut)}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
