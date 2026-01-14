import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/ui/button'
import { SidebarHeader as UISidebarHeader, SidebarTrigger } from '@/ui/sidebar'
import { useSidebar } from '@/ui/sidebar.types'
import { Folder, Plus, PanelLeftClose, PanelLeftOpen, Pencil, Trash2 } from 'lucide-react'
import { PrimaryGroup } from '@/types/website'
import { useI18n } from '@/core/i18n/useI18n'

export interface SidebarHeaderProps {
  primaryGroups: PrimaryGroup[]
  activePrimaryGroup: PrimaryGroup | null
  onSwitchPrimaryGroup: (group: PrimaryGroup) => void
  onAddPrimaryGroup: () => void
  onEditPrimaryGroup?: (group: PrimaryGroup) => void
  onDeletePrimaryGroup?: (groupId: string) => void
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  primaryGroups,
  activePrimaryGroup,
  onSwitchPrimaryGroup,
  onAddPrimaryGroup,
  onEditPrimaryGroup,
  onDeletePrimaryGroup
}) => {
  const { t } = useI18n()
  const { state } = useSidebar()

  const handleEditClick = (e: React.MouseEvent, group: PrimaryGroup): void => {
    e.stopPropagation()
    e.preventDefault()
    if (onEditPrimaryGroup) {
      onEditPrimaryGroup(group)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, groupId: string): void => {
    e.stopPropagation()
    e.preventDefault()
    if (onDeletePrimaryGroup) {
      onDeletePrimaryGroup(groupId)
    }
  }

  return (
    <UISidebarHeader className="border-b px-1 h-[53px]">
      <div className="flex items-center h-full">
        <SidebarTrigger className="h-9 w-9 shrink-0">
          {state === 'expanded' ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </SidebarTrigger>

        {state === 'expanded' ? (
          <div className="flex-1">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" className="w-full justify-between px-2 py-1.5">
                  <span className="font-semibold">
                    {activePrimaryGroup?.name || t('selectCategory')}
                  </span>
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </Button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Content
                className="z-50 w-[var(--radix-popper-anchor-width)] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                sideOffset={4}
              >
                {primaryGroups.map((primaryGroup) => (
                  <DropdownMenu.Item
                    key={primaryGroup.id}
                    className={`relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
                      activePrimaryGroup?.id === primaryGroup.id ? 'bg-accent' : ''
                    }`}
                    onSelect={() => {
                      onSwitchPrimaryGroup(primaryGroup)
                    }}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span className="flex-1">{primaryGroup.name}</span>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        className="p-1 rounded hover:bg-accent/50 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={(e) => handleEditClick(e, primaryGroup)}
                        title={t('edit')}
                        aria-label={t('edit')}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                        onClick={(e) => handleDeleteClick(e, primaryGroup.id)}
                        title={t('delete')}
                        aria-label={t('delete')}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </DropdownMenu.Item>
                ))}

                <DropdownMenu.Separator className="my-1 h-px bg-muted" />

                <DropdownMenu.Item
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  onSelect={() => onAddPrimaryGroup()}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addCategory')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </div>
        ) : null}
      </div>
    </UISidebarHeader>
  )
}

export default SidebarHeader
