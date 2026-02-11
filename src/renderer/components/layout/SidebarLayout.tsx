import React, { useState, useEffect } from 'react'
import { SidebarProvider } from '@/ui/sidebar'
import { useSidebar } from '@/ui/sidebar.types'
import { useSidebarLogic } from './sidebar/hooks/useSidebarLogic'
import AddOptionsDialog from './sidebar/dialogs/AddOptionsDialog'
import { Website } from '@/types/website'
import type { Shortcut } from '../../../shared/types/store'
import { useSettings } from '@/hooks/useSettings'
import DialogsContainer from './DialogsContainer'
import SidebarContainer from './SidebarContainer'
import ErrorBoundary from '@/components/common/ErrorBoundary'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface SidebarLayoutProps {
  children: (currentWebsite: Website | null) => React.ReactNode
  activeWebsiteId?: string | null
  onWebsiteClick?: (website: Website) => void
}

// 内部组件，在 SidebarProvider 内部使用
interface SidebarLayoutInnerProps {
  children: (currentWebsite: Website | null) => React.ReactNode
  activeWebsiteId?: string | null
  onWebsiteClick?: (website: Website) => void
  collapsedSidebarMode: 'all' | 'expanded'
}

const SidebarLayoutInner: React.FC<SidebarLayoutInnerProps> = ({
  children,
  activeWebsiteId,
  onWebsiteClick,
  collapsedSidebarMode
}) => {
  // AddOptionsDialog 状态
  const [isAddOptionsDialogOpen, setIsAddOptionsDialogOpen] = useState(false)
  const [addOptionsPrimaryGroupId, setAddOptionsPrimaryGroupId] = useState<string | null>(null)
  // 窗口顶置状态
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  // 快捷键数据
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])

  // 获取sidebar状态
  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const {
    // 状态
    primaryGroups,
    activePrimaryGroup,
    currentWebsite,
    contextMenuSecondaryGroup,
    showSettings,

    // 对话框状态
    isWebsiteDialogOpen,
    isEditDialogOpen,
    editingWebsite,
    isGroupDialogOpen,
    dialogMode,
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

    // 函数
    toggleSecondaryGroup,
    handleAddWebsite,
    handleAddSecondaryGroup,
    handleAddPrimaryGroup,
    handleWebsiteSubmit,
    handleSaveWebsite,
    handleWebsiteClick,
    handleWebsiteUpdate,
    handleDeleteWebsite,
    confirmDeleteWebsite,
    cancelDeleteWebsite,
    switchPrimaryGroup,
    confirmClearData,
    cancelClearData,
    confirmResetToDefaults,
    cancelResetToDefaults,
    handleEditSecondaryGroup,
    handleDeleteSecondaryGroup,
    confirmDeleteSecondaryGroup,
    cancelDeleteSecondaryGroup,
    handleSaveSecondaryGroup,
    handleEditPrimaryGroup,
    handleDeletePrimaryGroup,
    confirmDeletePrimaryGroup,
    cancelDeletePrimaryGroup,
    handleSavePrimaryGroup,
    updatePrimaryGroups,

    // 状态设置函数
    setShowSettings,
    setIsWebsiteDialogOpen,
    setIsEditDialogOpen,
    setIsGroupDialogOpen,
    setIsSecondaryGroupEditDialogOpen,
    setIsPrimaryGroupEditDialogOpen,
    setClearDataDialogOpen,
    setResetDataDialogOpen,
    setClearSoftwareDataDialogOpen,
    setClearCacheDialogOpen
  } = useSidebarLogic({ activeWebsiteId, onWebsiteClick })

  // 监听关闭设置页面的事件
  useEffect(() => {
    const handleCloseSettings = (): void => {
      setShowSettings(false)
    }

    window.addEventListener('closeSettings', handleCloseSettings)
    return (): void => {
      window.removeEventListener('closeSettings', handleCloseSettings)
    }
  }, [setShowSettings])

  // 获取当前窗口顶置状态
  useEffect(() => {
    // 监听窗口顶置状态变化
    const handleAlwaysOnTopChange = (_event: Electron.IpcRendererEvent, state: boolean): void => {
      setIsAlwaysOnTop(state)
    }

    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on(
        'window-manager:always-on-top-changed',
        handleAlwaysOnTopChange
      )
    }

    return (): void => {
      if (window.electron?.ipcRenderer) {
        window.electron.ipcRenderer.removeListener(
          'window-manager:always-on-top-changed',
          handleAlwaysOnTopChange
        )
      }
    }
  }, [])

  // 获取当前窗口顶置状态
  useEffect(() => {
    const getCurrentAlwaysOnTopState = async (): Promise<void> => {
      if (window.electron?.ipcRenderer) {
        try {
          const state = await window.electron.ipcRenderer.invoke(
            'window-manager:get-always-on-top-state'
          )
          setIsAlwaysOnTop(state)
        } catch (error) {
          console.error('Failed to get always on top state:', error)
        }
      }
    }

    // 加载快捷键数据
    const loadShortcuts = async (): Promise<void> => {
      if (window.api?.enhanced?.shortcut) {
        try {
          const currentShortcuts = await window.api.enhanced.shortcut.getAll()
          setShortcuts(currentShortcuts)
        } catch (error) {
          console.error('Failed to load shortcuts:', error)
        }
      }
    }

    getCurrentAlwaysOnTopState()
    loadShortcuts()
  }, [])

  // 使用键盘快捷键钩子
  useKeyboardShortcuts({
    shortcuts,
    onShortcut: (shortcutId) => {
      // 执行对应的快捷键动作
      switch (shortcutId) {
        case 'toggle-window':
          // 软件窗口切换
          if (window.api?.enhanced?.windowManager) {
            window.api.enhanced.windowManager.toggleWindow()
          }
          break
        case 'toggle-sidebar':
          // 直接在渲染进程内执行
          toggleSidebar()
          break
        case 'open-settings':
          // 直接在渲染进程内执行
          setShowSettings(!showSettings)
          break
        case 'toggle-always-on-top':
          if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer
              .invoke('window-manager:toggle-always-on-top')
              .then(setIsAlwaysOnTop)
          }
          break
        case 'refresh-page':
          // 发送刷新消息到主进程，由WebViewContainer处理
          if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.send('window-manager:refresh-page')
          }
          break
        case 'copy-url':
          // 发送复制URL消息到主进程，由WebViewContainer处理
          if (window.electron?.ipcRenderer) {
            window.electron.ipcRenderer.send('window-manager:copy-url')
          }
          break
        case 'minimize-window':
          // 调用最小化窗口API
          if (window.api?.enhanced?.windowManager) {
            window.api.enhanced.windowManager.minimizeWindow()
          }
          break
        case 'maximize-window':
          // 调用最大化窗口API
          if (window.api?.enhanced?.windowManager) {
            window.api.enhanced.windowManager.maximizeWindow()
          }
          break
        case 'exit-app':
          // 退出应用
          if (window.api?.enhanced?.windowManager) {
            window.api.enhanced.windowManager.exitApp()
          }
          break
      }
    },
    enabled: true
  })

  return (
    <>
      <ErrorBoundary>
        <SidebarContainer
          isCollapsed={isCollapsed}
          isAlwaysOnTop={isAlwaysOnTop}
          showSettings={showSettings}
          collapsedSidebarMode={collapsedSidebarMode}
          primaryGroups={primaryGroups}
          activePrimaryGroup={activePrimaryGroup}
          currentWebsite={currentWebsite}
          isGroupDialogOpen={isGroupDialogOpen}
          dialogMode={dialogMode}
          selectedGroupId={selectedGroupId}
          switchPrimaryGroup={switchPrimaryGroup}
          handleAddPrimaryGroup={handleAddPrimaryGroup}
          handleEditPrimaryGroup={handleEditPrimaryGroup}
          handleDeletePrimaryGroup={handleDeletePrimaryGroup}
          toggleSecondaryGroup={toggleSecondaryGroup}
          handleWebsiteClick={handleWebsiteClick}
          handleAddWebsite={handleAddWebsite}
          handleWebsiteUpdate={handleWebsiteUpdate}
          handleDeleteWebsite={handleDeleteWebsite}
          handleEditSecondaryGroup={handleEditSecondaryGroup}
          handleDeleteSecondaryGroup={handleDeleteSecondaryGroup}
          contextMenuSecondaryGroup={contextMenuSecondaryGroup}
          activeWebsiteId={activeWebsiteId}
          onGroupsUpdate={updatePrimaryGroups}
          onOpenAddOptionsDialog={(primaryGroupId) => {
            setAddOptionsPrimaryGroupId(primaryGroupId)
            setIsAddOptionsDialogOpen(true)
          }}
          setShowSettings={setShowSettings}
          setIsGroupDialogOpen={setIsGroupDialogOpen}
        >
          {children}
        </SidebarContainer>
      </ErrorBoundary>

      {/* AddOptionsDialog */}
      <ErrorBoundary>
        <AddOptionsDialog
          open={isAddOptionsDialogOpen}
          onOpenChange={setIsAddOptionsDialogOpen}
          onAddSecondaryGroup={() => {
            if (addOptionsPrimaryGroupId) {
              handleAddSecondaryGroup(addOptionsPrimaryGroupId)
            }
          }}
          onAddWebsite={() => {
            if (addOptionsPrimaryGroupId) {
              handleAddWebsite(addOptionsPrimaryGroupId, false)
            }
          }}
        />
      </ErrorBoundary>

      <ErrorBoundary>
        <DialogsContainer
          isWebsiteDialogOpen={isWebsiteDialogOpen}
          isEditDialogOpen={isEditDialogOpen}
          editingWebsite={editingWebsite}
          selectedGroupId={selectedGroupId}
          selectedSecondaryGroupId={selectedSecondaryGroupId}
          isSecondaryGroupEditDialogOpen={isSecondaryGroupEditDialogOpen}
          editingSecondaryGroup={editingSecondaryGroup}
          isPrimaryGroupEditDialogOpen={isPrimaryGroupEditDialogOpen}
          editingPrimaryGroup={editingPrimaryGroup}
          confirmDialog={confirmDialog}
          secondaryGroupConfirmDelete={secondaryGroupConfirmDelete}
          primaryGroupConfirmDelete={primaryGroupConfirmDelete}
          clearDataDialogOpen={clearDataDialogOpen}
          resetDataDialogOpen={resetDataDialogOpen}
          clearSoftwareDataDialogOpen={clearSoftwareDataDialogOpen}
          clearCacheDialogOpen={clearCacheDialogOpen}
          setIsWebsiteDialogOpen={setIsWebsiteDialogOpen}
          setIsEditDialogOpen={setIsEditDialogOpen}
          setIsSecondaryGroupEditDialogOpen={setIsSecondaryGroupEditDialogOpen}
          setIsPrimaryGroupEditDialogOpen={setIsPrimaryGroupEditDialogOpen}
          setClearDataDialogOpen={setClearDataDialogOpen}
          setResetDataDialogOpen={setResetDataDialogOpen}
          setClearSoftwareDataDialogOpen={setClearSoftwareDataDialogOpen}
          setClearCacheDialogOpen={setClearCacheDialogOpen}
          handleWebsiteSubmit={handleWebsiteSubmit}
          handleSaveWebsite={handleSaveWebsite}
          confirmClearData={confirmClearData}
          cancelClearData={cancelClearData}
          confirmResetToDefaults={confirmResetToDefaults}
          cancelResetToDefaults={cancelResetToDefaults}
          handleSaveSecondaryGroup={handleSaveSecondaryGroup}
          handleSavePrimaryGroup={handleSavePrimaryGroup}
          confirmDeleteWebsite={confirmDeleteWebsite}
          cancelDeleteWebsite={cancelDeleteWebsite}
          confirmDeleteSecondaryGroup={confirmDeleteSecondaryGroup}
          cancelDeleteSecondaryGroup={cancelDeleteSecondaryGroup}
          confirmDeletePrimaryGroup={confirmDeletePrimaryGroup}
          cancelDeletePrimaryGroup={cancelDeletePrimaryGroup}
        />
      </ErrorBoundary>
    </>
  )
}

export default function SidebarLayout({
  children,
  activeWebsiteId = null,
  onWebsiteClick
}: SidebarLayoutProps): React.ReactElement {
  // 使用 useSettings hook 管理设置
  const { settings } = useSettings()
  const collapsedSidebarMode = settings.collapsedSidebarMode

  return (
    <SidebarProvider>
      <SidebarLayoutInner
        activeWebsiteId={activeWebsiteId}
        onWebsiteClick={onWebsiteClick}
        collapsedSidebarMode={collapsedSidebarMode || 'all'}
      >
        {children}
      </SidebarLayoutInner>
    </SidebarProvider>
  )
}
