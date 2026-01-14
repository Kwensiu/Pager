import React, { memo, useCallback } from 'react'
import { Website } from '@/types/website'
import { DragHandle } from './DragHandle'
import { DropIndicator } from './DropIndicator'
import { useWebsiteDnd } from '../hooks/useWebsiteDnd'
import { Favicon } from '@/components/features/Favicon'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem
} from '@/ui/context-menu'

interface SortableWebsiteItemProps {
  /** 网站数据 */
  website: Website
  /** 所属二级分组ID（可选） */
  secondaryGroupId?: string
  /** 所属一级分类ID（可选） */
  primaryGroupId?: string
  /** 是否激活 */
  active?: boolean
  /** 是否禁用拖拽 */
  disabled?: boolean
  /** 点击事件处理器 */
  onClick?: (website: Website) => void
  /** 编辑事件处理器 */
  onEdit?: (website: Website) => void
  /** 删除事件处理器 */
  onDelete?: (websiteId: string) => void
  /** 自定义类名 */
  className?: string
  /** 是否显示拖拽手柄 */
  showDragHandle?: boolean
  /** 是否折叠状态 */
  isCollapsed?: boolean
}

const SortableWebsiteItemComponent: React.FC<SortableWebsiteItemProps> = ({
  website,
  secondaryGroupId,
  primaryGroupId,
  active = false,
  disabled = false,
  onClick,
  onEdit,
  onDelete,
  className = '',
  showDragHandle = true,
  isCollapsed = false
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    style,
    dragHandleStyle,
    isDragging,
    isOver,
    insertPosition
  } = useWebsiteDnd({
    id: website.id,
    website,
    secondaryGroupId,
    primaryGroupId,
    disabled
  })

  // 处理点击事件 - 使用useCallback避免不必要的重新创建
  const handleClick = useCallback((): void => {
    if (onClick && !isDragging) {
      onClick(website)
    }
  }, [onClick, isDragging, website])

  // 处理键盘事件 - 使用useCallback
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleClick()
        e.preventDefault()
      }
    },
    [handleClick]
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={`
            sortable-website-item
            relative
            flex
            items-center
            ${isCollapsed ? 'justify-center px-0' : 'px-1'}
            py-1.5
            rounded-md
            transition-all
            duration-200
            ${active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
            ${isDragging ? 'shadow opacity-50' : ''}
            ${isOver && !isDragging ? 'bg-accent/30' : ''}
            ${className}
          `}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`访问 ${website.name}`}
          aria-current={active ? 'page' : undefined}
          data-testid={`website-${website.id}`}
          data-dragging={isDragging}
          data-website-id={website.id}
          {...attributes}
        >
          {/* 放置指示器 - 根据insertPosition显示在顶部或底部 */}
          {isOver && !isDragging && (
            <DropIndicator
              isActive={isOver}
              position={insertPosition === 'above' ? 'top' : 'bottom'}
              type="over"
              animated
              showArrow={false}
            />
          )}

          {/* 拖拽手柄 - 折叠状态下隐藏 */}
          {showDragHandle && !disabled && !isCollapsed && (
            <div
              className="mr-1.5"
              style={dragHandleStyle}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              role="button"
              aria-label="拖拽网站"
              tabIndex={0}
            >
              <DragHandle
                isDragging={isDragging}
                disabled={disabled}
                size="sm"
                showTooltip={false}
              />
            </div>
          )}

          {/* 网站图标 */}
          <div className={`${isCollapsed ? '' : 'mr-2'} flex-shrink-0`}>
            <Favicon url={website.url} className="h-6 w-6" />
          </div>

          {/* 网站名称 - 折叠状态下隐藏 */}
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <span className="text-sm truncate block">{website.name}</span>
              {website.description && (
                <span className="text-xs text-muted-foreground truncate block">
                  {website.description}
                </span>
              )}
            </div>
          )}

          {/* 拖拽时的覆盖层效果 */}
          {isDragging && (
            <div
              className="
            absolute
            inset-0
            bg-primary/5
            rounded-md
            pointer-events-none
          "
            />
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEdit?.(website)}>修改</ContextMenuItem>
        <ContextMenuItem
          className="text-red-600 focus:bg-red-100 dark:focus:bg-red-900"
          onClick={() => onDelete?.(website.id)}
        >
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// 使用memo包装组件以提高性能
export const SortableWebsiteItem = memo(SortableWebsiteItemComponent)

// 简化版本，用于列表渲染
export const SimpleSortableWebsiteItem: React.FC<{
  id: string
  name: string
  url: string
  secondaryGroupId: string
  disabled?: boolean
}> = ({ id, name, url, secondaryGroupId, disabled = false }) => {
  const { setNodeRef, style, isDragging } = useWebsiteDnd({
    id,
    website: { id, name, url, order: 0, createdAt: 0, updatedAt: 0 },
    secondaryGroupId,
    disabled
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center p-2 rounded
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <DragHandle isDragging={isDragging} disabled={disabled} size="sm" />
      <Favicon url={url} className="mr-2 h-6 w-6" />
      <span className="flex-1 text-sm truncate">{name}</span>
    </div>
  )
}

// 用于网站列表的容器组件
interface SortableWebsiteListProps {
  /** 网站列表 */
  websites: Website[]
  /** 所属二级分组ID（可选） */
  secondaryGroupId?: string
  /** 所属一级分类ID（可选） */
  primaryGroupId?: string
  /** 当前激活的网站ID */
  activeWebsiteId?: string | null
  /** 是否禁用拖拽 */
  disabled?: boolean
  /** 网站点击事件处理器 */
  onWebsiteClick?: (website: Website) => void
  /** 网站编辑事件处理器 */
  onWebsiteEdit?: (website: Website) => void
  /** 网站删除事件处理器 */
  onWebsiteDelete?: (websiteId: string) => void
  /** 自定义类名 */
  className?: string
  /** 是否折叠状态 */
  isCollapsed?: boolean
}

export const SortableWebsiteList: React.FC<SortableWebsiteListProps> = ({
  websites,
  secondaryGroupId,
  primaryGroupId,
  activeWebsiteId = null,
  disabled = false,
  onWebsiteClick,
  onWebsiteEdit,
  onWebsiteDelete,
  className = '',
  isCollapsed = false
}) => {
  // 按order字段排序
  const sortedWebsites = [...websites].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  return (
    <div className={`space-y-1 ${className}`}>
      {sortedWebsites.map((website) => (
        <SortableWebsiteItem
          key={website.id}
          website={website}
          secondaryGroupId={secondaryGroupId}
          primaryGroupId={primaryGroupId}
          active={activeWebsiteId === website.id}
          disabled={disabled}
          onClick={onWebsiteClick}
          onEdit={onWebsiteEdit}
          onDelete={onWebsiteDelete}
          showDragHandle={true} // 修复：二级分组内的网站按钮应该显示拖拽手柄
          isCollapsed={isCollapsed}
        />
      ))}
    </div>
  )
}
