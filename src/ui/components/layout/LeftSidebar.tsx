import { useState } from 'react'
import {
  ChevronRight, Clock, Star, Settings,
  Plus, X,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { RecentAnalysis } from '../../types'
import { formatTimeAgo, formatScore } from '../../utils/format'
import { gradeColor } from '../../utils/colors'
import type { ConfidenceGrade } from '../../types'

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT']

interface LeftSidebarProps {
  collapsed: boolean
  symbol: string
  watchlist: string[]
  recentAnalyses: RecentAnalysis[]
  onAddToWatchlist: (s: string) => void
  onRemoveFromWatchlist: (s: string) => void
  onSelectSymbol: (sym: string, interval?: string) => void
}

export function LeftSidebar({
  collapsed,
  symbol,
  watchlist,
  recentAnalyses,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onSelectSymbol,
}: LeftSidebarProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  const effectiveWatchlist = watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST

  const handleAddCurrent = () => {
    if (symbol.trim()) onAddToWatchlist(symbol.trim().toUpperCase())
  }

  return (
    <aside
      className={clsx(
        'flex-shrink-0 flex flex-col border-r border-border-subtle bg-surface-900 overflow-hidden',
        'transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-0' : 'w-56',
      )}
      aria-hidden={collapsed}
    >
      <div className="w-56 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto scrollbar-none p-3 space-y-4">
          {/* Watchlist */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <p className="section-label flex items-center gap-1">
                <Star size={9} className="text-slate-600" />
                Watchlist
              </p>
              <button
                onClick={handleAddCurrent}
                title={`Add ${symbol || 'current symbol'} to watchlist`}
                aria-label={`Add ${symbol || 'current symbol'} to watchlist`}
                className="text-slate-600 hover:text-slate-400 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
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
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSymbol(sym) } }}
                  aria-label={`Select ${sym}`}
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
                        aria-label={`Remove ${sym} from watchlist`}
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
                    onClick={() => onSelectSymbol(r.symbol, r.interval)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSymbol(r.symbol, r.interval) } }}
                    aria-label={`Load ${r.symbol} ${r.interval} analysis`}
                    className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-700 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
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
          <button
            className="w-full flex items-center gap-2.5 px-4 py-3 text-slate-500 hover:text-slate-300 hover:bg-surface-800
                       transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          >
            <Settings size={14} />
            <span className="text-xs font-medium">Settings</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
