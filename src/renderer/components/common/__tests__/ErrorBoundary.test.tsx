import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ErrorBoundary from '../ErrorBoundary'

// Mock console.error to avoid noise in tests
const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

// Component that throws an error
const ThrowError: React.FC = (): React.ReactElement => {
  React.useEffect(() => {
    throw new Error('Test error')
  }, [])
  return <div>Should not render</div>
}

// Normal component
const NormalComponent: React.FC = () => {
  return <div>Normal component</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    consoleError.mockClear()
  })

  afterAll(() => {
    consoleError.mockRestore()
  })

  it('renders children when no error occurs', async (): Promise<void> => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Normal component')).toBeInTheDocument()
  })

  it('renders fallback UI when an error occurs', async (): Promise<void> => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('出现错误')).toBeInTheDocument()
    })

    expect(screen.getByText('重试')).toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith('ErrorBoundary caught an error:', expect.any(Error), expect.any(Object))
  })

  it('renders custom fallback when provided', async (): Promise<void> => {
    const CustomFallback = () => <div>Custom error message</div>

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <ThrowError />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('Custom error message')).toBeInTheDocument()
    })
  })

  it('allows retry after error', async (): Promise<void> => {
    const user = userEvent.setup()

    // First render with error
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(screen.getByText('出现错误')).toBeInTheDocument()
    })

    // Click retry button
    await user.click(screen.getByText('重试'))

    // Rerender with normal component
    rerender(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Normal component')).toBeInTheDocument()
  })

  it('calls componentDidCatch with error and error info', async (): Promise<void> => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    )

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      )
    })
  })
})
