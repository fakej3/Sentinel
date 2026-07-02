import { clsx } from 'clsx'
import { PanelLeftClose, PanelLeftOpen, TrendingUp, Menu, Wifi, WifiOff } from 'lucide-react'
import { QUICK_TIMEFRAMES, EXTRA_TIMEFRAMES } from '../../utils/timeframes'
import { useApiStatus } from '../../hooks/useApiStatus'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onOpenMobileMenu: () => void
  symbol: string
  interval: string
  loading: boolean
  onSymbolChange: (s: string) => void
  onIntervalChange: (i: string) => void
  onAnalyze: () => void
}

function ApiDot() {
  const status = useApiStatus()
  return (
    <div
      className={clsx(
        'flex items-center gap-1 text-[10px] font-medium flex-shrink-0',
        status === 'connected' && 'text-emerald-400',
        status === 'offline'   && 'text-red-400',
        status === 'checking'  && 'text-slate-500',
      )}
      title={
        status === 'connected' ? 'API connected'
        : status === 'offline' ? 'API offline'
        : 'Checking API…'
      }
    >
      {status === 'offline'
        ? <WifiOff size={11} />
        : <Wifi size={11} className={status === 'checking' ? 'opacity-40' : ''} />
      }
      <span className="hidden xl:inline">
        {status === 'connected' ? 'Connected' : status === 'offline' ? 'Offline' : 'Checking…'}
      </span>
    </div>
  )
}

export function Header({
  sidebarCollapsed,
  onToggleSidebar,
  onOpenMobileMenu,
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
    <header className="sticky top-0 z-50 flex-shrink-0 flex items-center gap-1.5 px-3 h-11 border-b border-border-subtle bg-surface-900">
      {/* Mobile hamburger */}
      <button
        onClick={onOpenMobileMenu}
        className="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300
                   hover:bg-surface-700 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Open menu"
      >
        <Menu size={15} />
      </button>

      {/* Desktop sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="hidden lg:flex w-8 h-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-300
                   hover:bg-surface-700 transition-colors duration-150
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900"
        aria-label={sidebarCollapsed ? 'Open sidebar' : 'Close sidebar'}
      >
        {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-1.5 pr-2.5 border-r border-border-subtle flex-shrink-0 mr-1">
        <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
          <TrendingUp size={11} className="text-white" />
        </div>
        <span className="text-xs font-bold text-slate-200 tracking-tight hidden sm:block">Sentinel</span>
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
        className="h-8 w-28 px-2 bg-surface-700 border border-border-subtle rounded-md text-xs text-slate-200
                   placeholder-slate-500 uppercase font-mono focus:outline-none focus:ring-1
                   focus:ring-blue-500/60 focus:border-blue-500/40 transition-all duration-150"
      />

      {/* Separator */}
      <div className="w-px h-4 bg-border-subtle flex-shrink-0 mx-0.5" />

      {/* Timeframe quick buttons */}
      <div className="hidden sm:flex items-center gap-0.5" role="group" aria-label="Timeframe">
        {QUICK_TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => onIntervalChange(tf)}
            className={clsx(
              'h-8 px-2 text-[11px] font-medium rounded-md transition-colors duration-100',
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
            'h-8 px-1.5 text-[11px] font-medium rounded-md cursor-pointer transition-colors duration-100',
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

      {/* API status */}
      <ApiDot />

      {/* Separator */}
      <div className="w-px h-4 bg-border-subtle flex-shrink-0 mx-0.5" />

      {/* Analyze button */}
      <button
        onClick={onAnalyze}
        disabled={loading || !symbol.trim()}
        className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md
                   transition-colors duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   disabled:active:scale-100 flex items-center gap-1.5
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900"
      >
        {loading ? (
          <>
            <span aria-hidden="true" className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing…
          </>
        ) : (
          'Analyze'
        )}
      </button>
    </header>
  )
}
