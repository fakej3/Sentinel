import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false }
  private copyTimer: ReturnType<typeof setTimeout> | null = null

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in all builds so developers can see the error
    console.error('[Sentinel] Uncaught error:', error, info.componentStack)
  }

  componentWillUnmount() {
    if (this.copyTimer !== null) clearTimeout(this.copyTimer)
  }

  private copyDetails = () => {
    const { error } = this.state
    if (!error) return
    const text = `Sentinel ${__APP_VERSION__} — unhandled error\n\n${error.name}: ${error.message}`
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true })
      if (this.copyTimer !== null) clearTimeout(this.copyTimer)
      this.copyTimer = setTimeout(() => this.setState({ copied: false }), 2000)
    }).catch(() => {})
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children

    return (
      <div className="h-screen flex items-center justify-center bg-surface-950 p-6">
        <div className="max-w-md w-full space-y-5">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
            <h1 className="text-sm font-semibold text-slate-200">Something went wrong</h1>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Sentinel encountered an unexpected error. Your data is safe.
            Reloading the app will restore normal operation.
          </p>

          <div className="rounded-lg border border-border-subtle bg-surface-900 px-3 py-2.5">
            <p className="text-[11px] font-mono text-slate-500 break-all">
              {error.name}: {error.message}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border
                         text-slate-300 border-slate-600 hover:border-slate-400 hover:text-slate-100
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500
                         transition-colors"
            >
              <RefreshCw size={11} />
              Reload
            </button>
            <button
              onClick={this.copyDetails}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border
                         border-border-subtle text-slate-500 hover:text-slate-400
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-500
                         transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
