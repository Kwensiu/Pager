import { Label } from '../../ui/label'
import { Switch } from '../../ui/switch'

export function ShortcutSettings(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* 开关控制 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="text-base font-semibold">全局快捷键</Label>
          <p className="text-sm text-muted-foreground">全局快捷键功能已禁用</p>
        </div>
        <Switch checked={false} disabled />
      </div>

      {/* 功能已禁用提示 */}
      <div className="p-4 bg-muted/50 rounded-lg border border-muted">
        <p className="text-sm text-muted-foreground">
          快捷键功能已暂时禁用。此功能存在实现问题，需要重新设计。
        </p>
      </div>
    </div>
  )
}
