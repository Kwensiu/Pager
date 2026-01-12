import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { SecondaryGroup } from '@/types/website'

export interface EditSecondaryGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: SecondaryGroup | null
  onSave: (group: SecondaryGroup) => void
}

const EditSecondaryGroupDialog: React.FC<EditSecondaryGroupDialogProps> = ({
  open,
  onOpenChange,
  group,
  onSave
}) => {
  // Initialize name from group prop - will reset when group.id changes due to key prop
  const [name, setName] = useState(group?.name ?? '')

  const handleSave = (): void => {
    if (!group) return
    const updatedGroup = { ...group, name }
    onSave(updatedGroup)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={group?.id}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑分组</DialogTitle>
          <DialogDescription>修改分组名称</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="groupName">分组名称</Label>
            <Input
              id="groupName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入分组名称"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" onClick={handleSave} disabled={!name.trim()}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditSecondaryGroupDialog
