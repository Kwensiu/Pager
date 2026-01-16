import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS, Transform } from '@dnd-kit/utilities'
import type { DraggableAttributes } from '@dnd-kit/core'
import { Website } from '@/types/website'
import { useDragDrop } from '../contexts/DragDropContext'

interface UseWebsiteDndProps {
  id: string
  website: Website
  secondaryGroupId?: string
  primaryGroupId?: string
  disabled?: boolean
}

interface UseWebsiteDndReturn {
  // 拖拽相关属性
  attributes: DraggableAttributes
  listeners: Record<string, unknown> | undefined
  setNodeRef: (node: HTMLElement | null) => void
  transform: string | undefined
  transition: string | undefined

  // 状态
  isDragging: boolean
  isOver: boolean
  isSorting: boolean

  // 样式
  style: React.CSSProperties
  dragHandleStyle: React.CSSProperties

  // 方法
  handleDragStart: () => void
  handleDragEnd: () => void
}

export function useWebsiteDnd({
  id,
  website,
  secondaryGroupId,
  primaryGroupId,
  disabled = false
}: UseWebsiteDndProps): UseWebsiteDndReturn {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    isSorting
  } = useSortable({
    id,
    disabled,
    data: {
      type: 'website',
      website,
      secondaryGroupId,
      primaryGroupId,
      isPrimaryGroupWebsite: !secondaryGroupId && !!primaryGroupId
    }
  })

  // 获取当前的拖拽状态
  const { state: dragState } = useDragDrop()

  // 计算是否应该显示放置指示器
  // 只有当当前拖拽的是网站类型时，才在网站按钮上显示放置指示器
  const shouldShowDropIndicator = isOver && dragState.dragType === 'website'

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 'auto',
    cursor: isDragging ? 'grabbing' : 'pointer'
  }

  const dragHandleStyle: React.CSSProperties = {
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 1 : 0.4,
    transition: 'opacity 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    marginRight: '6px'
  }

  const handleDragStart = useCallback(() => {
    // 可以在这里添加自定义逻辑
  }, [])

  const handleDragEnd = useCallback(() => {
    // 可以在这里添加自定义逻辑
  }, [])

  // 从拖拽上下文中获取插入位置
  // 已移除未使用的insertPosition变量

  return {
    // 拖拽相关属性
    attributes,
    listeners,
    setNodeRef,
    transform: CSS.Transform.toString(transform || null),
    transition,

    // 状态
    isDragging,
    isOver: shouldShowDropIndicator,
    isSorting,

    // 样式
    style,
    dragHandleStyle,

    // 方法
    handleDragStart,
    handleDragEnd
  }
}

// 简化版本，用于不需要完整功能的场景
export function useBasicWebsiteDnd(id: string, disabled = false): UseWebsiteDndReturn {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const dragHandleStyle: React.CSSProperties = {
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 1 : 0.4,
    transition: 'opacity 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    marginRight: '6px'
  }

  return {
    attributes,
    listeners,
    setNodeRef,
    transform: CSS.Transform.toString(transform),
    transition,
    isDragging,
    isOver: false,
    isSorting: false,
    style,
    dragHandleStyle,
    handleDragStart: () => {},
    handleDragEnd: () => {}
  }
}

// 用于网站列表的拖拽上下文
export function useWebsiteListDnd(websiteIds: string[]): {
  getWebsiteStyle: (
    isDragging: boolean,
    transform: Transform | null,
    transition: string | undefined
  ) => React.CSSProperties
  getDragHandleStyle: (isDragging: boolean) => React.CSSProperties
  websiteIds: string[]
} {
  const getWebsiteStyle = useCallback(
    (isDragging: boolean, transform: Transform | null, transition: string | undefined) => {
      return {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'pointer'
      }
    },
    []
  )

  const getDragHandleStyle = useCallback((isDragging: boolean) => {
    return {
      cursor: isDragging ? 'grabbing' : 'grab',
      opacity: isDragging ? 1 : 0.4,
      transition: 'opacity 0.2s ease'
    }
  }, [])

  return {
    getWebsiteStyle,
    getDragHandleStyle,
    websiteIds
  }
}
