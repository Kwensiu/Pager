import React, { memo } from 'react'
import {
  Sidebar,
  SidebarContent as UISidebarContent,
  SidebarFooter,
  SidebarRail,
  SidebarInset
} from '@/ui/sidebar'
import { Settings } from 'lucide-react'
import SidebarHeader from './sidebar/core/SidebarHeader'
import SidebarContentWithDragDrop from './sidebar/dialogs/SidebarContentWithDragDrop'
import { AddGroupDialog } from '@/components/features/AddGroupDialog'
import { useAddGroupDialog } from '@/hooks/useAddGroupDialog'
import SettingsDialog from '@/components/features/SettingsDialog'
import { PrimaryGroup, SecondaryGroup, Website } from '@/types/website'

/**
 * SidebarContainer 组件
 *
 * 侧边栏的主要容器组件，负责渲染完整的侧边栏界面，包括：
 * - 侧边栏头部（分组切换）
 * - 侧边栏内容区域（网站列表和拖拽功能）
 * - 侧边栏底部（设置按钮和分组对话框）
 * - 设置面板覆盖层
 *
 * @param props - 组件属性
 * @param props.isCollapsed - 侧边栏是否折叠
 * @param props.isAlwaysOnTop - 窗口是否置顶
 * @param props.showSettings - 是否显示设置面板
 * @param props.collapsedSidebarMode - 折叠模式
 * @param props.primaryGroups - 一级分组列表
 * @param props.activePrimaryGroup - 当前激活的一级分组
 * @param props.currentWebsite - 当前网站
 * @param props.isGroupDialogOpen - 分组对话框是否打开
 * @param props.dialogMode - 对话框模式
 * @param props.selectedGroupId - 选中的分组ID
 * @param props.switchPrimaryGroup - 切换一级分组的函数
 * @param props.handleAddPrimaryGroup - 添加一级分组的函数
 * @param props.handleEditPrimaryGroup - 编辑一级分组的函数
 * @param props.handleDeletePrimaryGroup - 删除一级分组的函数
 * @param props.toggleSecondaryGroup - 切换二级分组展开状态的函数
 * @param props.handleWebsiteClick - 处理网站点击的函数
 * @param props.handleAddWebsite - 添加网站的函数
 * @param props.handleWebsiteUpdate - 更新网站的函数
 * @param props.handleDeleteWebsite - 删除网站的函数
 * @param props.handleEditSecondaryGroup - 编辑二级分组的函数
 * @param props.handleDeleteSecondaryGroup - 删除二级分组的函数
 * @param props.contextMenuSecondaryGroup - 右键菜单的二级分组ID
 * @param props.activeWebsiteId - 当前激活的网站ID
 * @param props.onGroupsUpdate - 更新分组列表的函数
 * @param props.onOpenAddOptionsDialog - 打开添加选项对话框的函数
 * @param props.setShowSettings - 设置显示设置面板的函数
 * @param props.setIsGroupDialogOpen - 设置分组对话框打开状态的函数
 * @param props.children - 子组件渲染函数
 *
 * @returns 渲染的侧边栏容器组件
 *
 * @example
 * ```tsx
 * <SidebarContainer
 *   isCollapsed={false}
 *   primaryGroups={groups}
 *   activePrimaryGroup={activeGroup}
 *   onGroupsUpdate={handleGroupsUpdate}
 *   // ... 其他必需属性
 * >
 *   {(website) => <WebView website={website} />}
 * </SidebarContainer>
 * ```
 */
interface SidebarContainerProps {
  // 布局状态
  /** 侧边栏是否处于折叠状态 */
  isCollapsed: boolean
  /** 窗口是否置顶显示 */
  isAlwaysOnTop: boolean
  /** 是否显示设置面板 */
  showSettings: boolean
  /** 侧边栏折叠模式配置 */
  collapsedSidebarMode: 'all' | 'expanded'

  // 数据
  /** 一级分组列表 */
  primaryGroups: PrimaryGroup[]
  /** 当前激活的一级分组 */
  activePrimaryGroup: PrimaryGroup | null
  /** 当前选中的网站 */
  currentWebsite: Website | null

  // 对话框状态
  /** 分组对话框是否打开 */
  isGroupDialogOpen: boolean
  /** 对话框模式 */
  dialogMode: 'primary' | 'secondary' | 'website'
  /** 选中的分组ID */
  selectedGroupId: string | null

  // 函数
  /** 切换一级分组 */
  switchPrimaryGroup: (primaryGroup: PrimaryGroup) => void
  /** 添加一级分组 */
  handleAddPrimaryGroup: () => void
  /** 编辑一级分组 */
  handleEditPrimaryGroup: (group: PrimaryGroup) => void
  /** 删除一级分组 */
  handleDeletePrimaryGroup: (groupId: string) => void
  /** 切换二级分组展开状态 */
  toggleSecondaryGroup: (secondaryGroupId: string) => void
  /** 处理网站点击事件 */
  handleWebsiteClick: (website: Website) => void
  /** 添加网站 */
  handleAddWebsite: (groupId: string, isSecondaryGroup: boolean) => void
  /** 更新网站信息 */
  handleWebsiteUpdate: (website: Website) => void
  /** 删除网站 */
  handleDeleteWebsite: (websiteId: string) => void
  /** 编辑二级分组 */
  handleEditSecondaryGroup: (secondaryGroup: SecondaryGroup) => void
  /** 删除二级分组 */
  handleDeleteSecondaryGroup: (secondaryGroupId: string) => void
  /** 右键菜单的二级分组ID */
  contextMenuSecondaryGroup: string | null
  /** 当前激活的网站ID */
  activeWebsiteId?: string | null
  /** 更新分组列表 */
  onGroupsUpdate: (updatedGroups: PrimaryGroup[]) => void
  /** 打开添加选项对话框 */
  onOpenAddOptionsDialog: (primaryGroupId: string) => void

  // 状态设置函数
  /** 设置显示设置面板 */
  setShowSettings: (show: boolean) => void
  /** 设置分组对话框打开状态 */
  setIsGroupDialogOpen: (open: boolean) => void

  // 子组件
  /** 子组件渲染函数，接收当前网站作为参数 */
  children: (currentWebsite: Website | null) => React.ReactNode
}

/**
 * SidebarContainer 组件实现
 *
 * 使用 React.memo 进行性能优化，避免不必要的重渲染
 */
const SidebarContainer: React.FC<SidebarContainerProps> = ({
  // 布局状态
  isCollapsed,
  isAlwaysOnTop,
  showSettings,
  collapsedSidebarMode,

  // 数据
  primaryGroups,
  activePrimaryGroup,
  currentWebsite,

  // 对话框状态
  isGroupDialogOpen,
  dialogMode,
  selectedGroupId,

  // 函数
  switchPrimaryGroup,
  handleAddPrimaryGroup,
  handleEditPrimaryGroup,
  handleDeletePrimaryGroup,
  toggleSecondaryGroup,
  handleWebsiteClick,
  handleAddWebsite,
  handleWebsiteUpdate,
  handleDeleteWebsite,
  handleEditSecondaryGroup,
  handleDeleteSecondaryGroup,
  contextMenuSecondaryGroup,
  activeWebsiteId,
  onGroupsUpdate,
  onOpenAddOptionsDialog,

  // 状态设置函数
  setShowSettings,
  setIsGroupDialogOpen,

  // 子组件
  children
}) => {
  // 使用共享的添加分组对话框钩子
  const { handleAddGroup } = useAddGroupDialog({
    dialogMode,
    selectedGroupId,
    primaryGroups,
    onGroupsUpdate
  })

  return (
    <div className={`flex h-screen w-full ${isAlwaysOnTop ? 'border-4 border-blue-400/30' : ''}`}>
      <Sidebar
        collapsible="icon"
        className="h-full border-r border-border [&_[data-sidebar=rail]]:!hidden will-change-[width] contain-[layout]"
        role="navigation"
        aria-label="网站导航侧边栏"
      >
        <SidebarHeader
          primaryGroups={primaryGroups}
          activePrimaryGroup={activePrimaryGroup}
          onSwitchPrimaryGroup={switchPrimaryGroup}
          onAddPrimaryGroup={handleAddPrimaryGroup}
          onEditPrimaryGroup={handleEditPrimaryGroup}
          onDeletePrimaryGroup={handleDeletePrimaryGroup}
        />
        <UISidebarContent
          className="h-full overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
          role="region"
          aria-label="网站分组列表"
          tabIndex={-1}
        >
          <SidebarContentWithDragDrop
            activePrimaryGroup={activePrimaryGroup}
            toggleSecondaryGroup={toggleSecondaryGroup}
            handleWebsiteClick={handleWebsiteClick}
            handleAddWebsite={handleAddWebsite}
            handleWebsiteUpdate={handleWebsiteUpdate}
            handleDeleteWebsite={handleDeleteWebsite}
            handleEditSecondaryGroup={handleEditSecondaryGroup}
            handleDeleteSecondaryGroup={handleDeleteSecondaryGroup}
            contextMenuSecondaryGroup={contextMenuSecondaryGroup}
            activeWebsiteId={activeWebsiteId}
            primaryGroups={primaryGroups}
            onGroupsUpdate={onGroupsUpdate}
            onOpenAddOptionsDialog={onOpenAddOptionsDialog}
            collapsedSidebarMode={collapsedSidebarMode}
          />
        </UISidebarContent>
        <SidebarFooter className="mt-auto border-t border-border p-2">
          <div className="flex flex-col gap-2">
            <button
              className="relative flex items-center w-full text-sm font-medium text-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors h-9 px-3"
              onClick={() => setShowSettings(!showSettings)}
              aria-label={showSettings ? '关闭设置面板' : '打开设置面板'}
              aria-expanded={showSettings}
              aria-controls="settings-panel"
            >
              <Settings className="absolute left-1.5 h-5 w-5 shrink-0" aria-hidden="true" />
              {!isCollapsed && <span className="ml-6">设置</span>}
            </button>
          </div>

          <AddGroupDialog
            open={isGroupDialogOpen}
            onOpenChange={setIsGroupDialogOpen}
            onAddGroup={handleAddGroup}
            groupType={dialogMode === 'website' ? 'secondary' : dialogMode}
          />
        </SidebarFooter>
        {!isCollapsed && <SidebarRail />}
      </Sidebar>
      <SidebarInset className="h-screen w-full">
        <div className="flex flex-1 flex-col overflow-hidden relative h-full">
          {/* 网站内容 - 始终渲染，避免 WebView 重载 */}
          <div className="flex-1 overflow-hidden">
            {typeof children === 'function' ? children(currentWebsite) : children}
          </div>

          {/* 设置页面覆盖层 */}
          <div
            className={`absolute inset-0 bg-background transition-all duration-300 ease-in-out ${
              showSettings
                ? 'opacity-100 pointer-events-auto z-10'
                : 'opacity-0 pointer-events-none -z-10'
            }`}
            id="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            aria-describedby="settings-description"
          >
            <SettingsDialog />
          </div>
        </div>
      </SidebarInset>
    </div>
  )
}

export default memo(SidebarContainer)
