import { clsx } from 'clsx'
import { PanelLeftClose, PanelLeftOpen, TrendingUp } from 'lucide-react'
import { ApiStatusIndicator } from '../shared/ApiStatusIndicator'
import { QUICK_TIMEFRAMES, EXTRA_TIMEFRAMES } from '../../utils/timeframes'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  symbol: string
  interval: string
  loading: boolean
  onSymbolChange: (s: string) => void
  onIntervalChange: (i: string) => void
  onAnalyze: () => void
}

export function Header({
  sidebarCollapsed,
  onToggleSidebar,
  symbol,
  interval,
  loading,
  onSymbolChange,
  onIntervalChange,
  onAnalyze,
}: HeaderProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onAnalyze()
    if (e.key === 'Escape') e.currentTarget.blur()
  }

  const extraActive = (EXTRA_TIMEFRAMES as readonly string[]).includes(interval)

  return (
    <header className="flex-shrink-0 flex items-center gap-2 px-3 h-12 border-b border-border-subtle bg-surface-900 z-10">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-surface-700 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900"
        aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 border-r border-border-subtle flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center">
          <TrendingUp size={12} className="text-white" />
        </div>
        <span className="text-sm font-bold text-slate-100 tracking-tight hidden sm:block">Sentinel</span>
      </div>

      {/* Symbol input */}
      <input
        type="text"
        value={symbol}
        onChange={e => onSymbolChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="BTCUSDT"
        spellCheck={false}
        aria-label="Trading symbol"
        className="w-28 h-7 px-2 bg-surface-700 border border-border-subtle rounded-md text-xs text-slate-200
                   placeholder-slate-500 uppercase font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/60
                   focus:border-blue-500/40 transition-all duration-150"
      />

      {/* Timeframe quick buttons + overflow select */}
      <div className="flex items-center gap-0.5" role="group" aria-label="Timeframe">
        {QUICK_TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => onIntervalChange(tf)}
            className={clsx(
              'h-7 px-2 text-xs font-medium rounded-md transition-all duration-100',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500',
              interval === tf
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:text-slate-300 hover:bg-surface-700',
            )}
          >
            {tf}
          </button>
        ))}

        <select
          value={extraActive ? interval : ''}
          onChange={e => { if (e.target.value) onIntervalChange(e.target.value) }}
          aria-label="More timeframes"
          className={clsx(
            'h-7 px-1.5 text-xs font-medium rounded-md cursor-pointer transition-all duration-100',
            'bg-surface-700 border border-border-subtle focus:outline-none focus:ring-1 focus:ring-blue-500/60',
            extraActive ? 'text-white bg-blue-600 border-transparent' : 'text-slate-500 hover:text-slate-300',
          )}
        >
          <option value="">More</option>
          {EXTRA_TIMEFRAMES.map(tf => (
            <option key={tf} value={tf}>{tf}</option>
          ))}
        </select>
      </div>

      {/* Spacer */}
      <div className="flex-1" aria-hidden="true" />

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="btn-primary h-7 px-4 text-xs flex items-center gap-1.5
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900"
      >
        {loading ? (
          <>
            <span
              aria-hidden="true"
              className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"
            />
            Analyzing…
          </>
        ) : (
          'Analyze'
        )}
      </button>

      {/* API status */}
      <ApiStatusIndicator />
    </header>
  )
}
