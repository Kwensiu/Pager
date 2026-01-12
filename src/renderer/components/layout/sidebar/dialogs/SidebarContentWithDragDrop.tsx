import React from 'react'
import { SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/ui/sidebar'
import { Plus } from 'lucide-react'
import { PrimaryGroup, Website, SecondaryGroup } from '@/types/website'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/ui/context-menu'

// 拖拽相关导入
import { DragDropProvider, SortableContainer } from '../dnd/contexts/DragDropContext'
import { SortableSecondaryGroup } from '../dnd/components/SortableSecondaryGroup'
import { SortableWebsiteItem } from '../dnd/components/SortableWebsiteItem'
import { SortableEmptyPlaceholder } from '../dnd/components/SortableEmptyPlaceholder'
import { getSortedSecondaryGroups } from '../dnd/utils/migrationUtils'
import { DragEndResult } from '../dnd/types/dnd.types'

export interface SidebarContentWithDragDropProps {
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
  // 新增的拖拽相关props
  primaryGroups: PrimaryGroup[]
  onGroupsUpdate: (groups: PrimaryGroup[]) => void
  onSecondaryGroupReorder?: (primaryGroupId: string, groups: SecondaryGroup[]) => void
  onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
}

// 内部组件，使用拖拽上下文
const DragDropSidebarContentInner: React.FC<SidebarContentWithDragDropProps> = ({
  activePrimaryGroup,
  toggleSecondaryGroup,
  handleWebsiteClick,
  handleAddWebsite,
  handleEditSecondaryGroup,
  handleDeleteSecondaryGroup,
  contextMenuSecondaryGroup,
  activeWebsiteId = null,
  handleWebsiteUpdate,
  handleDeleteWebsite
}) => {
  if (!activePrimaryGroup) {
    return null
  }

  // 获取排序后的二级分组
  const sortedSecondaryGroups = getSortedSecondaryGroups(activePrimaryGroup.secondaryGroups)
  const secondaryGroupIds = sortedSecondaryGroups.map((g) => g.id)

  // 获取一级分类下的网站
  const primaryGroupWebsites = activePrimaryGroup.websites || []
  const primaryGroupWebsiteIds = primaryGroupWebsites.map((w) => w.id)
  // 当没有网站时，添加一个虚拟ID以确保SortableContainer能识别拖拽目标
  const effectivePrimaryGroupWebsiteIds =
    primaryGroupWebsiteIds.length > 0 ? primaryGroupWebsiteIds : ['primary-group-empty']

  return (
    <SidebarGroup key={`primary-group-${activePrimaryGroup.id}`} className="pb-0">
      <SidebarMenu>
        {/* 一级分类下的网站列表 - 即使为空也渲染，作为拖拽目标 */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">未分组网站</div>
          <div className="space-y-1">
            <SortableContainer items={effectivePrimaryGroupWebsiteIds}>
              {primaryGroupWebsites.map((website) => (
                <div key={`primary-website-${website.id}`} className="ml-2">
                  <SortableWebsiteItem
                    website={website}
                    primaryGroupId={activePrimaryGroup.id}
                    active={activeWebsiteId === website.id}
                    onClick={() => handleWebsiteClick(website)}
                    onEdit={() => handleWebsiteUpdate(website)}
                    onDelete={() => handleDeleteWebsite(website.id)}
                    className="ml-0"
                  />
                </div>
              ))}
              {/* 当没有网站时，渲染一个可排序的空占位符作为拖拽目标 */}
              {primaryGroupWebsites.length === 0 && (
                <div className="">
                  <SortableEmptyPlaceholder
                    id="primary-group-empty"
                    primaryGroupId={activePrimaryGroup.id}
                    onClick={() => handleAddWebsite(activePrimaryGroup.id, false)}
                  />
                </div>
              )}
            </SortableContainer>
          </div>
        </div>

        <SortableContainer items={secondaryGroupIds}>
          {sortedSecondaryGroups.map((secondaryGroup) => (
            <div key={`menu-item-${secondaryGroup.id}`} className="relative mb-2">
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div>
                    {/* 使用可排序的二级分组组件 */}
                    <SortableSecondaryGroup
                      secondaryGroup={secondaryGroup}
                      active={contextMenuSecondaryGroup === secondaryGroup.id}
                      onClick={() => toggleSecondaryGroup(secondaryGroup.id)}
                      onWebsiteClick={handleWebsiteClick}
                      onWebsiteEdit={handleWebsiteUpdate}
                      onWebsiteDelete={handleDeleteWebsite}
                      onAddWebsite={() => handleAddWebsite(secondaryGroup.id, true)}
                      activeWebsiteId={activeWebsiteId}
                    />
                  </div>
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
            </div>
          ))}
        </SortableContainer>

        {/* 添加网站到主要分组的按钮 */}
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

// 主组件，提供拖拽上下文
const SidebarContentWithDragDrop: React.FC<SidebarContentWithDragDropProps> = (props) => {
  const { activePrimaryGroup, primaryGroups, onGroupsUpdate, onSecondaryGroupReorder } = props

  const handleDragEnd = (result: DragEndResult): void => {
    // 这里需要实际处理拖拽结果
    if (!result || !activePrimaryGroup) {
      return
    }

    const { activeId, overId, type } = result

    if (!overId || activeId === overId) {
      return
    }

    if (type === 'secondaryGroup') {
      // 处理二级分组拖拽
      const targetIndex = activePrimaryGroup.secondaryGroups.findIndex((g) => g.id === overId)
      if (targetIndex === -1) {
        return
      }

      // 重新排序二级分组
      const updatedSecondaryGroups = [...activePrimaryGroup.secondaryGroups]
      const sourceIndex = updatedSecondaryGroups.findIndex((g) => g.id === activeId)
      if (sourceIndex === -1) {
        return
      }

      // 移动分组
      const [movedGroup] = updatedSecondaryGroups.splice(sourceIndex, 1)
      updatedSecondaryGroups.splice(targetIndex, 0, movedGroup)

      // 更新order字段
      const reorderedGroups = updatedSecondaryGroups.map((group, index) => ({
        ...group,
        order: index
      }))

      // 更新主要分组
      const updatedPrimaryGroups = primaryGroups.map((pg) =>
        pg.id === activePrimaryGroup.id ? { ...pg, secondaryGroups: reorderedGroups } : pg
      )

      // 调用回调更新数据
      onGroupsUpdate(updatedPrimaryGroups)

      if (onSecondaryGroupReorder) {
        onSecondaryGroupReorder(activePrimaryGroup.id, reorderedGroups)
      }
    } else if (type === 'website') {
      // 处理网站拖拽
      // 找到网站所属的分组（源分组）
      let sourceSecondaryGroup: SecondaryGroup | null = null
      let isFromPrimaryGroup = false

      // 首先检查是否来自一级分类
      if (activePrimaryGroup.websites?.some((w) => w.id === activeId)) {
        isFromPrimaryGroup = true
      } else {
        // 如果不是来自一级分类，查找二级分组
        for (const secondaryGroup of activePrimaryGroup.secondaryGroups) {
          if (secondaryGroup.websites.some((w) => w.id === activeId)) {
            sourceSecondaryGroup = secondaryGroup
            break
          }
        }
      }

      if (!sourceSecondaryGroup && !isFromPrimaryGroup) {
        return
      }

      // 查找目标位置
      // 情况1：拖拽到一级分类的网站列表中（overId是一级分类下的网站ID）
      let targetIsPrimaryGroup = false
      let targetPrimaryGroupWebsiteIndex = -1

      if (activePrimaryGroup.websites?.some((w) => w.id === overId)) {
        targetIsPrimaryGroup = true
        targetPrimaryGroupWebsiteIndex = activePrimaryGroup.websites.findIndex(
          (w) => w.id === overId
        )
      }

      // 情况1b：拖拽到空的一级分类区域（当一级分类没有网站时）
      if (!targetIsPrimaryGroup && overId === 'primary-group-empty') {
        targetIsPrimaryGroup = true
        targetPrimaryGroupWebsiteIndex = 0 // 拖拽到空列表的第一个位置
      }

      // 情况2：拖拽到二级分组
      let targetSecondaryGroup: SecondaryGroup | null = null
      let targetWebsiteIndex = -1

      if (!targetIsPrimaryGroup) {
        for (const secondaryGroup of activePrimaryGroup.secondaryGroups) {
          // 情况2a：overId是网站ID，且该网站在这个分组中
          const websiteIndex = secondaryGroup.websites.findIndex((w) => w.id === overId)
          if (websiteIndex !== -1) {
            targetSecondaryGroup = secondaryGroup
            targetWebsiteIndex = websiteIndex
            break
          }
          // 情况2b：overId是分组ID本身（当拖拽到空分组时）
          if (secondaryGroup.id === overId) {
            targetSecondaryGroup = secondaryGroup
            targetWebsiteIndex = secondaryGroup.websites.length // 拖拽到分组末尾
            break
          }
        }
      }

      // 如果还没找到目标，尝试其他方式
      if (!targetIsPrimaryGroup && !targetSecondaryGroup) {
        // 可能是拖拽到分组之间的空隙，这里暂时返回
        return
      }

      // 获取要移动的网站
      let movedWebsite: Website | null = null

      if (isFromPrimaryGroup) {
        // 从一级分类中移除网站
        const sourceIndex = activePrimaryGroup.websites.findIndex((w) => w.id === activeId)
        if (sourceIndex === -1) return

        const sourceWebsites = [...activePrimaryGroup.websites]
        ;[movedWebsite] = sourceWebsites.splice(sourceIndex, 1)

        // 更新一级分类的网站列表
        const updatedPrimaryWebsites = sourceWebsites.map((website, index) => ({
          ...website,
          order: index
        }))

        // 更新主要分组
        const updatedPrimaryGroups = primaryGroups.map((pg) =>
          pg.id === activePrimaryGroup.id ? { ...pg, websites: updatedPrimaryWebsites } : pg
        )

        // 临时保存更新后的分组（稍后根据目标位置再更新）
        let finalPrimaryGroups = updatedPrimaryGroups

        // 根据目标位置处理
        if (targetIsPrimaryGroup) {
          // 在一级分类内移动
          const targetWebsites = [...updatedPrimaryWebsites]
          let targetIndex = targetPrimaryGroupWebsiteIndex

          // 调整目标索引（因为已经从源位置移除了网站）
          if (sourceIndex < targetIndex) {
            targetIndex--
          }

          targetWebsites.splice(targetIndex, 0, movedWebsite!)

          const reorderedWebsites = targetWebsites.map((website, index) => ({
            ...website,
            order: index
          }))

          finalPrimaryGroups = primaryGroups.map((pg) =>
            pg.id === activePrimaryGroup.id ? { ...pg, websites: reorderedWebsites } : pg
          )
        } else if (targetSecondaryGroup) {
          // 从一级分类拖拽到二级分组
          const targetWebsites = [...targetSecondaryGroup.websites]
          targetWebsites.splice(targetWebsiteIndex, 0, movedWebsite!)

          const updatedTargetWebsites = targetWebsites.map((website, index) => ({
            ...website,
            order: index
          }))

          finalPrimaryGroups = primaryGroups.map((pg) => {
            if (pg.id === activePrimaryGroup.id) {
              const updatedSecondaryGroups = pg.secondaryGroups.map((sg) =>
                sg.id === targetSecondaryGroup!.id ? { ...sg, websites: updatedTargetWebsites } : sg
              )
              return {
                ...pg,
                websites: updatedPrimaryWebsites,
                secondaryGroups: updatedSecondaryGroups
              }
            }
            return pg
          })
        }

        // 调用回调更新数据
        onGroupsUpdate(finalPrimaryGroups)
      } else if (sourceSecondaryGroup) {
        // 从二级分组中移除网站
        const sourceIndex = sourceSecondaryGroup.websites.findIndex((w) => w.id === activeId)
        if (sourceIndex === -1) return

        const sourceWebsites = [...sourceSecondaryGroup.websites]
        ;[movedWebsite] = sourceWebsites.splice(sourceIndex, 1)

        const updatedSourceWebsites = sourceWebsites.map((website, index) => ({
          ...website,
          order: index
        }))

        // 根据目标位置处理
        if (targetIsPrimaryGroup) {
          // 从二级分组拖拽到一级分类
          const targetWebsites = [...(activePrimaryGroup.websites || [])]
          targetWebsites.splice(targetPrimaryGroupWebsiteIndex, 0, movedWebsite!)

          const updatedTargetWebsites = targetWebsites.map((website, index) => ({
            ...website,
            order: index
          }))

          // 更新主要分组
          const updatedPrimaryGroups = primaryGroups.map((pg) => {
            if (pg.id === activePrimaryGroup.id) {
              const updatedSecondaryGroups = pg.secondaryGroups.map((sg) =>
                sg.id === sourceSecondaryGroup!.id ? { ...sg, websites: updatedSourceWebsites } : sg
              )
              return {
                ...pg,
                websites: updatedTargetWebsites,
                secondaryGroups: updatedSecondaryGroups
              }
            }
            return pg
          })

          // 调用回调更新数据
          onGroupsUpdate(updatedPrimaryGroups)
        } else if (targetSecondaryGroup) {
          // 在二级分组之间移动
          if (sourceSecondaryGroup.id === targetSecondaryGroup.id) {
            // 同一个分组内的拖拽
            const targetIndex = targetWebsiteIndex

            // 调整目标索引（因为已经从源位置移除了网站）
            let adjustedTargetIndex = targetIndex
            if (sourceIndex < targetIndex) {
              adjustedTargetIndex--
            }

            const targetWebsites = [...updatedSourceWebsites]
            targetWebsites.splice(adjustedTargetIndex, 0, movedWebsite!)

            const reorderedWebsites = targetWebsites.map((website, index) => ({
              ...website,
              order: index
            }))

            // 更新二级分组
            const updatedSecondaryGroups = activePrimaryGroup.secondaryGroups.map((sg) =>
              sg.id === sourceSecondaryGroup!.id ? { ...sg, websites: reorderedWebsites } : sg
            )

            // 更新主要分组
            const updatedPrimaryGroups = primaryGroups.map((pg) =>
              pg.id === activePrimaryGroup.id
                ? { ...pg, secondaryGroups: updatedSecondaryGroups }
                : pg
            )

            // 调用回调更新数据
            onGroupsUpdate(updatedPrimaryGroups)

            if (props.onWebsiteReorder) {
              props.onWebsiteReorder(sourceSecondaryGroup.id, reorderedWebsites)
            }
          } else {
            // 跨分组拖拽
            const targetWebsites = [...targetSecondaryGroup.websites]
            targetWebsites.splice(targetWebsiteIndex, 0, movedWebsite!)

            const updatedTargetWebsites = targetWebsites.map((website, index) => ({
              ...website,
              order: index
            }))

            // 更新两个分组的网站列表
            const updatedSecondaryGroups = activePrimaryGroup.secondaryGroups.map((sg) => {
              if (sg.id === sourceSecondaryGroup.id) {
                return { ...sg, websites: updatedSourceWebsites }
              } else if (sg.id === targetSecondaryGroup!.id) {
                return { ...sg, websites: updatedTargetWebsites }
              }
              return sg
            })

            // 更新主要分组
            const updatedPrimaryGroups = primaryGroups.map((pg) =>
              pg.id === activePrimaryGroup.id
                ? { ...pg, secondaryGroups: updatedSecondaryGroups }
                : pg
            )

            // 调用回调更新数据
            onGroupsUpdate(updatedPrimaryGroups)

            // 触发网站重新排序回调
            if (props.onWebsiteReorder) {
              props.onWebsiteReorder(sourceSecondaryGroup.id, updatedSourceWebsites)
              props.onWebsiteReorder(targetSecondaryGroup.id, updatedTargetWebsites)
            }
          }
        }
      }
    }
  }

  const handleDragStart = (): void => {
    // 拖拽开始处理
  }

  return (
    <DragDropProvider
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      config={{
        animationDuration: 200,
        dragDelay: 0,
        dropAnimationDuration: 250
      }}
    >
      <DragDropSidebarContentInner {...props} />
    </DragDropProvider>
  )
}

export default SidebarContentWithDragDrop
