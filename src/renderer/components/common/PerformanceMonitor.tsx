import React, { Profiler, ProfilerOnRenderCallback } from 'react'

interface PerformanceMonitorProps {
  id: string
  children: React.ReactNode
  onRender?: ProfilerOnRenderCallback
  enabled?: boolean
}

// 默认的性能回调函数
const defaultOnRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) => {
  // 在开发环境下输出性能信息
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Performance] ${id}:`, {
      phase,
      actualDuration: `${actualDuration.toFixed(2)}ms`,
      baseDuration: `${baseDuration.toFixed(2)}ms`,
      startTime,
      commitTime
    })

    // 如果渲染时间超过16ms（约60fps），发出警告
    if (actualDuration > 16) {
      console.warn(`[Performance Warning] ${id} took ${actualDuration.toFixed(2)}ms to render`)
    }
  }

  // 在生产环境中可以发送到监控服务
  // if (process.env.NODE_ENV === 'production') {
  //   // 发送性能数据到监控服务
  //   performanceMonitor.track({
  //     componentId: id,
  //     phase,
  //     actualDuration,
  //     baseDuration,
  //     startTime,
  //     commitTime,
  //     interactionCount: interactions?.size || 0
  //   })
  // }
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  id,
  children,
  onRender = defaultOnRender,
  enabled = true
}): React.ReactElement => {
  if (!enabled) {
    return <>{children}</>
  }

  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  )
}

// 高阶组件版本，用于包装现有组件
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentId: string,
  onRender?: ProfilerOnRenderCallback
): React.ComponentType<P> {
  const WrappedComponent = (props: P): React.ReactElement => (
    <PerformanceMonitor id={componentId} onRender={onRender}>
      <Component {...props} />
    </PerformanceMonitor>
  )

  WrappedComponent.displayName = `withPerformanceMonitoring(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default PerformanceMonitor
