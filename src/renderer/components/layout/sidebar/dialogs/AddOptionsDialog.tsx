import React from 'react'
import { Folder, Globe } from 'lucide-react'
import { Button } from '@/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/ui/dialog'
import { useI18n } from '@/core/i18n/useI18n'

export interface AddOptionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddSecondaryGroup: () => void
  onAddWebsite: () => void
}

const AddOptionsDialog: React.FC<AddOptionsDialogProps> = ({
  open,
  onOpenChange,
  onAddSecondaryGroup,
  onAddWebsite
}) => {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('addOptions.title')}</DialogTitle>
          <DialogDescription>{t('addOptions.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3"
            onClick={() => {
              onAddSecondaryGroup()
              onOpenChange(false)
            }}
          >
            <Folder className="h-8 w-8" />
            <span className="font-medium text-foreground">{t('addOptions.addSecondaryGroup')}</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 flex flex-col items-center gap-3"
            onClick={() => {
              onAddWebsite()
              onOpenChange(false)
            }}
          >
            <Globe className="h-8 w-8" />
            <span className="font-medium text-foreground">{t('addOptions.addWebsite')}</span>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AddOptionsDialog
