import React from 'react'
import { GripVertical } from 'lucide-react'

interface DragHandleProps {
  /** 是否正在拖拽 */
  isDragging?: boolean
  /** 是否禁用 */
  disabled?: boolean
  /** 点击事件处理器 */
  onClick?: (e: React.MouseEvent) => void
  /** 自定义类名 */
  className?: string
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 是否显示提示文本 */
  showTooltip?: boolean
}

export const DragHandle: React.FC<DragHandleProps> = ({
  isDragging = false,
  disabled = false,
  onClick,
  className = '',
  size = 'md',
  showTooltip = true
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const handleClick = (e: React.MouseEvent): void => {
    e.stopPropagation()
    if (onClick && !disabled) {
      onClick(e)
    }
  }

  return (
    <div
      className={`
        drag-handle
        inline-flex
        items-center
        justify-center
        rounded
        transition-all
        duration-200
        ${disabled ? 'cursor-not-allowed opacity-30' : isDragging ? 'cursor-grabbing opacity-100' : 'cursor-grab opacity-70 hover:opacity-100'}
        ${sizeClasses[size]}
        ${className}
      `}
      onClick={handleClick}
      role="button"
      aria-label={disabled ? '拖拽已禁用' : '拖拽手柄'}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      title={showTooltip ? (disabled ? '拖拽已禁用' : '拖拽排序') : undefined}
    >
      <GripVertical
        className={`w-full h-full ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}
        strokeWidth={1.5}
      />

      {/* 键盘导航提示（仅对屏幕阅读器可见） */}
      <span className="sr-only">
        按空格键开始拖拽，使用方向键移动，按Enter键放置，按Escape键取消
      </span>
    </div>
  )
}

// 用于二级分组的拖拽手柄
export const SecondaryGroupDragHandle: React.FC<Omit<DragHandleProps, 'size'>> = (props) => {
  return <DragHandle {...props} size="md" className={`mr-2 ${props.className || ''}`} />
}

// 用于网站的拖拽手柄
export const WebsiteDragHandle: React.FC<Omit<DragHandleProps, 'size'>> = (props) => {
  return <DragHandle {...props} size="sm" className={`mr-1.5 ${props.className || ''}`} />
}

// 简化版本，仅图标
export const SimpleDragHandle: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  return (
    <div
      className={`
        inline-flex items-center justify-center
        ${disabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab opacity-70'}
      `}
      role="button"
      aria-label="拖拽"
      aria-disabled={disabled}
    >
      <GripVertical className="w-4 h-4" strokeWidth={1.5} />
    </div>
  )
}
