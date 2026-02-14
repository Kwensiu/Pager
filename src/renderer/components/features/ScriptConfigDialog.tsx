import { useState, useCallback } from 'react'
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
import { Switch } from '@/ui/switch'
import { Settings, Trash2, Plus, Save, X, RefreshCw } from 'lucide-react'
import { UserScript } from './ScriptManager'

interface ScriptConfig {
  key: string
  value: string
  type: 'string' | 'number' | 'boolean' | 'json'
  description?: string
}

interface ScriptConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  script: UserScript | null
  websiteId?: string
  onConfigSaved?: () => void // 配置保存后的回调
}

// 加载脚本配置
const parseScriptDefaults = (
  code: string
): Map<string, { value: string; type: ScriptConfig['type'] }> => {
  const defaults = new Map<string, { value: string; type: ScriptConfig['type'] }>()

  // 匹配各种形式的 GM_getValue 调用：
  // GM_getValue('key', defaultValue)
  // GM_getValue("key", defaultValue)
  // _GM_getValue('key', defaultValue)
  // _GM_getValue(`prefix_${key}`, defaultValue) - 模板字符串
  const regex =
    /[_\w]*GM_getValue\s*\(\s*(?:['"`]([^'"`]+)['"`]|`([^`]+)`|\$\{([^}]+)\})\s*,\s*([^)]+)\s*\)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(code)) !== null) {
    // 获取键名（可能是普通字符串或模板字符串）
    const key = match[1] || match[2] || match[3] || ''
    const defaultValueStr = match[4].trim()

    // 如果键名包含 ${...}，说明是模板字符串，跳过（太复杂）
    if (key.includes('${')) {
      console.log('[ScriptConfig] Skipping dynamic key:', key)
      continue
    }

    // 如果键名为空，跳过
    if (!key) {
      continue
    }

    try {
      // 尝试解析默认值
      let value: string
      let type: ScriptConfig['type'] = 'string'

      // 检查是否是布尔值
      if (defaultValueStr === 'true' || defaultValueStr === 'false') {
        value = defaultValueStr
        type = 'boolean'
      }
      // 检查是否是数字
      else if (
        !isNaN(Number(defaultValueStr)) &&
        defaultValueStr !== '' &&
        !defaultValueStr.includes(' ')
      ) {
        value = defaultValueStr
        type = 'number'
      }
      // 检查是否是字符串（带引号）
      else if (
        (defaultValueStr.startsWith('"') && defaultValueStr.endsWith('"')) ||
        (defaultValueStr.startsWith("'") && defaultValueStr.endsWith("'"))
      ) {
        value = defaultValueStr.slice(1, -1)
        type = 'string'
      }
      // 检查是否是对象/数组
      else if (defaultValueStr.startsWith('{') || defaultValueStr.startsWith('[')) {
        try {
          const parsed = JSON.parse(defaultValueStr)
          value = JSON.stringify(parsed, null, 2)
          type = 'json'
        } catch {
          value = defaultValueStr
        }
      }
      // 其他情况作为字符串处理
      else {
        value = defaultValueStr
      }

      defaults.set(key, { value, type })
      console.log('[ScriptConfig] Parsed default:', key, '=', value, '(' + type + ')')
    } catch (e) {
      console.warn('Failed to parse default value for key:', key, e)
    }
  }

  return defaults
}

export function ScriptConfigDialog({
  open,
  onOpenChange,
  script,
  onConfigSaved
}: Omit<ScriptConfigDialogProps, 'websiteId'>): JSX.Element | null {
  // 初始化配置数据的函数
  const initializeConfigs = useCallback(
    (
      scriptParam: UserScript | null,
      openParam: boolean
    ): { configs: ScriptConfig[]; pendingConfigs: ScriptConfig[]; hasChanges: boolean } => {
      if (!scriptParam || !openParam) {
        return { configs: [], pendingConfigs: [], hasChanges: false }
      }

      try {
        // 从脚本代码中解析默认值
        const defaultConfigs = parseScriptDefaults(scriptParam.code)

        // 从 GM_getValue 存储中读取已保存的配置
        const storageKey = `pager_gm_storage_${scriptParam.id}_`
        const loadedConfigs: ScriptConfig[] = []
        const processedKeys = new Set<string>()

        // 首先读取已保存的配置
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(storageKey)) {
            const configKey = key.substring(storageKey.length)
            const value = localStorage.getItem(key)
            if (value !== null) {
              let parsedValue: string
              let type: ScriptConfig['type'] = 'string'

              try {
                const parsed = JSON.parse(value)
                if (typeof parsed === 'boolean') {
                  type = 'boolean'
                  parsedValue = String(parsed)
                } else if (typeof parsed === 'number') {
                  type = 'number'
                  parsedValue = String(parsed)
                } else if (typeof parsed === 'object') {
                  type = 'json'
                  parsedValue = JSON.stringify(parsed, null, 2)
                } else {
                  parsedValue = String(parsed)
                }
              } catch {
                parsedValue = value
              }

              loadedConfigs.push({
                key: configKey,
                value: parsedValue,
                type
              })
              processedKeys.add(configKey)
            }
          }
        }

        // 然后添加脚本中定义但尚未保存的默认值
        defaultConfigs.forEach((defaultConfig, key) => {
          if (!processedKeys.has(key)) {
            loadedConfigs.push({
              key,
              value: defaultConfig.value,
              type: defaultConfig.type,
              description: '默认值（来自脚本）'
            })
          }
        })

        return { configs: loadedConfigs, pendingConfigs: loadedConfigs, hasChanges: false }
      } catch (error) {
        console.error('Failed to load script configs:', error)
        return { configs: [], pendingConfigs: [], hasChanges: false }
      }
    },
    []
  )

  // 从存储加载配置的函数（供刷新使用）
  const loadConfigsFromStorage = useCallback((): ScriptConfig[] => {
    try {
      return initializeConfigs(script, open).configs
    } catch (error) {
      console.error('Failed to load configs from storage:', error)
      return []
    }
  }, [script, open, initializeConfigs])

  const [configs, setConfigs] = useState<ScriptConfig[]>(() => {
    return initializeConfigs(script, open).configs
  })
  const [pendingConfigs, setPendingConfigs] = useState<ScriptConfig[]>(() => {
    return initializeConfigs(script, open).pendingConfigs
  })
  const [hasChanges, setHasChanges] = useState(() => {
    return initializeConfigs(script, open).hasChanges
  })
  const [newConfig, setNewConfig] = useState<Partial<ScriptConfig>>({
    type: 'string'
  })
  const [showAddForm, setShowAddForm] = useState(false)

  // 刷新配置
  const handleRefresh = (): void => {
    if (!script) return
    const loaded = loadConfigsFromStorage()
    setPendingConfigs(loaded)
    setHasChanges(false)
  }

  // 保存所有配置
  const handleSaveAll = (): void => {
    if (!script) return

    try {
      // 删除所有旧配置
      const storageKeyPrefix = `pager_gm_storage_${script.id}_`
      const keysToRemove: string[] = []
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(storageKeyPrefix)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
      } catch (clearError) {
        console.error('Failed to clear old configs:', clearError)
        // 继续尝试保存新配置
      }

      // 保存新配置
      let saveSuccess = true
      pendingConfigs.forEach((config) => {
        const storageKey = `pager_gm_storage_${script.id}_${config.key}`
        let valueToStore: unknown

        switch (config.type) {
          case 'boolean':
            valueToStore = config.value === 'true'
            break
          case 'number':
            valueToStore = Number(config.value)
            break
          case 'json':
            try {
              valueToStore = JSON.parse(config.value)
            } catch {
              valueToStore = config.value
            }
            break
          default:
            valueToStore = config.value
        }

        try {
          localStorage.setItem(storageKey, JSON.stringify(valueToStore))
        } catch (saveError) {
          console.error(`Failed to save config ${config.key}:`, saveError)
          saveSuccess = false
        }
      })

      if (saveSuccess) {
        setConfigs(pendingConfigs)
        setHasChanges(false)
        // 通知父组件配置已保存
        onConfigSaved?.()
      } else {
        console.error('Some configs failed to save')
      }
    } catch (error) {
      console.error('Failed to save configs:', error)
    }
  }

  // 取消并关闭
  const handleCancel = (): void => {
    setPendingConfigs(configs)
    setHasChanges(false)
    onOpenChange(false)
  }

  // 更新待保存的配置
  const updatePendingConfig = (config: ScriptConfig): void => {
    setPendingConfigs((prev) => {
      const index = prev.findIndex((c) => c.key === config.key)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = config
        return updated
      }
      return [...prev, config]
    })
    setHasChanges(true)
  }

  // 删除待保存的配置
  const deletePendingConfig = (key: string): void => {
    setPendingConfigs((prev) => prev.filter((c) => c.key !== key))
    setHasChanges(true)
  }

  // 添加新配置
  const handleAddConfig = (): void => {
    if (!newConfig.key || !newConfig.value) return

    const newConfigItem: ScriptConfig = {
      key: newConfig.key,
      value: newConfig.value,
      type: newConfig.type || 'string',
      description: newConfig.description
    }

    setPendingConfigs((prev) => [...prev, newConfigItem])
    setHasChanges(true)
    setShowAddForm(false)
    setNewConfig({ type: 'string' })
  }

  // 更新配置值
  const updateConfigValue = (key: string, value: string): void => {
    const config = pendingConfigs.find((c) => c.key === key)
    if (config) {
      updatePendingConfig({ ...config, value })
    }
  }

  // 渲染配置值输入
  const renderConfigInput = (config: ScriptConfig): JSX.Element => {
    switch (config.type) {
      case 'boolean':
        return (
          <Switch
            checked={config.value === 'true'}
            onCheckedChange={(checked) => updateConfigValue(config.key, String(checked))}
          />
        )
      case 'json':
        return (
          <Textarea
            value={config.value}
            onChange={(e) => updateConfigValue(config.key, e.target.value)}
            className="font-mono text-xs min-h-[80px]"
          />
        )
      default:
        return (
          <Input
            value={config.value}
            onChange={(e) => updateConfigValue(config.key, e.target.value)}
            type={config.type === 'number' ? 'number' : 'text'}
          />
        )
    }
  }

  if (!script) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            脚本配置(Beta)
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              title="刷新配置"
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            配置 &quot;{script.name}&quot; 的设置项
            {hasChanges && <span className="ml-2 text-amber-500 text-xs">（有未保存的更改）</span>}
          </DialogDescription>
          <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
            提示：配置保存后页面将自动刷新，但部分脚本可能不支持外部配置，功能仅作尝试，不保证一定生效
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4 py-4">
          {/* 现有配置列表 */}
          {pendingConfigs.length > 0 ? (
            <div className="space-y-3">
              {pendingConfigs.map((config) => (
                <div key={config.key} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">{config.key}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                        {config.type}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deletePendingConfig(config.key)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {config.description && (
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  )}
                  <div>{renderConfigInput(config)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>暂无配置项</p>
              <p className="text-sm mt-2">点击下方按钮添加配置</p>
              <div className="mt-4 p-3 bg-muted rounded text-xs text-left">
                <p className="font-medium mb-1">提示：</p>
                <p>某些脚本（如压缩后的脚本）的默认值无法自动识别。</p>
                <p className="mt-1">你可以手动添加配置项，键名通常是脚本中使用的名称。</p>
              </div>
            </div>
          )}

          {/* 添加新配置表单 */}
          {showAddForm ? (
            <div className="p-3 border rounded-lg space-y-3">
              <h4 className="font-medium">添加配置项</h4>
              <div className="space-y-2">
                <Label>键名</Label>
                <Input
                  value={newConfig.key || ''}
                  onChange={(e) => setNewConfig({ ...newConfig, key: e.target.value })}
                  placeholder="例如：theme, autoPlay, debugMode"
                />
              </div>
              <div className="space-y-2">
                <Label>类型</Label>
                <select
                  value={newConfig.type}
                  onChange={(e) =>
                    setNewConfig({ ...newConfig, type: e.target.value as ScriptConfig['type'] })
                  }
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="string">字符串</option>
                  <option value="number">数字</option>
                  <option value="boolean">布尔值</option>
                  <option value="json">JSON</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>值</Label>
                {newConfig.type === 'boolean' ? (
                  <Switch
                    checked={newConfig.value === 'true'}
                    onCheckedChange={(checked) =>
                      setNewConfig({ ...newConfig, value: String(checked) })
                    }
                  />
                ) : newConfig.type === 'json' ? (
                  <Textarea
                    value={newConfig.value || ''}
                    onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                    placeholder='{"key": "value"}'
                    className="font-mono text-xs min-h-[80px]"
                  />
                ) : (
                  <Input
                    value={newConfig.value || ''}
                    onChange={(e) => setNewConfig({ ...newConfig, value: e.target.value })}
                    type={newConfig.type === 'number' ? 'number' : 'text'}
                    placeholder="输入值"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>描述（可选）</Label>
                <Input
                  value={newConfig.description || ''}
                  onChange={(e) => setNewConfig({ ...newConfig, description: e.target.value })}
                  placeholder="配置项的描述"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
                <Button onClick={handleAddConfig} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowAddForm(true)} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              添加配置项
            </Button>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            取消
          </Button>
          <Button onClick={handleSaveAll} disabled={!hasChanges}>
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
