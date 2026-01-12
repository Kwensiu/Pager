import { useState } from 'react'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebsiteGroup as WebsiteGroupType, Website } from '@/types/website'
import { Button } from '@/ui/button'
import { Favicon } from '@/components/features/Favicon'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/ui/context-menu'
import { ConfirmDialog } from '@/components/features/ConfirmDialog'

interface WebsiteGroupProps {
  group: WebsiteGroupType
  onWebsiteClick: (website: Website) => void
  activeWebsiteId?: string | null
  onAddWebsite?: (groupId: string) => void
  onWebsiteUpdate?: (website: Website) => void
  onWebsiteDelete?: (websiteId: string) => void
}

export function WebsiteGroup({
  group,
  onWebsiteClick,
  activeWebsiteId,
  onAddWebsite,
  onWebsiteUpdate,
  onWebsiteDelete
}: WebsiteGroupProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(group.expanded ?? true)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [websiteToDelete, setWebsiteToDelete] = useState<string | null>(null)

  const handleToggle = (): void => {
    setExpanded(!expanded)
  }

  const handleWebsiteItemClick = (website: Website): void => {
    console.log('WebsiteGroup handleWebsiteItemClick:', website.name, website.url)
    if (onWebsiteClick) {
      onWebsiteClick(website)
    }
  }

  const handleEditWebsite = (website: Website): void => {
    onWebsiteUpdate?.(website)
  }

  const handleDeleteWebsite = (websiteId: string): void => {
    setWebsiteToDelete(websiteId)
    setConfirmDialogOpen(true)
  }

  const handleConfirmDelete = (): void => {
    if (websiteToDelete) {
      onWebsiteDelete?.(websiteToDelete)
    }
    setWebsiteToDelete(null)
    setConfirmDialogOpen(false)
  }

  const handleCancelDelete = (): void => {
    setWebsiteToDelete(null)
    setConfirmDialogOpen(false)
  }

  return (
    <div className="group py-2">
      <div
        onClick={handleToggle}
        className="flex w-full items-center justify-between px-3 py-1.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground rounded-md transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <span>{group.name}</span>
        </span>
        {onAddWebsite && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation()
              onAddWebsite(group.id)
            }}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-1 space-y-1 px-2">
          {group.websites.map((website) => (
            <ContextMenu key={website.id}>
              <ContextMenuTrigger asChild>
                <button
                  onClick={() => handleWebsiteItemClick(website)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors',
                    activeWebsiteId === website.id
                      ? 'bg-sidebar-accent text-sidebar-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  )}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                    <Favicon url={website.url} className="h-6 w-6" />
                  </div>
                  <span className="truncate flex-1 text-left">{website.name}</span>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2">
                <ContextMenuItem
                  onClick={() => handleEditWebsite(website)}
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  修改
                </ContextMenuItem>
                <ContextMenuItem
                  className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-red-600 focus:bg-red-100 dark:focus:bg-red-900"
                  onClick={() => handleDeleteWebsite(website.id)}
                >
                  删除
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        title="确认删除"
        description="确定要删除这个网站吗？此操作不可撤销。"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  )
}
