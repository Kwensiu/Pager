import React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/ui/button'
import { SidebarHeader as UISidebarHeader, SidebarTrigger } from '@/ui/sidebar'
import { useSidebar } from '@/ui/sidebar.types'
import { Folder, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PrimaryGroup } from '@/types/website'
import { useI18n } from '@/core/i18n/useI18n'

export interface SidebarHeaderProps {
  primaryGroups: PrimaryGroup[]
  activePrimaryGroup: PrimaryGroup | null
  onSwitchPrimaryGroup: (group: PrimaryGroup) => void
  onAddPrimaryGroup: () => void
}

const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  primaryGroups,
  activePrimaryGroup,
  onSwitchPrimaryGroup,
  onAddPrimaryGroup
}) => {
  const { t } = useI18n()
  const { state } = useSidebar()

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
                    {primaryGroup.name}
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
