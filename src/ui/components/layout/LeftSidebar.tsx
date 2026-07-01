import { useState } from 'react'
import {
  Search, ChevronRight, Clock, Star, Settings,
  TrendingUp, Plus, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { RecentAnalysis } from '../../types'
import { formatTimeAgo, formatScore } from '../../utils/format'
import { gradeColor } from '../../utils/colors'
import type { ConfidenceGrade } from '../../types'

const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M']
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT']

interface LeftSidebarProps {
  symbol: string
  interval: string
  loading: boolean
  watchlist: string[]
  recentAnalyses: RecentAnalysis[]
  onSymbolChange: (s: string) => void
  onIntervalChange: (i: string) => void
  onAnalyze: () => void
  onAddToWatchlist: (s: string) => void
  onRemoveFromWatchlist: (s: string) => void
  onSelectSymbol: (s: string) => void
}

export function LeftSidebar({
  symbol,
  interval,
  loading,
  watchlist,
  recentAnalyses,
  onSymbolChange,
  onIntervalChange,
  onAnalyze,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onSelectSymbol,
}: LeftSidebarProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  const effectiveWatchlist = watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onAnalyze()
  }

  const handleAddCurrent = () => {
    if (symbol.trim()) onAddToWatchlist(symbol.trim().toUpperCase())
  }

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col border-r border-border-subtle bg-surface-900 overflow-hidden">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={14} className="text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-100 tracking-tight">Sentinel</span>
            <span className="block text-[10px] text-slate-500 leading-none mt-0.5">Analysis Engine</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-4">
        {/* Search / Symbol Input */}
        <div className="space-y-2">
          <p className="section-label px-1">Symbol</p>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={symbol}
              onChange={e => onSymbolChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="BTCUSDT"
              className="input-base w-full pl-8 uppercase"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Timeframe */}
        <div className="space-y-2">
          <p className="section-label px-1">Timeframe</p>
          <div className="grid grid-cols-5 gap-1">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf}
                onClick={() => onIntervalChange(tf)}
                className={clsx(
                  'text-[11px] font-medium py-1 rounded-md transition-all duration-100 text-center',
                  interval === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-surface-600',
                )}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Analyze Button */}
        <button
          onClick={onAnalyze}
          disabled={loading || !symbol.trim()}
          className="btn-primary w-full relative overflow-hidden"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Analyzing…
            </span>
          ) : (
            'Analyze'
          )}
        </button>

        {/* Watchlist */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <p className="section-label flex items-center gap-1">
              <Star size={9} className="text-slate-600" />
              Watchlist
            </p>
            <button
              onClick={handleAddCurrent}
              title="Add current symbol"
              className="text-slate-600 hover:text-slate-400 transition-colors"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-0.5">
            {effectiveWatchlist.map(sym => (
              <div
                key={sym}
                onMouseEnter={() => setHoveredSymbol(sym)}
                onMouseLeave={() => setHoveredSymbol(null)}
                className={clsx(
                  'flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group',
                  'transition-colors duration-100',
                  symbol === sym ? 'bg-surface-600' : 'hover:bg-surface-700',
                )}
                onClick={() => onSelectSymbol(sym)}
              >
                <span className={clsx(
                  'text-xs font-medium transition-colors',
                  symbol === sym ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200',
                )}>
                  {sym}
                </span>
                <div className="flex items-center gap-1">
                  {hoveredSymbol === sym && watchlist.includes(sym) ? (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveFromWatchlist(sym) }}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <X size={11} />
                    </button>
                  ) : (
                    <ChevronRight size={11} className={clsx(
                      'transition-opacity',
                      symbol === sym ? 'opacity-60' : 'opacity-0 group-hover:opacity-40',
                    )} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <div className="space-y-1">
            <p className="section-label px-1 flex items-center gap-1">
              <Clock size={9} className="text-slate-600" />
              Recent
            </p>
            <div className="space-y-0.5">
              {recentAnalyses.map((r, i) => (
                <div
                  key={i}
                  onClick={() => { onSelectSymbol(r.symbol); onIntervalChange(r.interval) }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-700 group"
                >
                  <div>
                    <span className="text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                      {r.symbol}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-1.5">{r.interval}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-mono font-medium ${gradeColor(r.grade as ConfidenceGrade)}`}>
                      {formatScore(r.score)}
                    </span>
                    <p className="text-[9px] text-slate-600">{formatTimeAgo(r.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex-shrink-0 border-t border-border-subtle">
        <button className="w-full flex items-center gap-2.5 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-surface-800 transition-colors">
          <Settings size={14} />
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>
    </aside>
  )
}
