import { Component, type ErrorInfo, type ReactNode } from 'react'
import i18next from '../i18n'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * ErrorBoundary — 捕获渲染错误，防止整个 UI 崩溃为白屏。
 * 在开发模式下显示错误详情；生产模式显示简洁的恢复提示。
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(i18next.t('error.captured'), error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state
      const t = i18next.t.bind(i18next)
      return (
        <div style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a2e',
          color: '#e0e0e0',
          fontFamily: 'system-ui, monospace',
        }}>
          <div style={{
            maxWidth: 640,
            padding: 32,
            backgroundColor: '#16213e',
            borderRadius: 8,
            border: '1px solid #e74c3c',
            boxShadow: '0 4px 24px rgba(231,76,60,0.3)',
          }}>
            <h2 style={{ color: '#e74c3c', margin: '0 0 8px', fontSize: 20 }}>
              ⚠️ {t('error.title')}
            </h2>
            <p style={{ color: '#999', margin: '0 0 16px', fontSize: 13 }}>
              {t('error.message')}
            </p>
            <div style={{
              backgroundColor: '#0f0f23',
              borderRadius: 4,
              padding: 12,
              marginBottom: 16,
              maxHeight: 240,
              overflow: 'auto',
              fontSize: 11,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              border: '1px solid #333',
            }}>
              <div style={{ color: '#e74c3c', fontWeight: 700, marginBottom: 4 }}>
                {error?.name}: {error?.message}
              </div>
              {error?.stack && (
                <div style={{ color: '#888', fontSize: 10 }}>
                  {error.stack}
                </div>
              )}
              {errorInfo?.componentStack && (
                <div style={{ color: '#666', fontSize: 10, marginTop: 8, borderTop: '1px solid #333', paddingTop: 8 }}>
                  Component Stack:{'\n'}{errorInfo.componentStack}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReset}
              style={{
                padding: '8px 24px',
                backgroundColor: '#e74c3c',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('error.tryRecover')}
            </button>
            <span style={{ color: '#666', fontSize: 11, marginLeft: 12 }}>
              {t('error.recoverHint')}
            </span>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
