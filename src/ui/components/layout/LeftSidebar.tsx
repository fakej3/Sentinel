import { useMemo, useState } from 'react'
import { ChevronRight, Clock, Star, Settings, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { RecentAnalysis } from '../../types'
import { formatTimeAgo, formatScore } from '../../utils/format'
import { gradeColor, scoreColor } from '../../utils/colors'
import type { ConfidenceGrade } from '../../types'

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT']

interface LeftSidebarProps {
  collapsed: boolean
  mobileOpen: boolean
  onCloseMobile: () => void
  symbol: string
  watchlist: string[]
  recentAnalyses: RecentAnalysis[]
  onAddToWatchlist: (s: string) => void
  onRemoveFromWatchlist: (s: string) => void
  onSelectSymbol: (sym: string, interval?: string) => void
}

function SidebarContent({
  symbol,
  watchlist,
  recentAnalyses,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onSelectSymbol,
}: Omit<LeftSidebarProps, 'collapsed' | 'mobileOpen' | 'onCloseMobile'>) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  const effectiveWatchlist = watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST

  const recentBySymbol = useMemo(() => {
    const map = new Map<string, RecentAnalysis>()
    for (const r of recentAnalyses) {
      if (!map.has(r.symbol)) map.set(r.symbol, r)
    }
    return map
  }, [recentAnalyses])

  const handleAddCurrent = () => {
    if (symbol.trim()) onAddToWatchlist(symbol.trim().toUpperCase())
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto scrollbar-none p-2.5 space-y-3">

        {/* Watchlist */}
        <div>
          <div className="flex items-center justify-between px-1.5 mb-1.5">
            <p className="section-label flex items-center gap-1">
              <Star size={9} className="text-slate-600" />
              Watchlist
            </p>
            <button
              onClick={handleAddCurrent}
              title={`Add ${symbol || 'current symbol'} to watchlist`}
              aria-label={`Add ${symbol || 'current symbol'} to watchlist`}
              className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-slate-400
                         hover:bg-surface-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            >
              <Plus size={11} />
            </button>
          </div>

          <div className="space-y-0.5">
            {effectiveWatchlist.map(sym => {
              const recent = recentBySymbol.get(sym)
              return (
                <div
                  key={sym}
                  onMouseEnter={() => setHoveredSymbol(sym)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                  className={clsx(
                    'flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group',
                    'transition-all duration-120',
                    symbol === sym ? 'bg-surface-600' : 'hover:bg-surface-700',
                  )}
                  onClick={() => onSelectSymbol(sym)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSymbol(sym) } }}
                  aria-label={`Select ${sym}`}
                  aria-current={symbol === sym ? 'true' : undefined}
                >
                  <span className={clsx(
                    'text-xs font-medium font-mono transition-colors leading-none',
                    symbol === sym ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200',
                  )}>
                    {sym}
                  </span>

                  <div className="flex items-center gap-1.5 ml-1">
                    {recent && hoveredSymbol !== sym && (
                      <span className={clsx('text-[10px] font-mono font-medium leading-none', scoreColor(recent.score))}>
                        {formatScore(recent.score)}
                      </span>
                    )}
                    {hoveredSymbol === sym && watchlist.includes(sym) ? (
                      <button
                        onClick={e => { e.stopPropagation(); onRemoveFromWatchlist(sym) }}
                        aria-label={`Remove ${sym} from watchlist`}
                        className="text-slate-600 hover:text-red-400 transition-colors"
                      >
                        <X size={11} />
                      </button>
                    ) : !recent ? (
                      <ChevronRight size={11} className={clsx(
                        'transition-opacity text-slate-600',
                        symbol === sym ? 'opacity-60' : 'opacity-0 group-hover:opacity-40',
                      )} />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <div>
            <p className="section-label px-1.5 mb-1.5 flex items-center gap-1">
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
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-surface-700 group
                             focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                      {r.symbol}
                    </span>
                    <span className="text-[10px] text-slate-600 ml-1.5">{r.interval}</span>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className={`text-[11px] font-mono font-semibold ${gradeColor(r.grade as ConfidenceGrade)}`}>
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
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-slate-500 hover:text-slate-300 hover:bg-surface-800
                     transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        >
          <Settings size={13} />
          <span className="text-xs font-medium">Settings</span>
        </button>
      </div>
    </>
  )
}

export function LeftSidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  symbol,
  watchlist,
  recentAnalyses,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onSelectSymbol,
}: LeftSidebarProps) {
  const contentProps = { symbol, watchlist, recentAnalyses, onAddToWatchlist, onRemoveFromWatchlist, onSelectSymbol }

  return (
    <>
      {/* Desktop sidebar — sticky, collapsible via width transition */}
      <aside
        className={clsx(
          'hidden lg:flex flex-col flex-shrink-0 self-start sticky top-11',
          'border-r border-border-subtle bg-surface-900 overflow-hidden',
          'transition-[width] duration-200 ease-in-out',
          'h-[calc(100vh-44px)]',
          collapsed ? 'w-0' : 'w-60',
        )}
        aria-hidden={collapsed}
      >
        <div className="w-60 flex flex-col h-full">
          <SidebarContent {...contentProps} />
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={clsx(
          'lg:hidden fixed inset-y-0 left-0 z-50 w-72 flex flex-col',
          'border-r border-border-subtle bg-surface-900',
          'transition-transform duration-200 ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!mobileOpen}
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-4 h-11 border-b border-border-subtle flex-shrink-0">
          <span className="text-xs font-bold text-slate-200 tracking-tight">Sentinel</span>
          <button
            onClick={onCloseMobile}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-500 hover:text-slate-300
                       hover:bg-surface-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            aria-label="Close menu"
          >
            <X size={14} />
          </button>
        </div>
        <SidebarContent {...contentProps} />
      </aside>
    </>
  )
}
