import { useState, useEffect } from 'react'
import { Folder, Trash2 } from 'lucide-react'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { PrimaryGroup } from '@/types/website'
import { useI18n } from '@/core/i18n/useI18n'

interface EditPrimaryGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: PrimaryGroup | null
  onSave: (group: PrimaryGroup) => void
  onDelete: (groupId: string) => void
}

export function EditPrimaryGroupDialog({
  open,
  onOpenChange,
  group,
  onSave,
  onDelete
}: EditPrimaryGroupDialogProps): JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()

  const resetForm = (): void => {
    setName('')
    setError(undefined)
  }

  useEffect(() => {
    if (open && group) {
      const timer = requestAnimationFrame(() => {
        setName(group.name)
        setError(undefined)
      })
      return () => cancelAnimationFrame(timer)
    }
    if (!open) {
      requestAnimationFrame(() => resetForm())
    }
    return
  }, [open, group])

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setError(t('groupNameRequired'))
      return
    }

    if (group) {
      onSave({
        ...group,
        name: name.trim(),
        updatedAt: Date.now()
      })
    }
    onOpenChange(false)
  }

  const handleDelete = (): void => {
    if (group) {
      onDelete(group.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {t('edit')} {t('addGroup.primary')}
          </DialogTitle>
          <DialogDescription>修改分类名称或删除此分类</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="group-name">
              {t('groupName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder={t('groupNamePlaceholder.primary')}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(undefined)
              }}
              className={error ? 'border-destructive' : ''}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('delete')}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit}>{t('save')}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
