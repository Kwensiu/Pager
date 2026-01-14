import React from 'react'
import { Folder, ChevronRight, ChevronDown } from 'lucide-react'
import { SecondaryGroup, Website } from '@/types/website'
import { SortableWebsiteList } from './SortableWebsiteItem'
import { DragHandle } from './DragHandle'
import { useSecondaryGroupDnd } from '../hooks/useSecondaryGroupDnd'
import { SortableContainer } from '../contexts/DragDropContext'

interface SortableSecondaryGroupProps {
  /** 二级分组数据 */
  secondaryGroup: SecondaryGroup
  /** 是否激活 */
  active?: boolean
  /** 是否禁用拖拽 */
  disabled?: boolean
  /** 点击事件处理器 */
  onClick?: () => void
  /** 右键菜单事件处理器 */
  onContextMenu?: (e: React.MouseEvent) => void
  /** 网站点击事件处理器 */
  onWebsiteClick?: (website: Website) => void
  /** 网站编辑事件处理器 */
  onWebsiteEdit?: (website: Website) => void
  /** 网站删除事件处理器 */
  onWebsiteDelete?: (websiteId: string) => void
  /** 添加网站事件处理器 */
  onAddWebsite?: () => void
  /** 当前激活的网站ID */
  activeWebsiteId?: string | null
  /** 自定义类名 */
  className?: string
  /** 是否折叠状态 */
  isCollapsed?: boolean
}

const SortableSecondaryGroupComponent: React.FC<SortableSecondaryGroupProps> = ({
  secondaryGroup,
  active = false,
  disabled = false,
  onClick,
  onContextMenu,
  onWebsiteClick,
  onWebsiteEdit,
  onWebsiteDelete,
  onAddWebsite,
  activeWebsiteId = null,
  className = '',
  isCollapsed = false
}) => {
  const { attributes, listeners, setNodeRef, style, dragHandleStyle, isDragging, isOver } =
    useSecondaryGroupDnd({
      id: secondaryGroup.id,
      secondaryGroup,
      disabled
    })

  const isExpanded = secondaryGroup.expanded !== false

  // 处理分组点击
  const handleGroupClick = (): void => {
    if (onClick && !isDragging) {
      onClick()
    }
  }

  // 处理右键菜单 - 如果外部提供了onContextMenu则调用，否则不阻止默认行为
  const handleContextMenu = (e: React.MouseEvent): void => {
    if (onContextMenu) {
      e.preventDefault()
      onContextMenu(e)
    }
    // 如果没有提供onContextMenu，让事件冒泡，这样外层的ContextMenuTrigger可以处理
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        sortable-secondary-group
        relative
        rounded-lg
        transition-all
        duration-200
        ${!isCollapsed ? 'border' : ''}
        ${active ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30'}
        ${isDragging ? 'shadow-lg opacity-50' : ''}
        ${isOver && !isDragging ? 'border-primary/40 bg-primary/5' : ''}
        ${isCollapsed ? 'my-1' : ''}
        ${className}
      `}
      onContextMenu={handleContextMenu}
      data-testid={`secondary-group-${secondaryGroup.id}`}
      data-dragging={isDragging}
      data-secondary-group-id={secondaryGroup.id}
      {...attributes}
    >
      {/* 放置指示器 */}
      {isOver && !isDragging && (
        <div className="absolute inset-0 bg-primary/10 rounded-lg pointer-events-none animate-pulse" />
      )}

      {/* 分组头部 */}
      <div
        className={`flex items-center ${isCollapsed ? 'justify-center p-1.5 cursor-pointer hover:bg-accent/50' : 'p-2'}`}
        onClick={isCollapsed ? handleGroupClick : undefined}
        role={isCollapsed ? 'button' : undefined}
        tabIndex={isCollapsed ? 0 : undefined}
        onKeyDown={(e) => {
          if (isCollapsed && (e.key === 'Enter' || e.key === ' ')) {
            handleGroupClick()
            e.preventDefault()
          }
        }}
      >
        {/* 拖拽手柄 - 折叠状态下隐藏 */}
        {!isCollapsed && (
          <div
            className="mr-2"
            style={dragHandleStyle}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            role="button"
            aria-label="拖拽分组"
            tabIndex={0}
          >
            <DragHandle isDragging={isDragging} disabled={disabled} />
          </div>
        )}

        {/* 文件夹图标 */}
        <Folder className={`${isCollapsed ? '' : 'mr-2'} h-4 w-4 text-muted-foreground`} />

        {/* 分组名称 - 折叠状态下显示垂直文字 */}
        {isCollapsed ? (
          <span className="text-[10px] font-medium text-foreground ml-0.5 leading-tight writing-mode-vertical text-center max-h-8 overflow-hidden">
            {secondaryGroup.name}
          </span>
        ) : (
          <div
            className="flex-1 font-medium text-foreground cursor-pointer"
            onClick={handleGroupClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleGroupClick()
                e.preventDefault()
              }
            }}
          >
            {secondaryGroup.name}
          </div>
        )}

        {/* 展开/收起图标 - 折叠状态下隐藏 */}
        {!isCollapsed && (
          <button
            className="ml-2 p-1 rounded hover:bg-accent"
            onClick={handleGroupClick}
            aria-label={isExpanded ? '收起分组' : '展开分组'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* 网站列表（展开时显示） */}
      {isExpanded && (
        <div className="pl-2 pr-2 pb-2">
          {/* 网站列表 */}
          {secondaryGroup.websites.length > 0 && (
            <SortableContainer items={secondaryGroup.websites.map((w) => w.id)}>
              <SortableWebsiteList
                websites={secondaryGroup.websites}
                secondaryGroupId={secondaryGroup.id}
                activeWebsiteId={activeWebsiteId}
                onWebsiteClick={onWebsiteClick}
                onWebsiteEdit={onWebsiteEdit}
                onWebsiteDelete={onWebsiteDelete}
                className="space-y-1"
                isCollapsed={isCollapsed}
              />
            </SortableContainer>
          )}

          {/* 添加网站按钮 - 折叠状态下隐藏 */}
          {onAddWebsite && !isCollapsed && (
            <button
              className={`
                w-full
                ${secondaryGroup.websites.length > 0 ? 'mt-1' : 'mt-0'}
                py-1.5
                px-2
                text-sm
                text-muted-foreground
                rounded
                hover:bg-accent
                hover:text-accent-foreground
                transition-colors
                duration-150
                flex
                items-center
              `}
              onClick={(e) => {
                e.stopPropagation()
                onAddWebsite()
              }}
            >
              <span className="mr-1">+</span>
              添加网站
            </button>
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
            rounded-lg
            pointer-events-none
          "
        />
      )}
    </div>
  )
}

// 使用 memo 包装组件以提高性能
export const SortableSecondaryGroup = React.memo(
  SortableSecondaryGroupComponent,
  (prevProps, nextProps) => {
    // 自定义比较函数，只在必要时重新渲染
    // 检查所有可能影响渲染的属性，包括深层对象的比较
    if (
      prevProps.secondaryGroup.id !== nextProps.secondaryGroup.id ||
      prevProps.secondaryGroup.name !== nextProps.secondaryGroup.name ||
      prevProps.secondaryGroup.expanded !== nextProps.secondaryGroup.expanded ||
      prevProps.active !== nextProps.active ||
      prevProps.disabled !== nextProps.disabled ||
      prevProps.isCollapsed !== nextProps.isCollapsed
    ) {
      return false
    }

    // 深度比较 websites 数组
    if (prevProps.secondaryGroup.websites.length !== nextProps.secondaryGroup.websites.length) {
      return false
    }

    // 检查每个网站的关键属性
    for (let i = 0; i < prevProps.secondaryGroup.websites.length; i++) {
      const prevWebsite = prevProps.secondaryGroup.websites[i]
      const nextWebsite = nextProps.secondaryGroup.websites[i]

      if (
        prevWebsite.id !== nextWebsite.id ||
        prevWebsite.name !== nextWebsite.name ||
        prevWebsite.url !== nextWebsite.url
      ) {
        return false
      }
    }

    return true
  }
)

// 简化版本，用于列表渲染
export const SimpleSortableSecondaryGroup: React.FC<{
  id: string
  name: string
  isExpanded?: boolean
  disabled?: boolean
}> = ({ id, name, isExpanded = true, disabled = false }) => {
  const { setNodeRef, style, isDragging } = useSecondaryGroupDnd({
    id,
    secondaryGroup: {
      id,
      name,
      websites: [],
      order: 0,
      primaryGroupId: '',
      createdAt: 0,
      updatedAt: 0
    },
    disabled
  })

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center p-2 rounded border
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <DragHandle isDragging={isDragging} disabled={disabled} />
      <Folder className="mr-2 h-4 w-4" />
      <span className="flex-1">{name}</span>
      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </div>
  )
}
