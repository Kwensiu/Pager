import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Website } from '@/types/website'
import { useDragDrop } from '../contexts/DragDropContext'

interface UseWebsiteDndProps {
  id: string
  website: Website
  secondaryGroupId?: string // 改为可选
  primaryGroupId?: string // 添加一级分类ID
  disabled?: boolean
}

interface UseWebsiteDndReturn {
  // 拖拽相关属性
  attributes: Record<string, any>
  listeners: Record<string, any>
  setNodeRef: (node: HTMLElement | null) => void
  transform: string | null
  transition: string | null

  // 状态
  isDragging: boolean
  isOver: boolean
  isSorting: boolean
  insertPosition: 'above' | 'below' | undefined // 插入位置：上方或下方

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
  }, [id, website.name])

  const handleDragEnd = useCallback(() => {
    // 可以在这里添加自定义逻辑
  }, [id])

  // 从拖拽上下文中获取插入位置
  const insertPosition: 'above' | 'below' | undefined = shouldShowDropIndicator
    ? dragState.insertPosition
    : undefined

  return {
    // 拖拽相关属性
    attributes: attributes || {},
    listeners: listeners || {},
    setNodeRef,
    transform: CSS.Transform.toString(transform) || null,
    transition: transition || null,

    // 状态
    isDragging,
    isOver: shouldShowDropIndicator, // 使用计算后的值
    isSorting,
    insertPosition,

    // 样式
    style,
    dragHandleStyle,

    // 方法
    handleDragStart,
    handleDragEnd
  }
}

// 简化版本，用于不需要完整功能的场景
export function useBasicWebsiteDnd(id: string, disabled = false) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return {
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging
  }
}

// 用于网站列表的拖拽上下文
export function useWebsiteListDnd(websiteIds: string[]) {
  const getWebsiteStyle = useCallback((isDragging: boolean, transform: any, transition: any) => {
    return {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      cursor: isDragging ? 'grabbing' : 'pointer'
    }
  }, [])

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
