import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.FC<{ error?: Error; resetError: () => void }>
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorFallbackProps {
  error?: Error
  resetError: () => void
  title?: string
  message?: string
  buttonText?: string
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  resetError = (): void => {
    this.setState({ hasError: false, error: undefined })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />
    }

    return this.props.children
  }
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
  title = '出现错误',
  message = '组件渲染时发生未知错误',
  buttonText = '重试'
}): React.ReactElement => (
  <div className="flex flex-col items-center justify-center min-h-[200px] p-4 bg-red-50 border border-red-200 rounded-md">
    <div className="text-red-600 font-semibold mb-2">{title}</div>
    <div className="text-red-500 text-sm mb-4 text-center">{error?.message || message}</div>
    <button
      onClick={resetError}
      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
    >
      {buttonText}
    </button>
  </div>
)

export default ErrorBoundary
