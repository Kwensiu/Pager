import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Textarea } from '@/ui/textarea'
import { Plus, Trash2, Edit, Copy, Check, Code2, Save, X } from 'lucide-react'

export interface UserScript {
  id: string
  name: string
  description?: string
  code: string
  createdAt: number
  updatedAt: number
  source?: string // 来源，如 'greasyfork', 'custom'
}

const STORAGE_KEY = 'pager_user_scripts'

interface ScriptManagerProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSelectScript?: (script: UserScript) => void
  onSaveSelection?: (scripts: UserScript[]) => void // 保存选中的脚本（select模式）
  selectedScriptIds?: string[] // 已选中的脚本ID（select模式）
  onManageScripts?: () => void // 打开管理脚本库的回调
  mode?: 'manage' | 'select'
}

export function ScriptManager({
  open,
  onOpenChange,
  onSelectScript,
  onSaveSelection,
  selectedScriptIds = [],
  onManageScripts,
  mode = 'manage'
}: ScriptManagerProps): JSX.Element {
  const [scripts, setScripts] = useState<UserScript[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('Failed to load scripts:', error)
      return []
    }
  })
  const [showEditor, setShowEditor] = useState(false)
  const [editingScript, setEditingScript] = useState<UserScript | null>(null)
  const [newScriptName, setNewScriptName] = useState('')
  const [newScriptCode, setNewScriptCode] = useState('')
  const [newScriptDescription, setNewScriptDescription] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedScriptIds)

  // 选择脚本（用于 select 模式）
  const handleSelectScript = (script: UserScript): void => {
    // 多选模式：切换选中状态
    if (onSaveSelection) {
      setSelectedIds((prev) =>
        prev.includes(script.id) ? prev.filter((id) => id !== script.id) : [...prev, script.id]
      )
    } else if (onSelectScript) {
      // 旧模式：单个选择后立即关闭
      onSelectScript(script)
      onOpenChange?.(false)
    }
  }

  const saveScripts = (updatedScripts: UserScript[]): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScripts))
      setScripts(updatedScripts)

      // 触发自定义事件通知其他组件脚本库已更新
      window.dispatchEvent(new CustomEvent('pager:scripts-updated'))
    } catch (error) {
      console.error('Failed to save scripts:', error)
      showToast('保存脚本失败', 'error')
    }
  }

  const showToast = (message: string, type: 'success' | 'error'): void => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // 创建新脚本
  const handleCreateScript = (): void => {
    const script: UserScript = {
      id: `script_${Date.now()}`,
      name: newScriptName || '未命名脚本',
      description: newScriptDescription,
      code: newScriptCode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: 'custom'
    }

    const updatedScripts = [...scripts, script]
    saveScripts(updatedScripts)

    setNewScriptName('')
    setNewScriptCode('')
    setNewScriptDescription('')
    setShowEditor(false)
    showToast('脚本创建成功', 'success')
  }

  // 更新脚本
  const handleUpdateScript = (): void => {
    if (!editingScript) return

    const updatedScript: UserScript = {
      ...editingScript,
      name: newScriptName || editingScript.name,
      description: newScriptDescription,
      code: newScriptCode || editingScript.code,
      updatedAt: Date.now()
    }

    const updatedScripts = scripts.map((s) => (s.id === updatedScript.id ? updatedScript : s))

    saveScripts(updatedScripts)

    setEditingScript(null)
    setNewScriptName('')
    setNewScriptCode('')
    setNewScriptDescription('')
    setShowEditor(false)
    showToast('脚本更新成功', 'success')
  }

  // 删除脚本
  const handleDeleteScript = (id: string): void => {
    if (!confirm('确定要删除此脚本吗？')) return

    const updatedScripts = scripts.filter((s) => s.id !== id)
    saveScripts(updatedScripts)
    showToast('脚本删除成功', 'success')
  }

  // 复制脚本
  const handleCopyScript = (script: UserScript): void => {
    const newScript: UserScript = {
      ...script,
      id: `script_${Date.now()}`,
      name: `${script.name} (副本)`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    const updatedScripts = [...scripts, newScript]
    saveScripts(updatedScripts)
    showToast('脚本复制成功', 'success')
  }

  // 打开编辑器
  const openEditor = (script?: UserScript): void => {
    if (script) {
      setEditingScript(script)
      setNewScriptName(script.name)
      setNewScriptDescription(script.description || '')
      setNewScriptCode(script.code)
    } else {
      setEditingScript(null)
      setNewScriptName('')
      setNewScriptDescription('')
      setNewScriptCode('')
    }
    setShowEditor(true)
  }

  // 保存选中的脚本
  const handleSaveSelection = (): void => {
    if (!onSaveSelection) return
    const selectedScripts = scripts.filter((script) => selectedIds.includes(script.id))
    onSaveSelection(selectedScripts)
    onOpenChange?.(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(80vh-4vh)] overflow-hidden flex flex-col max-w-[900px] lg:max-w-[1400px] px-4 sm:px-6 lg:px-8"
        style={{
          marginLeft: 'auto',
          marginRight: 'auto',
          maxWidth: 'min(1400px, max(50vw, 450px))'
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            {mode === 'select' ? '选择脚本' : '脚本管理'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'select'
              ? '从脚本库中选择要注入的脚本'
              : '管理和编辑你的自定义 JavaScript 脚本'}
          </DialogDescription>
        </DialogHeader>

        {/* 脚本列表 */}
        {!showEditor && (
          <div className="flex-1 overflow-auto py-4">
            {scripts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Code2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>还没有保存的脚本</p>
                <p className="text-sm mt-2">点击下方按钮创建第一个脚本</p>
              </div>
            ) : (
              <div
                className={
                  mode === 'manage'
                    ? 'flex flex-col gap-3 px-2'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 px-2'
                }
              >
                {scripts.map((script) => {
                  const isSelected = selectedIds.includes(script.id)
                  return (
                    <div
                      key={script.id}
                      className={`relative p-4 border rounded-lg transition-all cursor-pointer ${mode === 'manage' ? '' : 'min-h-[140px] w-full'} ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'hover:bg-accent/50'
                      }`}
                      onClick={() => handleSelectScript(script)}
                    >
                      {/* 选中状态视觉反馈 - 无复选框，仅保留边框高亮 */}
                      {mode === 'select' && onSaveSelection && isSelected && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-primary pointer-events-none" />
                      )}

                      {mode === 'manage' ? (
                        // 管理模式：列表布局
                        <>
                          <div className="flex items-center gap-4">
                            {/* 左侧：脚本信息 */}
                            <div className="flex-1 min-w-0">
                              {/* 脚本标题和标签 */}
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate text-base">{script.name}</h3>
                                {script.source && (
                                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex-shrink-0">
                                    {script.source}
                                  </span>
                                )}
                              </div>

                              {/* 脚本描述 */}
                              {script.description && (
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                  {script.description}
                                </p>
                              )}

                              {/* 脚本元数据 */}
                              <div className="text-xs text-muted-foreground flex items-center gap-x-4 gap-y-1 flex-wrap">
                                <span>
                                  更新于 {new Date(script.updatedAt).toLocaleDateString()}
                                </span>
                                <span>{script.code.length} 字符</span>
                              </div>
                            </div>

                            {/* 管理模式操作按钮 - 移动到右侧 */}
                            <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEditor(script)
                                }}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleCopyScript(script)
                                }}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteScript(script.id)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        // 选择模式：卡片布局（保持原有结构）
                        <div className="flex flex-col h-full pr-8">
                          {/* 脚本标题和标签 */}
                          <div className="mb-2">
                            <h3 className="font-medium truncate text-base">{script.name}</h3>
                            {script.source && (
                              <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full mt-1 inline-block">
                                {script.source}
                              </span>
                            )}
                          </div>

                          {/* 脚本描述 */}
                          {script.description && (
                            <p className="text-sm text-muted-foreground mb-3 line-clamp-2 flex-1">
                              {script.description}
                            </p>
                          )}

                          {/* 脚本元数据 */}
                          <div className="text-xs text-muted-foreground pt-2 space-y-1">
                            <div className="truncate">
                              更新于 {new Date(script.updatedAt).toLocaleDateString()}
                            </div>
                            <div>{script.code.length} 字符</div>
                          </div>

                          {/* 选择模式选择提示 */}
                          {mode === 'select' && !onSaveSelection && onSelectScript && (
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSelectScript(script)
                                }}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                选择此脚本
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 脚本编辑器 */}
        {showEditor && (
          <div className="flex-1 overflow-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="script-name">脚本名称</Label>
              <Input
                id="script-name"
                value={newScriptName}
                onChange={(e) => setNewScriptName(e.target.value)}
                placeholder="例如：广告拦截脚本"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="script-description">描述（可选）</Label>
              <Input
                id="script-description"
                value={newScriptDescription}
                onChange={(e) => setNewScriptDescription(e.target.value)}
                placeholder="描述脚本的功能"
              />
            </div>

            <div className="space-y-2 flex-1">
              <Label htmlFor="script-code">JavaScript 代码</Label>
              <Textarea
                id="script-code"
                value={newScriptCode}
                onChange={(e) => setNewScriptCode(e.target.value)}
                placeholder="// 在这里输入 JavaScript 代码
console.log('脚本已注入');
document.body.style.backgroundColor = '#f0f0f0';"
                className="flex-1 font-mono text-sm min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                代码将在页面 DOM 加载完成后执行，可以访问 document 和 window 对象
              </p>
            </div>
          </div>
        )}

        {/* 底部操作栏 */}
        <DialogFooter>
          {showEditor ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditor(false)
                  setEditingScript(null)
                }}
              >
                <X className="h-4 w-4 mr-2" />
                取消
              </Button>
              <Button
                onClick={editingScript ? handleUpdateScript : handleCreateScript}
                disabled={!newScriptCode.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {editingScript ? '更新脚本' : '保存脚本'}
              </Button>
            </>
          ) : (
            <>
              {mode === 'manage' && (
                <Button onClick={() => openEditor()} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  新建脚本
                </Button>
              )}
              {mode === 'select' && (
                <>
                  {/* 保存按钮 */}
                  {onSaveSelection && (
                    <Button
                      variant="default"
                      onClick={handleSaveSelection}
                      disabled={selectedIds.length === 0}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      保存选择
                    </Button>
                  )}
                  {onManageScripts && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        onOpenChange?.(false)
                        onManageScripts()
                      }}
                    >
                      <Code2 className="h-4 w-4 mr-2" />
                      管理脚本库
                    </Button>
                  )}
                </>
              )}
              <Button variant="outline" onClick={() => onOpenChange?.(false)}>
                关闭
              </Button>
            </>
          )}
        </DialogFooter>

        {/* Toast 通知 */}
        {toast && (
          <div
            className={`fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition-opacity ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' && <Check className="h-4 w-4" />}
            {toast.type === 'error' && <X className="h-4 w-4" />}
            {toast.message}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
