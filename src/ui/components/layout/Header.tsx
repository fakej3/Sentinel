import { useState, useRef, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import { PanelLeftClose, PanelLeftOpen, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import { QUICK_TIMEFRAMES, EXTRA_TIMEFRAMES } from '../../utils/timeframes'
import { useApiStatus } from '../../hooks/useApiStatus'
import { searchSymbols } from '../../utils/symbolSearch'
import type { SymbolSuggestion } from '../../utils/symbolSearch'

interface HeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  symbol: string
  interval: string
  loading: boolean
  stage: string | null
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
  symbol,
  interval,
  loading,
  stage,
  onSymbolChange,
  onIntervalChange,
  onAnalyze,
}: HeaderProps) {
  const [suggestions, setSuggestions] = useState<SymbolSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleInput = useCallback((value: string) => {
    onSymbolChange(value)
    setActiveSuggestion(-1)
    const upper = value.trim().toUpperCase()
    // Show suggestions for partial input; skip only when the input already looks like a full pair
    // (e.g. "BTCUSDT" should not re-search, but "bitcoin" (7 chars) must be allowed through)
    const looksComplete = upper.length > 4 && ['USDT','BUSD','USDC','FDUSD','BTC','ETH','BNB'].some(q => upper.endsWith(q) && upper.length > q.length)
    if (upper.length >= 1 && !looksComplete) {
      const found = searchSymbols(upper)
      setSuggestions(found)
      setShowSuggestions(found.length > 0)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [onSymbolChange])

  const selectSuggestion = useCallback((s: SymbolSuggestion) => {
    onSymbolChange(s.symbol)
    setSuggestions([])
    setShowSuggestions(false)
    setActiveSuggestion(-1)
    // Slight delay so state settles before analyzing
    setTimeout(onAnalyze, 50)
  }, [onSymbolChange, onAnalyze])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestion(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        selectSuggestion(suggestions[activeSuggestion])
      } else {
        setShowSuggestions(false)
        onAnalyze()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      e.currentTarget.blur()
    }
  }, [activeSuggestion, suggestions, selectSuggestion, onAnalyze])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const extraActive = (EXTRA_TIMEFRAMES as readonly string[]).includes(interval)

  return (
    <header className="sticky top-0 z-50 flex-shrink-0 flex items-center gap-1.5 px-3 h-11 border-b border-border-subtle bg-surface-900">
      {/* Sidebar toggle */}
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

      {/* Symbol input + suggestions */}
      <div className="relative flex-shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={symbol}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          placeholder="BTC, ETH, SOL…"
          spellCheck={false}
          aria-label="Trading symbol"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          className="h-8 w-32 px-2 bg-surface-700 border border-border-subtle rounded-md text-xs text-slate-200
                     placeholder-slate-500 uppercase font-mono focus:outline-none focus:ring-1
                     focus:ring-blue-500/60 focus:border-blue-500/40 transition-all duration-150"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            role="listbox"
            className="absolute top-full left-0 mt-1 w-44 bg-surface-800 border border-border-subtle
                       rounded-lg shadow-xl overflow-hidden z-50"
          >
            {suggestions.map((s, i) => (
              <button
                key={s.symbol}
                role="option"
                aria-selected={i === activeSuggestion}
                onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
                className={clsx(
                  'w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors',
                  i === activeSuggestion
                    ? 'bg-blue-600/20 text-slate-100'
                    : 'text-slate-400 hover:bg-surface-700 hover:text-slate-200',
                )}
              >
                <span className="font-mono font-semibold">{s.base}</span>
                <span className="text-[10px] text-slate-600">{s.quote}</span>
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Pipeline stage label shown while loading */}
      {loading && stage && (
        <span className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-400 font-mono max-w-[180px] truncate flex-shrink-0">
          <span aria-hidden="true" className="w-2 h-2 border border-slate-500 border-t-blue-400 rounded-full animate-spin flex-shrink-0" />
          {stage}
        </span>
      )}

      {/* Analyze button */}
      <button
        onClick={() => onAnalyze()}
        disabled={loading || !symbol.trim()}
        className="h-8 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md
                   transition-colors duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   disabled:active:scale-100 flex items-center gap-1.5
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 focus-visible:ring-offset-surface-900"
      >
        {loading ? (
          <>
            <span aria-hidden="true" className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            <span className="hidden sm:inline">Analyzing…</span>
          </>
        ) : (
          'Analyze'
        )}
      </button>
    </header>
  )
}
