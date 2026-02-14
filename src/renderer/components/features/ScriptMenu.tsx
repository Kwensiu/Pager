import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/ui/dropdown-menu'
import { Code2, Play, SlidersHorizontal } from 'lucide-react'
import { UserScript } from './ScriptManager'
import { ScriptConfigDialog } from './ScriptConfigDialog'

// 定义 CustomEvent 的类型
declare global {
  interface WindowEventMap {
    'gm-register-menu-command': CustomEvent<RegisteredCommand>
  }
}

interface ScriptMenuProps {
  websiteId?: string
  onConfigSaved?: () => void // 配置保存后的回调（用于刷新页面）
}

interface RegisteredCommand {
  id: string
  name: string
  callback: () => void
}

export function ScriptMenu({ websiteId, onConfigSaved }: ScriptMenuProps): JSX.Element | null {
  // 初始化活跃脚本状态的辅助函数
  const initializeActiveScripts = useCallback(
    async (websiteIdParam?: string): Promise<UserScript[]> => {
      if (!websiteIdParam) {
        return []
      }

      try {
        // 从 localStorage 加载所有脚本
        const stored = localStorage.getItem('pager_user_scripts')
        let allScripts: UserScript[] = []
        if (stored) {
          allScripts = JSON.parse(stored)
        }

        // 从数据库获取当前网站激活的脚本
        const jsCodeList = await window.api.enhanced.jsInjector.getWebsiteJsCode(websiteIdParam)
        if (jsCodeList && jsCodeList.length > 0) {
          // 根据代码匹配找到对应的脚本
          const active: UserScript[] = []
          jsCodeList.forEach(({ code }) => {
            const script = allScripts.find((s) => s.code === code)
            if (script) {
              active.push(script)
            }
          })
          return active
        } else {
          return []
        }
      } catch (error) {
        console.error('Failed to load active scripts:', error)
        return []
      }
    },
    [] // 保留空依赖数组，因为每次调用都会重新读取localStorage
  )

  const [activeScripts, setActiveScripts] = useState<UserScript[]>([])
  const [registeredCommands, setRegisteredCommands] = useState<RegisteredCommand[]>([])
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const [selectedScript, setSelectedScript] = useState<UserScript | null>(null)

  // 使用 useEffect 来设置初始状态，并在 websiteId 变化时重新加载
  useEffect(() => {
    const loadScripts = async (): Promise<void> => {
      if (websiteId) {
        const scripts = await initializeActiveScripts(websiteId)
        setActiveScripts(scripts)
      } else {
        setActiveScripts([])
      }
    }

    loadScripts()
  }, [websiteId, initializeActiveScripts])

  // 监听 localStorage 变化，当脚本库更新时重新加载
  useEffect(() => {
    if (!websiteId) return

    // 监听自定义事件，因为 storage 事件在同一窗口内不会触发
    const handleScriptLibraryChange = (): void => {
      initializeActiveScripts(websiteId).then(setActiveScripts)
    }

    window.addEventListener('pager:scripts-updated', handleScriptLibraryChange)

    // 同时保留 storage 事件监听（跨窗口同步）
    const handleStorageChange = (e: StorageEvent): void => {
      if (e.key === 'pager_user_scripts') {
        handleScriptLibraryChange()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 窗口获得焦点时重新检查
    const handleFocus = (): void => {
      handleScriptLibraryChange()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('pager:scripts-updated', handleScriptLibraryChange)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [websiteId, initializeActiveScripts])

  // 监听 GM_registerMenuCommand 注册的事件
  useEffect(() => {
    if (!websiteId) return

    const handleRegisterCommand = (event: CustomEvent<RegisteredCommand>): void => {
      setRegisteredCommands((prev) => {
        if (prev.some((cmd) => cmd.id === event.detail.id)) {
          return prev
        }
        return [...prev, event.detail]
      })
    }

    window.addEventListener('gm-register-menu-command', handleRegisterCommand)

    return () => {
      window.removeEventListener('gm-register-menu-command', handleRegisterCommand)
    }
  }, [websiteId, setRegisteredCommands])

  // 执行注册的菜单命令
  const executeCommand = (command: RegisteredCommand): void => {
    command.callback()
  }

  // 打开脚本配置
  const openScriptConfig = (script: UserScript): void => {
    setSelectedScript(script)
    setConfigDialogOpen(true)
  }

  // 手动刷新活跃脚本列表
  const refreshActiveScripts = useCallback(async (): Promise<void> => {
    if (websiteId) {
      const scripts = await initializeActiveScripts(websiteId)
      setActiveScripts(scripts)
    }
  }, [websiteId, initializeActiveScripts])

  // 始终显示按钮，即使没有激活的脚本

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-foreground hover:bg-accent hover:text-accent-foreground relative"
          aria-label="用户脚本"
        >
          <Code2 className="h-4 w-4" />
          {activeScripts.length > 0 && (
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>用户脚本</span>
          {activeScripts.length > 0 && (
            <span className="text-xs text-muted-foreground">{activeScripts.length} 个激活</span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* 已注册的菜单命令 */}
        {registeredCommands.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              脚本命令
            </DropdownMenuLabel>
            {registeredCommands.map((command) => (
              <DropdownMenuItem key={command.id} onClick={() => executeCommand(command)}>
                <Play className="h-4 w-4 mr-2" />
                {command.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* 已激活的脚本列表 - 只显示配置按钮 */}
        {activeScripts.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              已注入脚本（点击配置）
            </DropdownMenuLabel>
            {activeScripts.map((script) => (
              <DropdownMenuItem
                key={script.id}
                onClick={() => openScriptConfig(script)}
                className="flex items-center justify-between"
              >
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate">{script.name}</span>
                  {script.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {script.description}
                    </span>
                  )}
                </div>
                <SlidersHorizontal className="h-4 w-4 ml-2 flex-shrink-0 text-muted-foreground" />
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
      </DropdownMenuContent>

      {/* 脚本配置对话框 */}
      <ScriptConfigDialog
        open={configDialogOpen}
        onOpenChange={setConfigDialogOpen}
        script={selectedScript}
        onConfigSaved={() => {
          refreshActiveScripts()
          onConfigSaved?.()
        }}
      />
    </DropdownMenu>
  )
}
