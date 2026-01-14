import { useCallback } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { SecondaryGroup } from '@/types/website'

interface UseSecondaryGroupDndProps {
  id: string
  secondaryGroup: SecondaryGroup
  disabled?: boolean
}

interface UseSecondaryGroupDndReturn {
  // 拖拽相关属性
  attributes: any
  listeners: any
  setNodeRef: (node: HTMLElement | null) => void
  transform: string | null
  transition: string | null

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

export function useSecondaryGroupDnd({
  id,
  secondaryGroup,
  disabled = false
}: UseSecondaryGroupDndProps): UseSecondaryGroupDndReturn {
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
      type: 'secondaryGroup',
      secondaryGroup
    }
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 1000 : 'auto'
  }

  const dragHandleStyle: React.CSSProperties = {
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 1 : 0.6,
    transition: 'opacity 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    marginRight: '8px'
  }

  const handleDragStart = useCallback(() => {
    // 可以在这里添加自定义逻辑，比如播放声音、显示提示等
  }, [id, secondaryGroup.name])

  const handleDragEnd = useCallback(() => {
    // 可以在这里添加自定义逻辑
  }, [id])

  return {
    // 拖拽相关属性
    attributes,
    listeners,
    setNodeRef,
    transform: CSS.Transform.toString(transform) || null,
    transition: transition || null,

    // 状态
    isDragging,
    isOver,
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
export function useBasicSecondaryGroupDnd(id: string, disabled = false) {
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
