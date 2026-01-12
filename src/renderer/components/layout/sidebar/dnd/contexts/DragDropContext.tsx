/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimation,
  MeasuringStrategy
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  SortingStrategy
} from '@dnd-kit/sortable'

import {
  DragDropState,
  DragEndResult,
  DragDropConfig,
  defaultDragDropConfig
} from '../types/dnd.types'

interface DragDropContextType {
  state: DragDropState
  startDrag: (id: string, type: 'secondaryGroup' | 'website') => void
  endDrag: (result: DragEndResult) => void
  cancelDrag: () => void
  config: DragDropConfig
}

const DragDropContext = createContext<DragDropContextType | undefined>(undefined)

interface DragDropProviderProps {
  children: ReactNode
  onDragEnd?: (result: DragEndResult) => void
  onDragStart?: (id: string, type: 'secondaryGroup' | 'website') => void
  config?: Partial<DragDropConfig>
}

const defaultDropAnimationConfig = {
  ...defaultDropAnimation,
  dragSourceOpacity: 0.5
}

export function DragDropProvider({
  children,
  onDragEnd,
  onDragStart,
  config = {}
}: DragDropProviderProps): React.JSX.Element {
  const [state, setState] = useState<DragDropState>({
    activeId: null,
    overId: null,
    isDragging: false,
    dragType: null,
    insertPosition: undefined
  })

  const mergedConfig = { ...defaultDragDropConfig, ...config }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // 需要移动8像素才开始拖拽
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const activeId = active.id.toString()

      // 从拖拽数据中获取类型，而不是通过ID前缀判断
      const dragData = active.data.current
      let dragType: 'secondaryGroup' | 'website' = 'secondaryGroup'

      if (dragData) {
        // 根据数据中的type字段判断
        if (dragData.type === 'website') {
          dragType = 'website'
        } else if (dragData.type === 'secondaryGroup') {
          dragType = 'secondaryGroup'
        } else {
          // 如果没有type字段，尝试通过数据结构判断
          if (dragData.website) {
            dragType = 'website'
          } else if (dragData.secondaryGroup) {
            dragType = 'secondaryGroup'
          }
        }
      }

      setState((prev) => ({
        ...prev,
        activeId,
        isDragging: true,
        dragType,
        insertPosition: undefined
      }))

      if (onDragStart) {
        onDragStart(activeId, dragType)
      }
    },
    [onDragStart]
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event

    if (!over) {
      setState((prev) => ({ ...prev, overId: null, insertPosition: undefined }))
      return
    }

    const overId = over.id.toString()

    // 计算插入位置：根据鼠标在目标元素上的位置判断
    // 如果鼠标在元素的上半部分，插入到上方；否则插入到下方
    let insertPosition: 'above' | 'below' | undefined = undefined

    // 使用 @dnd-kit 的 rect 属性
    const overRect = over.rect
    const activeRect = active.rect.current?.translated || active.rect.current?.initial

    if (overRect && activeRect) {
      // 获取目标元素的中心点
      const overCenterY = overRect.top + overRect.height / 2

      // 获取拖拽元素的中心点
      const activeCenterY = activeRect.top + activeRect.height / 2

      // 如果拖拽元素的中心点在目标元素中心点上方，则插入到上方
      insertPosition = activeCenterY < overCenterY ? 'above' : 'below'
    }

    setState((prev) => ({
      ...prev,
      overId,
      insertPosition
    }))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      const result: DragEndResult = {
        activeId: active.id.toString(),
        overId: over?.id?.toString() || null,
        type: state.dragType || 'secondaryGroup',
        insertPosition: state.insertPosition || 'below'
      }

      setState({
        activeId: null,
        overId: null,
        isDragging: false,
        dragType: null,
        insertPosition: undefined
      })

      if (onDragEnd) {
        onDragEnd(result)
      }
    },
    [onDragEnd, state.dragType, state.insertPosition]
  )

  const handleDragCancel = useCallback(() => {
    setState({
      activeId: null,
      overId: null,
      isDragging: false,
      dragType: null,
      insertPosition: undefined
    })
  }, [])

  const contextValue: DragDropContextType = {
    state,
    startDrag: (id, type) => {
      setState((prev) => ({
        ...prev,
        activeId: id,
        isDragging: true,
        dragType: type,
        insertPosition: undefined
      }))
    },
    endDrag: (result) => {
      setState({
        activeId: null,
        overId: null,
        isDragging: false,
        dragType: null,
        insertPosition: undefined
      })
      if (onDragEnd) {
        onDragEnd(result)
      }
    },
    cancelDrag: handleDragCancel,
    config: mergedConfig
  }

  return (
    <DragDropContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always
          }
        }}
      >
        {children}
        <DragOverlay dropAnimation={defaultDropAnimationConfig}>
          {/* 拖拽覆盖层内容由具体组件提供 */}
        </DragOverlay>
      </DndContext>
    </DragDropContext.Provider>
  )
}

export function useDragDrop(): DragDropContextType {
  const context = useContext(DragDropContext)
  if (context === undefined) {
    throw new Error('useDragDrop must be used within a DragDropProvider')
  }
  return context
}

export function SortableContainer({
  items,
  strategy = verticalListSortingStrategy,
  children
}: {
  items: string[]
  strategy?: SortingStrategy
  children: ReactNode
}): React.JSX.Element {
  return (
    <SortableContext items={items} strategy={strategy}>
      {children}
    </SortableContext>
  )
}

export function useSortableContainer(
  items: string[],
  strategy: SortingStrategy = verticalListSortingStrategy
): { sortableProps: { items: string[]; strategy: SortingStrategy } } {
  return {
    sortableProps: {
      items,
      strategy
    }
  }
}
