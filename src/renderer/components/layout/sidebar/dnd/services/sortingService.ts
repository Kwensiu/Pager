import { PrimaryGroup, SecondaryGroup, Website } from '@/types/website'
import { DragEndResult } from '../types/dnd.types'
import { updateSecondaryGroupOrder, updateWebsiteOrder } from '../utils/migrationUtils'

/**
 * 排序服务类，负责处理所有与拖拽排序相关的业务逻辑
 */
export class SortingService {
  /**
   * 处理二级分组拖拽
   */
  static handleSecondaryGroupDrag(
    result: DragEndResult,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onSecondaryGroupReorder?: (primaryGroupId: string, groups: SecondaryGroup[]) => void
    }
  ): void {
    const { activeId, overId } = result

    if (!overId || activeId === overId) {
      return
    }

    // 找到目标索引
    const sortedGroups = [...activePrimaryGroup.secondaryGroups].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0
      const orderB = b.order !== undefined ? b.order : 0
      return orderA - orderB
    })

    // 查找目标索引，overId可能是任何元素的ID，我们需要找到它对应的二级分组
    let targetIndex = sortedGroups.findIndex((g) => g.id === overId)

    // 如果没找到直接匹配的分组ID，尝试通过其他方式确定位置
    if (targetIndex === -1) {
      // 如果overId不是分组ID，我们可以根据插入位置来确定目标索引
      const insertPosition = result.insertPosition || 'below'

      // 找到当前拖拽分组的位置
      const activeIndex = sortedGroups.findIndex((g) => g.id === activeId)
      if (activeIndex !== -1) {
        // 如果是向下插入，目标索引应该是当前位置+1
        // 如果是向上插入，目标索引应该是当前位置
        targetIndex = insertPosition === 'below' ? activeIndex + 1 : activeIndex

        // 确保目标索引在有效范围内
        targetIndex = Math.max(0, Math.min(targetIndex, sortedGroups.length))
      } else {
        return
      }
    }

    // 更新二级分组顺序
    const reorderedGroups = updateSecondaryGroupOrder(
      activePrimaryGroup.secondaryGroups,
      activeId,
      targetIndex
    )

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) =>
      pg.id === activePrimaryGroup.id ? { ...pg, secondaryGroups: reorderedGroups } : pg
    )

    // 调用回调更新数据
    callbacks.onGroupsUpdate(updatedPrimaryGroups)

    if (callbacks.onSecondaryGroupReorder) {
      callbacks.onSecondaryGroupReorder(activePrimaryGroup.id, reorderedGroups)
    }
  }

  /**
   * 处理网站拖拽
   */
  static handleWebsiteDrag(
    result: DragEndResult,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const { activeId, overId } = result

    if (!overId || activeId === overId) {
      return
    }

    // 查找源分组和目标位置
    const { sourceGroup, targetGroup, targetIndex } = this.findSourceAndTarget(
      activeId,
      overId,
      activePrimaryGroup
    )

    if (!sourceGroup || targetIndex === -1) {
      return
    }

    // 处理不同情况的网站拖拽
    if (sourceGroup.type === 'primary' && targetGroup?.type === 'primary') {
      // 一级分类内网站拖拽
      this.handlePrimaryGroupWebsiteDrag(
        activeId,
        targetIndex,
        activePrimaryGroup,
        primaryGroups,
        callbacks
      )
    } else if (sourceGroup.type === 'primary' && targetGroup?.type === 'secondary') {
      // 从一级分类拖拽到二级分组
      this.handlePrimaryToSecondaryDrag(
        activeId,
        targetGroup.group as SecondaryGroup,
        targetIndex,
        activePrimaryGroup,
        primaryGroups,
        callbacks
      )
    } else if (sourceGroup.type === 'secondary' && targetGroup?.type === 'primary') {
      // 从二级分组拖拽到一级分类
      this.handleSecondaryToPrimaryDrag(
        activeId,
        sourceGroup.group as SecondaryGroup,
        targetIndex,
        activePrimaryGroup,
        primaryGroups,
        callbacks
      )
    } else if (
      sourceGroup.type === 'secondary' &&
      targetGroup?.type === 'secondary' &&
      sourceGroup.group.id === targetGroup.group.id
    ) {
      // 同一分组内网站拖拽
      this.handleSameSecondaryGroupDrag(
        activeId,
        targetIndex,
        sourceGroup.group as SecondaryGroup,
        activePrimaryGroup,
        primaryGroups,
        callbacks
      )
    } else if (
      sourceGroup.type === 'secondary' &&
      targetGroup?.type === 'secondary' &&
      sourceGroup.group.id !== targetGroup.group.id
    ) {
      // 不同分组间网站拖拽
      this.handleDifferentSecondaryGroupDrag(
        activeId,
        targetIndex,
        sourceGroup.group as SecondaryGroup,
        targetGroup.group as SecondaryGroup,
        activePrimaryGroup,
        primaryGroups,
        callbacks
      )
    }
  }

  /**
   * 查找源分组和目标位置
   */
  private static findSourceAndTarget(
    activeId: string,
    overId: string,
    activePrimaryGroup: PrimaryGroup
  ): {
    sourceGroup: { type: 'primary' | 'secondary'; group: PrimaryGroup | SecondaryGroup } | null
    targetGroup: { type: 'primary' | 'secondary'; group: PrimaryGroup | SecondaryGroup } | null
    targetIndex: number
  } {
    // 查找源分组
    let sourceGroup: {
      type: 'primary' | 'secondary'
      group: PrimaryGroup | SecondaryGroup
    } | null = null

    // 检查是否来自一级分类
    if (activePrimaryGroup.websites?.some((w) => w.id === activeId)) {
      sourceGroup = { type: 'primary', group: activePrimaryGroup }
    } else {
      // 检查是否来自二级分组
      for (const secondaryGroup of activePrimaryGroup.secondaryGroups) {
        if (secondaryGroup.websites.some((w) => w.id === activeId)) {
          sourceGroup = { type: 'secondary', group: secondaryGroup }
          break
        }
      }
    }

    // 查找目标位置
    let targetGroup: {
      type: 'primary' | 'secondary'
      group: PrimaryGroup | SecondaryGroup
    } | null = null
    let targetIndex = -1

    // 检查是否拖拽到一级分类
    if (activePrimaryGroup.websites?.some((w) => w.id === overId)) {
      targetGroup = { type: 'primary', group: activePrimaryGroup }
      targetIndex = activePrimaryGroup.websites.findIndex((w) => w.id === overId)
    } else if (overId === 'primary-group-empty') {
      // 拖拽到空的一级分类
      targetGroup = { type: 'primary', group: activePrimaryGroup }
      targetIndex = 0
    } else {
      // 检查是否拖拽到二级分组
      for (const secondaryGroup of activePrimaryGroup.secondaryGroups) {
        const websiteIndex = secondaryGroup.websites.findIndex((w) => w.id === overId)
        if (websiteIndex !== -1) {
          targetGroup = { type: 'secondary', group: secondaryGroup }
          targetIndex = websiteIndex
          break
        }
        if (secondaryGroup.id === overId) {
          targetGroup = { type: 'secondary', group: secondaryGroup }
          targetIndex = secondaryGroup.websites.length
          break
        }
      }
    }

    return { sourceGroup, targetGroup, targetIndex }
  }

  /**
   * 处理一级分类内网站拖拽
   */
  private static handlePrimaryGroupWebsiteDrag(
    activeId: string,
    targetIndex: number,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const primaryGroupWebsites = activePrimaryGroup.websites ?? []
    const sourceIndex = primaryGroupWebsites.findIndex((w) => w.id === activeId)
    if (sourceIndex === -1) return

    // 使用 updateWebsiteOrder 函数来处理网站排序
    const reorderedWebsites = updateWebsiteOrder(primaryGroupWebsites, activeId, targetIndex)

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) =>
      pg.id === activePrimaryGroup.id ? { ...pg, websites: reorderedWebsites } : pg
    )

    // 调用回调更新数据
    callbacks.onGroupsUpdate(updatedPrimaryGroups)
  }

  /**
   * 处理从一级分类拖拽到二级分组
   */
  private static handlePrimaryToSecondaryDrag(
    activeId: string,
    targetSecondaryGroup: SecondaryGroup,
    targetIndex: number,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const primaryGroupWebsites = activePrimaryGroup.websites ?? []
    const sourceIndex = primaryGroupWebsites.findIndex((w) => w.id === activeId)
    if (sourceIndex === -1) return

    // 从一级分类中移除网站
    const sourceWebsites = [...primaryGroupWebsites]
    const [movedWebsite] = sourceWebsites.splice(sourceIndex, 1)

    const updatedPrimaryWebsites = sourceWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 添加到二级分组并重新排序
    const targetWebsites = [...targetSecondaryGroup.websites]
    targetWebsites.splice(targetIndex, 0, movedWebsite)
    const updatedTargetWebsites = targetWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) => {
      if (pg.id === activePrimaryGroup.id) {
        const updatedSecondaryGroups = pg.secondaryGroups.map((sg) =>
          sg.id === targetSecondaryGroup.id ? { ...sg, websites: updatedTargetWebsites } : sg
        )
        return {
          ...pg,
          websites: updatedPrimaryWebsites,
          secondaryGroups: updatedSecondaryGroups
        }
      }
      return pg
    })

    // 调用回调更新数据
    callbacks.onGroupsUpdate(updatedPrimaryGroups)
  }

  /**
   * 处理从二级分组拖拽到一级分类
   */
  private static handleSecondaryToPrimaryDrag(
    activeId: string,
    sourceSecondaryGroup: SecondaryGroup,
    targetIndex: number,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const sourceIndex = sourceSecondaryGroup.websites.findIndex((w) => w.id === activeId)
    if (sourceIndex === -1) return

    // 从二级分组中移除网站
    const sourceWebsites = [...sourceSecondaryGroup.websites]
    const [movedWebsite] = sourceWebsites.splice(sourceIndex, 1)

    const updatedSourceWebsites = sourceWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 添加到一级分类
    const targetWebsites = [...(activePrimaryGroup.websites || [])]
    targetWebsites.splice(targetIndex, 0, movedWebsite)
    const updatedTargetWebsites = targetWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) => {
      if (pg.id === activePrimaryGroup.id) {
        const updatedSecondaryGroups = pg.secondaryGroups.map((sg) =>
          sg.id === sourceSecondaryGroup.id ? { ...sg, websites: updatedSourceWebsites } : sg
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
    callbacks.onGroupsUpdate(updatedPrimaryGroups)
  }

  /**
   * 处理同一二级分组内网站拖拽
   */
  private static handleSameSecondaryGroupDrag(
    activeId: string,
    targetIndex: number,
    secondaryGroup: SecondaryGroup,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const sourceIndex = secondaryGroup.websites.findIndex((w) => w.id === activeId)
    if (sourceIndex === -1) return

    // 使用 updateWebsiteOrder 函数来处理网站排序
    const reorderedWebsites = updateWebsiteOrder(secondaryGroup.websites, activeId, targetIndex)

    // 更新二级分组
    const updatedSecondaryGroups = activePrimaryGroup.secondaryGroups.map((sg) =>
      sg.id === secondaryGroup.id ? { ...sg, websites: reorderedWebsites } : sg
    )

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) =>
      pg.id === activePrimaryGroup.id ? { ...pg, secondaryGroups: updatedSecondaryGroups } : pg
    )

    // 调用回调更新数据
    callbacks.onGroupsUpdate(updatedPrimaryGroups)

    if (callbacks.onWebsiteReorder) {
      callbacks.onWebsiteReorder(secondaryGroup.id, reorderedWebsites)
    }
  }

  /**
   * 处理不同二级分组间网站拖拽
   */
  private static handleDifferentSecondaryGroupDrag(
    activeId: string,
    targetIndex: number,
    sourceSecondaryGroup: SecondaryGroup,
    targetSecondaryGroup: SecondaryGroup,
    activePrimaryGroup: PrimaryGroup,
    primaryGroups: PrimaryGroup[],
    callbacks: {
      onGroupsUpdate: (groups: PrimaryGroup[]) => void
      onWebsiteReorder?: (secondaryGroupId: string, websites: Website[]) => void
    }
  ): void {
    const sourceIndex = sourceSecondaryGroup.websites.findIndex((w) => w.id === activeId)
    if (sourceIndex === -1) return

    // 从源分组中移除网站
    const sourceWebsites = [...sourceSecondaryGroup.websites]
    const [movedWebsite] = sourceWebsites.splice(sourceIndex, 1)

    const updatedSourceWebsites = sourceWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 添加到目标分组
    const targetWebsites = [...targetSecondaryGroup.websites]
    targetWebsites.splice(targetIndex, 0, movedWebsite)
    const updatedTargetWebsites = targetWebsites.map((website, index) => ({
      ...website,
      order: index * 100,
      updatedAt: Date.now()
    }))

    // 更新两个分组的网站列表
    const updatedSecondaryGroups = activePrimaryGroup.secondaryGroups.map((sg) => {
      if (sg.id === sourceSecondaryGroup.id) {
        return { ...sg, websites: updatedSourceWebsites }
      } else if (sg.id === targetSecondaryGroup.id) {
        return { ...sg, websites: updatedTargetWebsites }
      }
      return sg
    })

    // 更新主要分组
    const updatedPrimaryGroups = primaryGroups.map((pg) =>
      pg.id === activePrimaryGroup.id ? { ...pg, secondaryGroups: updatedSecondaryGroups } : pg
    )

    // 调用回调更新数据
    callbacks.onGroupsUpdate(updatedPrimaryGroups)

    // 触发网站重新排序回调
    if (callbacks.onWebsiteReorder) {
      callbacks.onWebsiteReorder(sourceSecondaryGroup.id, updatedSourceWebsites)
      callbacks.onWebsiteReorder(targetSecondaryGroup.id, updatedTargetWebsites)
    }
  }
}
