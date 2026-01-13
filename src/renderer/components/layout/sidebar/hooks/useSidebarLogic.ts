import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { PrimaryGroup, SecondaryGroup, Website } from '@/types/website'
import { storageService } from '@/core/storage'
import { getDefaultGroups } from '@/utils/defaultGroupsHelper'
import { useDialogManagement } from './useDialogManagement'

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

export function useSidebarLogic({
  activeWebsiteId: _activeWebsiteId = null,
  onWebsiteClick
}: UseSidebarLogicProps) {
  // 使用对话框管理钩子
  const dialogManagement = useDialogManagement()

  // 核心状态定义
  const [primaryGroups, setPrimaryGroups] = useState<PrimaryGroup[]>([])
  const [internalActivePrimaryGroup, setInternalActivePrimaryGroup] = useState<PrimaryGroup | null>(
    null
  )

  // 初始化数据
  useEffect(() => {
    const initializeData = async () => {
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
  const handleAddWebsite = (groupId: string, isSecondaryGroup: boolean) => {
    dialogManagement.openWebsiteDialog(groupId, isSecondaryGroup)
  }

  const handleAddSecondaryGroup = (primaryGroupId: string) => {
    dialogManagement.openGroupDialog('secondary', primaryGroupId)
  }

  const handleAddPrimaryGroup = () => {
    dialogManagement.openGroupDialog('primary')
  }

  const handleWebsiteSubmit = async (
    websiteData: Omit<Website, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const { selectedGroupId, selectedSecondaryGroupId } = dialogManagement

    if (selectedGroupId) {
      await storageService.addWebsiteToPrimaryGroup(selectedGroupId, websiteData)
    } else if (selectedSecondaryGroupId) {
      await storageService.addWebsiteToSecondaryGroup(selectedSecondaryGroupId, websiteData)
    }

    const updatedPrimaryGroups = await storageService.getPrimaryGroups()
    setPrimaryGroups(updatedPrimaryGroups)
  }

  const handleSaveWebsite = (updatedWebsite: Website) => {
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

  const handleWebsiteClick = (website: Website) => {
    setCurrentWebsite(website)
    if (onWebsiteClick) {
      onWebsiteClick(website)
    }
  }

  const handleWebsiteUpdate = (website: Website) => {
    dialogManagement.openEditWebsiteDialog(website)
    setContextMenuWebsite(null)
  }

  const handleDeleteWebsite = (websiteId: string) => {
    dialogManagement.openConfirmDeleteWebsite(websiteId)
    setContextMenuWebsite(null)
  }

  const confirmDeleteWebsite = () => {
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

  const cancelDeleteWebsite = () => {
    dialogManagement.closeConfirmDeleteWebsite()
  }

  const switchPrimaryGroup = useCallback((primaryGroup: PrimaryGroup) => {
    setInternalActivePrimaryGroup(primaryGroup)
    setShowSettings(false)
  }, [])

  // 处理右键菜单事件
  const handleContextMenu = (e: React.MouseEvent, secondaryGroupId: string) => {
    e.preventDefault()
    setContextMenuSecondaryGroup(
      contextMenuSecondaryGroup === secondaryGroupId ? null : secondaryGroupId
    )
    setContextMenuPosition({ x: e.clientX, y: e.clientY })
  }

  const handleWebsiteContextMenu = (e: React.MouseEvent, websiteId: string) => {
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
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuWebsite(null)
    setContextMenuSecondaryGroup(null)
  }, [])

  const handleClearData = () => {
    dialogManagement.openClearDataDialog()
  }

  const confirmClearData = () => {
    storageService.clearPrimaryGroups()
    localStorage.removeItem('hasInitialized')
    setPrimaryGroups([])
    setActivePrimaryGroup(null)
    setCurrentWebsite(null)
    dialogManagement.closeClearDataDialog()
  }

  const cancelClearData = () => {
    dialogManagement.closeClearDataDialog()
  }

  const handleResetToDefaults = () => {
    dialogManagement.openResetDataDialog()
  }

  const confirmResetToDefaults = async () => {
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

  const cancelResetToDefaults = () => {
    dialogManagement.closeResetDataDialog()
  }

  const handleEditSecondaryGroup = (secondaryGroup: SecondaryGroup) => {
    dialogManagement.openSecondaryGroupEditDialog(secondaryGroup)
    setContextMenuSecondaryGroup(null)
  }

  const handleDeleteSecondaryGroup = (secondaryGroupId: string) => {
    dialogManagement.openConfirmDeleteSecondaryGroup(secondaryGroupId)
    setContextMenuSecondaryGroup(null)
  }

  const confirmDeleteSecondaryGroup = () => {
    if (!dialogManagement.secondaryGroupConfirmDelete.secondaryGroupId) return

    setPrimaryGroups((prevGroups) =>
      prevGroups.map((pg) => ({
        ...pg,
        secondaryGroups: pg.secondaryGroups.filter(
          (sg) => sg.id !== dialogManagement.secondaryGroupConfirmDelete.secondaryGroupId
        )
      }))
    )

    dialogManagement.closeConfirmDeleteSecondaryGroup()
  }

  const cancelDeleteSecondaryGroup = () => {
    dialogManagement.closeConfirmDeleteSecondaryGroup()
  }

  const handleSaveSecondaryGroup = () => {
    if (!dialogManagement.editingSecondaryGroup) return

    setPrimaryGroups((prevGroups) =>
      prevGroups.map((pg) => ({
        ...pg,
        secondaryGroups: pg.secondaryGroups.map((sg) =>
          sg.id === dialogManagement.editingSecondaryGroup?.id
            ? { ...dialogManagement.editingSecondaryGroup }
            : sg
        )
      }))
    )

    dialogManagement.closeSecondaryGroupEditDialog()
  }

  // 更新primaryGroups的函数
  const updatePrimaryGroups = useCallback((newGroups: PrimaryGroup[]) => {
    setPrimaryGroups(newGroups)
    storageService.setPrimaryGroups(newGroups)
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
