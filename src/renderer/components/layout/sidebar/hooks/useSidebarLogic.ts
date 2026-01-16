import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PrimaryGroup, SecondaryGroup, Website } from '@/types/website'
import { storageService } from '@/core/storage'
import { getDefaultGroups } from '@/utils/defaultGroupsHelper'
import {
  useDialogManagement,
  DialogManagementState,
  DialogManagementActions
} from './useDialogManagement'

// 检查是否是首次启动应用
const isFirstRun = (): boolean => {
  return localStorage.getItem('hasInitialized') !== 'true'
}

// 标记应用已经初始化
const markAsInitialized = (): void => {
  localStorage.setItem('hasInitialized', 'true')
}

export interface UseSidebarLogicProps {
  activeWebsiteId?: string | null
  onWebsiteClick?: (website: Website) => void
}

export interface UseSidebarLogicReturn extends DialogManagementState, DialogManagementActions {
  // 状态
  primaryGroups: PrimaryGroup[]
  activePrimaryGroup: PrimaryGroup | null
  currentWebsite: Website | null
  contextMenuWebsite: string | null
  contextMenuSecondaryGroup: string | null
  contextMenuPosition: { x: number; y: number }
  contextMenuRef: React.RefObject<HTMLDivElement | null>
  showSettings: boolean
  showDebugOptions: boolean

  // 函数
  setActivePrimaryGroup: (group: PrimaryGroup | null) => void
  toggleSecondaryGroup: (secondaryGroupId: string) => void
  handleAddWebsite: (groupId: string, isSecondaryGroup: boolean) => void
  handleAddSecondaryGroup: (primaryGroupId: string) => void
  handleAddPrimaryGroup: () => void
  handleWebsiteSubmit: (
    websiteData: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>
  handleSaveWebsite: (updatedWebsite: Website) => void
  handleWebsiteClick: (website: Website) => void
  handleWebsiteUpdate: (website: Website) => void
  handleDeleteWebsite: (websiteId: string) => void
  confirmDeleteWebsite: () => void
  cancelDeleteWebsite: () => void
  switchPrimaryGroup: (primaryGroup: PrimaryGroup) => void
  handleContextMenu: (e: React.MouseEvent, secondaryGroupId: string) => void
  handleWebsiteContextMenu: (e: React.MouseEvent, websiteId: string) => void
  handleCloseContextMenu: () => void
  handleClearData: () => void
  confirmClearData: () => void
  cancelClearData: () => void
  handleResetToDefaults: () => void
  confirmResetToDefaults: () => Promise<void>
  cancelResetToDefaults: () => void
  handleEditSecondaryGroup: (secondaryGroup: SecondaryGroup) => void
  handleDeleteSecondaryGroup: (secondaryGroupId: string) => void
  confirmDeleteSecondaryGroup: () => void
  cancelDeleteSecondaryGroup: () => void
  handleSaveSecondaryGroup: (updatedGroup: SecondaryGroup) => void
  handleEditPrimaryGroup: (group: PrimaryGroup) => void
  handleDeletePrimaryGroup: (groupId: string) => void
  confirmDeletePrimaryGroup: () => void
  cancelDeletePrimaryGroup: () => void
  handleSavePrimaryGroup: (updatedGroup: PrimaryGroup) => void
  updatePrimaryGroups: (newGroups: PrimaryGroup[]) => void

  // 状态设置函数
  setCurrentWebsite: (website: Website | null) => void
  setContextMenuWebsite: (websiteId: string | null) => void
  setContextMenuSecondaryGroup: (secondaryGroupId: string | null) => void
  setContextMenuPosition: (position: { x: number; y: number }) => void
  setShowSettings: (show: boolean) => void
  setShowDebugOptions: (show: boolean) => void

  // 从dialogManagement扩展的状态设置函数
  setIsWebsiteDialogOpen: (open: boolean) => void
  setIsEditDialogOpen: (open: boolean) => void
  setEditingWebsite: (website: Website | null) => void
  setSelectedGroupId: (id: string | null) => void
  setSelectedSecondaryGroupId: (id: string | null) => void
  setIsGroupDialogOpen: (open: boolean) => void
  setDialogMode: (mode: 'primary' | 'secondary' | 'website') => void
  setIsSecondaryGroupEditDialogOpen: (open: boolean) => void
  setEditingSecondaryGroup: (group: SecondaryGroup | null) => void
  setIsPrimaryGroupEditDialogOpen: (open: boolean) => void
  setEditingPrimaryGroup: (group: PrimaryGroup | null) => void
  setConfirmDialog: (dialog: { open: boolean; websiteId: string | null }) => void
  setSecondaryGroupConfirmDelete: (dialog: {
    open: boolean
    secondaryGroupId: string | null
  }) => void
  setPrimaryGroupConfirmDelete: (dialog: { open: boolean; primaryGroupId: string | null }) => void
  setClearDataDialogOpen: (open: boolean) => void
  setResetDataDialogOpen: (open: boolean) => void
  setClearSoftwareDataDialogOpen: (open: boolean) => void
  setClearCacheDialogOpen: (open: boolean) => void
}

export function useSidebarLogic({
  activeWebsiteId: _activeWebsiteId = null,
  onWebsiteClick
}: UseSidebarLogicProps): UseSidebarLogicReturn {
  // 使用对话框管理钩子
  const dialogManagement = useDialogManagement()

  // 核心状态定义
  const [primaryGroups, setPrimaryGroups] = useState<PrimaryGroup[]>([])
  const [internalActivePrimaryGroup, setInternalActivePrimaryGroup] = useState<PrimaryGroup | null>(
    null
  )

  // 初始化数据
  useEffect(() => {
    const initializeData = async (): Promise<void> => {
      const savedPrimaryGroups = await storageService.getPrimaryGroups()

      if (savedPrimaryGroups.length > 0) {
        setPrimaryGroups(savedPrimaryGroups)
        setInternalActivePrimaryGroup(savedPrimaryGroups[0])
      } else if (isFirstRun()) {
        const defaultGroups = getDefaultGroups()
        await storageService.setPrimaryGroups(defaultGroups)
        markAsInitialized()
        setPrimaryGroups([...defaultGroups])
        setInternalActivePrimaryGroup(defaultGroups[0] || null)
      } else {
        setPrimaryGroups([])
        setInternalActivePrimaryGroup(null)
      }
    }

    initializeData()
  }, [])

  // 上下文菜单相关状态
  const [currentWebsite, setCurrentWebsite] = useState<Website | null>(null)
  const [contextMenuWebsite, setContextMenuWebsite] = useState<string | null>(null)
  const [contextMenuSecondaryGroup, setContextMenuSecondaryGroup] = useState<string | null>(null)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const contextMenuRef = useRef<HTMLDivElement>(null)

  // UI状态
  const [showSettings, setShowSettings] = useState(false)
  const [showDebugOptions, setShowDebugOptions] = useState(false)

  const activePrimaryGroup = useMemo(() => {
    if (
      internalActivePrimaryGroup &&
      primaryGroups.some((pg) => pg.id === internalActivePrimaryGroup.id)
    ) {
      const updatedGroup = primaryGroups.find((pg) => pg.id === internalActivePrimaryGroup.id)
      return updatedGroup || internalActivePrimaryGroup
    }
    return primaryGroups[0] || null
  }, [internalActivePrimaryGroup, primaryGroups])

  // 设置活动分类
  const setActivePrimaryGroup = useCallback((group: PrimaryGroup | null) => {
    setInternalActivePrimaryGroup(group)
  }, [])

  // 切换二级分组展开状态
  const toggleSecondaryGroup = useCallback(
    (secondaryGroupId: string) => {
      setPrimaryGroups((prevGroups) => {
        const newGroups = prevGroups.map((primaryGroup) => {
          if (primaryGroup.id === activePrimaryGroup?.id) {
            return {
              ...primaryGroup,
              secondaryGroups: primaryGroup.secondaryGroups.map((secondaryGroup) => {
                if (secondaryGroup.id === secondaryGroupId) {
                  const isCurrentlyExpanded = secondaryGroup.expanded !== false
                  return {
                    ...secondaryGroup,
                    expanded: !isCurrentlyExpanded
                  }
                }
                return secondaryGroup
              })
            }
          }
          return primaryGroup
        })

        // 异步保存，不等待结果
        storageService.setPrimaryGroups(newGroups)
        return newGroups
      })
    },
    [activePrimaryGroup?.id]
  )

  // 添加网站
  const handleAddWebsite = (groupId: string, isSecondaryGroup: boolean): void => {
    dialogManagement.openWebsiteDialog(groupId, isSecondaryGroup)
  }

  const handleAddSecondaryGroup = (primaryGroupId: string): void => {
    dialogManagement.openGroupDialog('secondary', primaryGroupId)
  }

  const handleAddPrimaryGroup = (): void => {
    dialogManagement.openGroupDialog('primary')
  }

  const handleWebsiteSubmit = async (
    websiteData: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> => {
    const { selectedGroupId, selectedSecondaryGroupId } = dialogManagement

    if (selectedGroupId) {
      await storageService.addWebsiteToPrimaryGroup(selectedGroupId, websiteData)
    } else if (selectedSecondaryGroupId) {
      await storageService.addWebsiteToSecondaryGroup(selectedSecondaryGroupId, websiteData)
    }

    const updatedPrimaryGroups = await storageService.getPrimaryGroups()
    setPrimaryGroups(updatedPrimaryGroups)
  }

  const handleSaveWebsite = (updatedWebsite: Website): void => {
    const updatedPrimaryGroups = primaryGroups.map((primaryGroup) => {
      if (primaryGroup.id === activePrimaryGroup?.id) {
        // 首先检查网站是否在一级分类下
        const primaryWebsiteIndex =
          primaryGroup.websites?.findIndex((w) => w.id === updatedWebsite.id) ?? -1

        if (primaryWebsiteIndex !== -1) {
          // 更新一级分类下的网站
          const updatedWebsites = [...(primaryGroup.websites || [])]
          updatedWebsites[primaryWebsiteIndex] = {
            ...updatedWebsites[primaryWebsiteIndex],
            name: updatedWebsite.name,
            url: updatedWebsite.url,
            description: updatedWebsite.description,
            updatedAt: Date.now()
          }
          return {
            ...primaryGroup,
            websites: updatedWebsites
          }
        } else {
          // 检查网站是否在二级分组中
          return {
            ...primaryGroup,
            secondaryGroups: primaryGroup.secondaryGroups.map((secondaryGroup) => {
              const websiteIndex = secondaryGroup.websites.findIndex(
                (w) => w.id === updatedWebsite.id
              )
              if (websiteIndex !== -1) {
                const updatedWebsites = [...secondaryGroup.websites]
                updatedWebsites[websiteIndex] = {
                  ...updatedWebsites[websiteIndex],
                  name: updatedWebsite.name,
                  url: updatedWebsite.url,
                  description: updatedWebsite.description,
                  updatedAt: Date.now()
                }
                return {
                  ...secondaryGroup,
                  websites: updatedWebsites
                }
              }
              return secondaryGroup
            })
          }
        }
      }
      return primaryGroup
    })

    setPrimaryGroups(updatedPrimaryGroups)
    storageService.setPrimaryGroups(updatedPrimaryGroups)
    dialogManagement.closeEditWebsiteDialog()
  }

  const handleWebsiteClick = (website: Website): void => {
    setCurrentWebsite(website)
    if (onWebsiteClick) {
      onWebsiteClick(website)
    }
  }

  const handleWebsiteUpdate = (website: Website): void => {
    dialogManagement.openEditWebsiteDialog(website)
    setContextMenuWebsite(null)
  }

  const handleDeleteWebsite = (websiteId: string): void => {
    dialogManagement.openConfirmDeleteWebsite(websiteId)
    setContextMenuWebsite(null)
  }

  const confirmDeleteWebsite = (): void => {
    if (!dialogManagement.confirmDialog.websiteId) return

    const updatedPrimaryGroups = primaryGroups.map((pg) => {
      // 首先从一级分类的网站中删除
      const filteredPrimaryWebsites =
        pg.websites?.filter((w) => w.id !== dialogManagement.confirmDialog.websiteId) || []

      // 然后从二级分组的网站中删除
      const updatedSecondaryGroups = pg.secondaryGroups
        .map((sg) => ({
          ...sg,
          websites:
            sg.websites?.filter((w) => w.id !== dialogManagement.confirmDialog.websiteId) || []
        }))
        .filter((sg) => sg.websites && sg.websites.length > 0)

      return {
        ...pg,
        websites: filteredPrimaryWebsites,
        secondaryGroups: updatedSecondaryGroups
      }
    })

    setPrimaryGroups(updatedPrimaryGroups)
    storageService.setPrimaryGroups(updatedPrimaryGroups)
    setContextMenuWebsite(null)
    dialogManagement.closeConfirmDeleteWebsite()
  }

  const cancelDeleteWebsite = (): void => {
    dialogManagement.closeConfirmDeleteWebsite()
  }

  const switchPrimaryGroup = useCallback((primaryGroup: PrimaryGroup) => {
    setInternalActivePrimaryGroup(primaryGroup)
    setShowSettings(false)
  }, [])

  // 处理右键菜单事件
  const handleContextMenu = (e: React.MouseEvent, secondaryGroupId: string): void => {
    e.preventDefault()
    setContextMenuSecondaryGroup(
      contextMenuSecondaryGroup === secondaryGroupId ? null : secondaryGroupId
    )
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }

  const handleWebsiteContextMenu = (e: React.MouseEvent, websiteId: string): void => {
    e.preventDefault()
    setContextMenuWebsite(contextMenuWebsite === websiteId ? null : websiteId)
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }

  // 右键菜单定位效果
  useEffect(() => {
    if ((contextMenuWebsite || contextMenuSecondaryGroup) && contextMenuRef.current) {
      let element: Element | null = null
      if (contextMenuWebsite) {
        element = document.querySelector(`[data-website-id="${contextMenuWebsite}"]`)
      } else if (contextMenuSecondaryGroup) {
        element = document.querySelector(`[data-secondary-group-id="${contextMenuSecondaryGroup}"]`)
      }

      if (element && contextMenuRef.current) {
        const rect = element.getBoundingClientRect()
        contextMenuRef.current.style.top = `${rect.bottom + window.scrollY}px`
        contextMenuRef.current.style.left = `${rect.left + window.scrollX + 20}px`
      }
    }
  }, [contextMenuWebsite, contextMenuSecondaryGroup])

  // 右键菜单关闭函数
  const handleCloseContextMenu = (): void => {
    setContextMenuWebsite(null)
    setContextMenuSecondaryGroup(null)
  }

  const handleClearData = (): void => {
    dialogManagement.openClearDataDialog()
  }

  const confirmClearData = (): void => {
    storageService.clearPrimaryGroups()
    localStorage.removeItem('hasInitialized')
    setPrimaryGroups([])
    setActivePrimaryGroup(null)
    setCurrentWebsite(null)
    dialogManagement.closeClearDataDialog()
  }

  const cancelClearData = (): void => {
    dialogManagement.closeClearDataDialog()
  }

  const handleResetToDefaults = (): void => {
    dialogManagement.openResetDataDialog()
  }

  const confirmResetToDefaults = async (): Promise<void> => {
    await storageService.clearPrimaryGroups()
    localStorage.removeItem('hasInitialized')
    const defaultGroups = getDefaultGroups()
    await storageService.setPrimaryGroups(defaultGroups)
    markAsInitialized()
    setPrimaryGroups([...defaultGroups])
    setActivePrimaryGroup(defaultGroups[0] || null)
    setCurrentWebsite(null)
    dialogManagement.closeResetDataDialog()
  }

  const cancelResetToDefaults = (): void => {
    dialogManagement.closeResetDataDialog()
  }

  const handleEditSecondaryGroup = (secondaryGroup: SecondaryGroup): void => {
    dialogManagement.openSecondaryGroupEditDialog(secondaryGroup)
    setContextMenuSecondaryGroup(null)
  }

  const handleDeleteSecondaryGroup = (secondaryGroupId: string): void => {
    dialogManagement.openConfirmDeleteSecondaryGroup(secondaryGroupId)
    setContextMenuSecondaryGroup(null)
  }

  const confirmDeleteSecondaryGroup = (): void => {
    if (!dialogManagement.secondaryGroupConfirmDelete.secondaryGroupId) return

    const updatedGroups = primaryGroups.map((pg) => ({
      ...pg,
      secondaryGroups: pg.secondaryGroups.filter(
        (sg) => sg.id !== dialogManagement.secondaryGroupConfirmDelete.secondaryGroupId
      )
    }))

    setPrimaryGroups(updatedGroups)
    storageService.setPrimaryGroups(updatedGroups)
    dialogManagement.closeConfirmDeleteSecondaryGroup()
  }

  const cancelDeleteSecondaryGroup = (): void => {
    dialogManagement.closeConfirmDeleteSecondaryGroup()
  }

  const handleSaveSecondaryGroup = (updatedGroup: SecondaryGroup): void => {
    const updatedGroups = primaryGroups.map((pg) => ({
      ...pg,
      secondaryGroups: pg.secondaryGroups.map((sg) =>
        sg.id === updatedGroup.id ? { ...updatedGroup } : sg
      )
    }))

    setPrimaryGroups(updatedGroups)
    storageService.setPrimaryGroups(updatedGroups)
    dialogManagement.closeSecondaryGroupEditDialog()
  }

  // 主要分类编辑功能
  const handleEditPrimaryGroup = (group: PrimaryGroup): void => {
    dialogManagement.openPrimaryGroupEditDialog(group)
  }

  const handleDeletePrimaryGroup = (groupId: string): void => {
    dialogManagement.openConfirmDeletePrimaryGroup(groupId)
  }

  const confirmDeletePrimaryGroup = (): void => {
    if (!dialogManagement.primaryGroupConfirmDelete.primaryGroupId) return

    const groupId = dialogManagement.primaryGroupConfirmDelete.primaryGroupId

    // 如果删除的是当前激活的分类，需要切换到其他分类
    if (activePrimaryGroup?.id === groupId) {
      const otherGroups = primaryGroups.filter((g) => g.id !== groupId)
      if (otherGroups.length > 0) {
        setInternalActivePrimaryGroup(otherGroups[0])
      } else {
        setInternalActivePrimaryGroup(null)
      }
    }

    // 删除分类
    const updatedPrimaryGroups = primaryGroups.filter((g) => g.id !== groupId)
    setPrimaryGroups(updatedPrimaryGroups)
    storageService.setPrimaryGroups(updatedPrimaryGroups)

    dialogManagement.closeConfirmDeletePrimaryGroup()
  }

  const cancelDeletePrimaryGroup = (): void => {
    dialogManagement.closeConfirmDeletePrimaryGroup()
  }

  const handleSavePrimaryGroup = (updatedGroup: PrimaryGroup): void => {
    const updatedPrimaryGroups = primaryGroups.map((pg) =>
      pg.id === updatedGroup.id ? updatedGroup : pg
    )

    setPrimaryGroups(updatedPrimaryGroups)
    storageService.setPrimaryGroups(updatedPrimaryGroups)

    // 如果更新的是当前激活的分类，更新激活状态
    if (activePrimaryGroup?.id === updatedGroup.id) {
      setInternalActivePrimaryGroup(updatedGroup)
    }

    dialogManagement.closePrimaryGroupEditDialog()
  }

  // 更新primaryGroups的函数
  const updatePrimaryGroups = useCallback((newGroups: PrimaryGroup[]): void => {
    // 深度克隆数组以确保React检测到变化
    const updatedGroups = JSON.parse(JSON.stringify(newGroups)) as PrimaryGroup[]
    setPrimaryGroups(updatedGroups)
    storageService.setPrimaryGroups(updatedGroups)
  }, [])

  // 返回所有状态和函数
  return {
    // 状态
    primaryGroups,
    activePrimaryGroup,
    currentWebsite,
    contextMenuWebsite,
    contextMenuSecondaryGroup,
    contextMenuPosition,
    contextMenuRef,
    showSettings,
    showDebugOptions,

    // 对话框状态（从dialogManagement中获取）
    ...dialogManagement,

    // 函数
    setActivePrimaryGroup,
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
    handleContextMenu,
    handleWebsiteContextMenu,
    handleCloseContextMenu,
    handleClearData,
    confirmClearData,
    cancelClearData,
    handleResetToDefaults,
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
    setCurrentWebsite,
    setContextMenuWebsite,
    setContextMenuSecondaryGroup,
    setContextMenuPosition,
    setShowSettings,
    setShowDebugOptions
  }
}
