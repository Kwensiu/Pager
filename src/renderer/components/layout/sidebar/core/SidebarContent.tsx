import React from 'react'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton
} from '@/ui/sidebar'
import { Folder, Plus } from 'lucide-react'
import { Favicon } from '@/components/features/Favicon'
import { PrimaryGroup, Website, SecondaryGroup } from '@/types/website'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/ui/context-menu'

export interface SidebarContentProps {
  activePrimaryGroup: PrimaryGroup | null
  toggleSecondaryGroup: (secondaryGroupId: string) => void
  handleWebsiteClick: (website: Website) => void
  handleAddWebsite: (groupId: string, isSecondaryGroup: boolean) => void
  handleWebsiteUpdate: (website: Website) => void
  handleDeleteWebsite: (websiteId: string) => void
  handleEditSecondaryGroup: (secondaryGroup: SecondaryGroup) => void
  handleDeleteSecondaryGroup: (secondaryGroupId: string) => void
  contextMenuSecondaryGroup: string | null
  activeWebsiteId?: string | null
}

const SidebarContent: React.FC<SidebarContentProps> = ({
  activePrimaryGroup,
  toggleSecondaryGroup,
  handleWebsiteClick,
  handleAddWebsite,
  handleWebsiteUpdate,
  handleDeleteWebsite,
  handleEditSecondaryGroup,
  handleDeleteSecondaryGroup,
  contextMenuSecondaryGroup,
  activeWebsiteId = null
}) => {
  if (!activePrimaryGroup) {
    return null
  }

  return (
    <SidebarGroup key={`primary-group-${activePrimaryGroup.id}`} className="pb-0">
      <SidebarMenu>
        {activePrimaryGroup.secondaryGroups.map((secondaryGroup) => (
          <div key={`menu-item-${secondaryGroup.id}`} className="relative">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    data-secondary-group-id={secondaryGroup.id}
                    onClick={() => {
                      toggleSecondaryGroup(secondaryGroup.id)
                    }}
                    className={`${contextMenuSecondaryGroup === secondaryGroup.id ? 'bg-sidebar-accent' : ''}`}
                  >
                    <Folder className="mr-2 h-4 w-4" />
                    <span>{secondaryGroup.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => handleEditSecondaryGroup(secondaryGroup)}>
                  修改
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-red-600 focus:bg-red-100 dark:focus:bg-red-900"
                  onClick={() => handleDeleteSecondaryGroup(secondaryGroup.id)}
                >
                  删除
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {secondaryGroup.expanded !== false && (
              <SidebarMenuSub key={`menu-sub-${secondaryGroup.id}-${secondaryGroup.expanded}`}>
                {(secondaryGroup.websites || []).map((website) => (
                  <div key={website.id} className="relative">
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            data-website-id={website.id}
                            onClick={() => handleWebsiteClick(website)}
                            className={`${activeWebsiteId === website.id ? 'bg-sidebar-accent' : ''}
                              hover:bg-secondary cursor-pointer`}
                            style={{ userSelect: 'none' }}
                          >
                            <Favicon url={website.url} className="mr-2 h-6 w-6" />
                            <span>{website.name}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => handleWebsiteUpdate(website)}>
                          修改
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="text-red-600 focus:bg-red-100 dark:focus:bg-red-900"
                          onClick={() => handleDeleteWebsite(website.id)}
                        >
                          删除
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  </div>
                ))}

                <SidebarMenuSubItem>
                  <SidebarMenuSubButton
                    onClick={(e) => {
                      e.stopPropagation()
                      handleAddWebsite(secondaryGroup.id, true)
                    }}
                  >
                    <Plus className="mr-2 h-3 w-3" />
                    <span>添加网站</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            )}
          </div>
        ))}

        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={(e) => {
              e.stopPropagation()
              handleAddWebsite(activePrimaryGroup.id, false)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>为此分类添加网站</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

export default SidebarContent
