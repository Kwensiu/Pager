import React, { memo } from 'react'
import { AddWebsiteDialog } from '@/components/features/AddWebsiteDialog'
import { EditWebsiteDialog } from '@/components/features/EditWebsiteDialog'
import EditSecondaryGroupDialog from './sidebar/dialogs/EditSecondaryGroupDialog'
import { EditPrimaryGroupDialog } from '@/components/features/EditPrimaryGroupDialog'
import { ConfirmDialog } from '@/components/features/ConfirmDialog'
import { Website, PrimaryGroup, SecondaryGroup } from '@/types/website'

interface DialogsContainerProps {
  // 对话框状态
  isWebsiteDialogOpen: boolean
  isEditDialogOpen: boolean
  editingWebsite: Website | null
  selectedGroupId: string | null
  selectedSecondaryGroupId: string | null
  isSecondaryGroupEditDialogOpen: boolean
  editingSecondaryGroup: SecondaryGroup | null
  isPrimaryGroupEditDialogOpen: boolean
  editingPrimaryGroup: PrimaryGroup | null
  confirmDialog: { open: boolean; websiteId: string | null }
  secondaryGroupConfirmDelete: { open: boolean; secondaryGroupId: string | null }
  primaryGroupConfirmDelete: { open: boolean; primaryGroupId: string | null }
  clearDataDialogOpen: boolean
  resetDataDialogOpen: boolean
  clearSoftwareDataDialogOpen: boolean
  clearCacheDialogOpen: boolean

  // 状态设置函数
  setIsWebsiteDialogOpen: (open: boolean) => void
  setIsEditDialogOpen: (open: boolean) => void
  setIsSecondaryGroupEditDialogOpen: (open: boolean) => void
  setIsPrimaryGroupEditDialogOpen: (open: boolean) => void
  setClearDataDialogOpen: (open: boolean) => void
  setResetDataDialogOpen: (open: boolean) => void
  setClearSoftwareDataDialogOpen: (open: boolean) => void
  setClearCacheDialogOpen: (open: boolean) => void

  // 数据和函数
  handleWebsiteSubmit: (
    websiteData: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>
  handleSaveWebsite: (updatedWebsite: Website) => void
  confirmClearData: () => void
  cancelClearData: () => void
  confirmResetToDefaults: () => Promise<void>
  cancelResetToDefaults: () => void
  handleSaveSecondaryGroup: (updatedGroup: SecondaryGroup) => void
  handleSavePrimaryGroup: (updatedGroup: PrimaryGroup) => void
  confirmDeleteWebsite: () => void
  cancelDeleteWebsite: () => void
  confirmDeleteSecondaryGroup: () => void
  cancelDeleteSecondaryGroup: () => void
  confirmDeletePrimaryGroup: () => void
  cancelDeletePrimaryGroup: () => void
}

const DialogsContainer: React.FC<DialogsContainerProps> = ({
  isWebsiteDialogOpen,
  isEditDialogOpen,
  editingWebsite,
  selectedGroupId,
  selectedSecondaryGroupId,
  isSecondaryGroupEditDialogOpen,
  editingSecondaryGroup,
  isPrimaryGroupEditDialogOpen,
  editingPrimaryGroup,
  confirmDialog,
  secondaryGroupConfirmDelete,
  primaryGroupConfirmDelete,
  clearDataDialogOpen,
  resetDataDialogOpen,
  clearSoftwareDataDialogOpen,
  clearCacheDialogOpen,
  setIsWebsiteDialogOpen,
  setIsEditDialogOpen,
  setIsSecondaryGroupEditDialogOpen,
  setIsPrimaryGroupEditDialogOpen,
  setClearDataDialogOpen,
  setResetDataDialogOpen,
  setClearSoftwareDataDialogOpen,
  setClearCacheDialogOpen,
  handleWebsiteSubmit,
  handleSaveWebsite,
  confirmClearData,
  cancelClearData,
  confirmResetToDefaults,
  cancelResetToDefaults,
  handleSaveSecondaryGroup,
  handleSavePrimaryGroup,
  confirmDeleteWebsite,
  cancelDeleteWebsite,
  confirmDeleteSecondaryGroup,
  cancelDeleteSecondaryGroup,
  confirmDeletePrimaryGroup,
  cancelDeletePrimaryGroup
}) => {
  return (
    <>
      {/* 添加网站对话框 */}
      <AddWebsiteDialog
        open={isWebsiteDialogOpen}
        onOpenChange={setIsWebsiteDialogOpen}
        onAddWebsite={handleWebsiteSubmit}
        groupId={selectedGroupId || selectedSecondaryGroupId || ''}
      />

      {/* 编辑网站对话框 */}
      <EditWebsiteDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        website={editingWebsite}
        onSave={handleSaveWebsite}
      />

      {/* 编辑二级分组对话框 */}
      <EditSecondaryGroupDialog
        open={isSecondaryGroupEditDialogOpen}
        onOpenChange={setIsSecondaryGroupEditDialogOpen}
        group={editingSecondaryGroup}
        onSave={handleSaveSecondaryGroup}
      />

      {/* 确认删除网站对话框 */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            cancelDeleteWebsite()
          }
        }}
        title="确认删除"
        description="确定要删除这个网站吗？此操作不可撤销。"
        onConfirm={confirmDeleteWebsite}
        onCancel={cancelDeleteWebsite}
      />

      {/* 确认删除分组对话框 */}
      <ConfirmDialog
        open={secondaryGroupConfirmDelete.open}
        onOpenChange={(open) => {
          if (!open) {
            cancelDeleteSecondaryGroup()
          }
        }}
        title="确认删除"
        description="确定要删除这个分组吗？此操作会将分组内定义的网页一同删除，且不可撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDeleteSecondaryGroup}
        onCancel={cancelDeleteSecondaryGroup}
      />

      {/* 确认清空数据对话框 */}
      <ConfirmDialog
        open={clearDataDialogOpen}
        onOpenChange={setClearDataDialogOpen}
        title="确认清空数据"
        description="确定要清除所有数据吗？此操作不可撤销。"
        onConfirm={confirmClearData}
        onCancel={cancelClearData}
      />

      {/* 确认重置为默认数据对话框 */}
      <ConfirmDialog
        open={resetDataDialogOpen}
        onOpenChange={setResetDataDialogOpen}
        title="确认重置数据"
        description="确定要重置为默认数据吗？这将清除当前所有数据并恢复默认分类和网站。"
        onConfirm={confirmResetToDefaults}
        onCancel={cancelResetToDefaults}
      />

      {/* 确认清除软件数据对话框 */}
      <ConfirmDialog
        open={clearSoftwareDataDialogOpen}
        onOpenChange={setClearSoftwareDataDialogOpen}
        title="确认清除软件数据"
        description="您确定要清除所有软件数据吗？此操作不可逆转！"
        onConfirm={async () => {
          try {
            // 调用重置到默认数据的函数，清除所有数据并重置为默认值
            await confirmResetToDefaults()
            alert('所有软件数据已清除并重置为默认值')
          } catch (error) {
            console.error('清除软件数据失败:', error)
            alert('清除软件数据失败，请查看控制台日志')
          }
          setClearSoftwareDataDialogOpen(false)
        }}
        onCancel={() => setClearSoftwareDataDialogOpen(false)}
      />

      {/* 确认清除缓存对话框 */}
      <ConfirmDialog
        open={clearCacheDialogOpen}
        onOpenChange={setClearCacheDialogOpen}
        title="确认清除缓存"
        description="您确定要清除所有缓存吗？这包括网站图标和其他临时数据。"
        onConfirm={() => {
          try {
            if (window.electron?.ipcRenderer) {
              window.electron.ipcRenderer.invoke('clear-cache')
              alert('浏览器缓存已清除')
            } else {
              localStorage.clear()
              sessionStorage.clear()
              window.location.reload()
            }
          } catch (error) {
            console.error('清除缓存失败:', error)
            alert('清除缓存失败，请查看控制台日志')
          }
          setClearCacheDialogOpen(false)
        }}
        onCancel={() => setClearCacheDialogOpen(false)}
      />

      {/* 编辑主要分类对话框 */}
      <EditPrimaryGroupDialog
        open={isPrimaryGroupEditDialogOpen}
        onOpenChange={setIsPrimaryGroupEditDialogOpen}
        group={editingPrimaryGroup}
        onSave={handleSavePrimaryGroup}
        onDelete={confirmDeletePrimaryGroup}
      />

      {/* 确认删除主要分类对话框 */}
      <ConfirmDialog
        open={primaryGroupConfirmDelete.open}
        onOpenChange={(open) => {
          if (!open) {
            cancelDeletePrimaryGroup()
          }
        }}
        title="确认删除分类"
        description="确定要删除这个分类吗？此操作将删除分类下的所有网站和分组，且不可撤销。"
        confirmText="删除"
        cancelText="取消"
        onConfirm={confirmDeletePrimaryGroup}
        onCancel={cancelDeletePrimaryGroup}
      />
    </>
  )
}

export default memo(DialogsContainer)
