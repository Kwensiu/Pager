import { useState, useEffect } from 'react'
import { Folder } from 'lucide-react'
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
import { WebsiteGroup } from '@/types/website'
import { useI18n } from '@/i18n/useI18n'

interface AddGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddGroup: (group: Omit<WebsiteGroup, 'id' | 'createdAt' | 'updatedAt'>) => void
  groupType?: 'primary' | 'secondary'
}

export function AddGroupDialog({
  open,
  onOpenChange,
  onAddGroup,
  groupType = 'secondary'
}: AddGroupDialogProps): JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | undefined>()

  const resetForm = (): void => {
    setName('')
    setError(undefined)
  }

  useEffect(() => {
    if (open) {
      setTimeout(resetForm, 0)
    }
  }, [open])

  const handleSubmit = (): void => {
    if (!name.trim()) {
      setError(t('groupNameRequired'))
      return
    }

    onAddGroup({
      name: name.trim(),
      category: groupType === 'primary' ? undefined : undefined,
      expanded: true,
      websites: []
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {groupType === 'primary' ? t('addGroup.primary') : t('addGroup.secondary')}
          </DialogTitle>
          <DialogDescription>
            {groupType === 'primary' ? t('addGroup.primaryDesc') : t('addGroup.secondaryDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="group-name">
              {t('groupName')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder={
                groupType === 'primary'
                  ? t('groupNamePlaceholder.primary')
                  : t('groupNamePlaceholder.secondary')
              }
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
