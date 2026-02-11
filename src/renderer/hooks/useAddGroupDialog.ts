import { PrimaryGroup, SecondaryGroup } from '@/types/website'

interface UseAddGroupDialogProps {
  dialogMode: 'primary' | 'secondary' | 'website'
  selectedGroupId: string | null
  primaryGroups: PrimaryGroup[]
  onGroupsUpdate: (updatedGroups: PrimaryGroup[]) => void
}

export const useAddGroupDialog = ({
  dialogMode,
  selectedGroupId,
  primaryGroups,
  onGroupsUpdate
}: UseAddGroupDialogProps): {
  handleAddGroup: (
    groupData: Omit<PrimaryGroup | SecondaryGroup, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  ) => void
} => {
  const handleAddGroup = (
    groupData: Omit<PrimaryGroup | SecondaryGroup, 'id' | 'createdAt' | 'updatedAt' | 'order'>
  ): void => {
    if (dialogMode === 'secondary' && selectedGroupId) {
      // 添加二级分组到指定的一级分组
      const newSecondaryGroup: SecondaryGroup = {
        ...groupData,
        id: `secondary-${Date.now()}`,
        primaryGroupId: selectedGroupId,
        websites: [],
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expanded: false
      }

      // 更新primaryGroups
      const updatedPrimaryGroups = primaryGroups.map((pg) => {
        if (pg.id === selectedGroupId) {
          return {
            ...pg,
            secondaryGroups: [...pg.secondaryGroups, newSecondaryGroup]
          }
        }
        return pg
      })

      // 使用onGroupsUpdate函数更新状态和存储
      onGroupsUpdate(updatedPrimaryGroups)
    } else if (dialogMode === 'primary') {
      // 添加一级分组
      const newPrimaryGroup: PrimaryGroup = {
        ...groupData,
        id: `primary-${Date.now()}`,
        secondaryGroups: [],
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const updatedPrimaryGroups = [...primaryGroups, newPrimaryGroup]
      onGroupsUpdate(updatedPrimaryGroups)
    }
  }

  return { handleAddGroup }
}
