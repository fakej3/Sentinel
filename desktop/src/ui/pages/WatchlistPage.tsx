import { useState, useMemo } from 'react'
import { Star, Plus, X, Search } from 'lucide-react'
import { clsx } from 'clsx'
import { formatScore, formatTimeAgo } from '../utils/format'
import { gradeColor } from '../utils/colors'
import type { RecentAnalysis, ConfidenceGrade } from '../types'

const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT']

interface WatchlistPageProps {
  symbol: string
  watchlist: string[]
  recentAnalyses: RecentAnalysis[]
  onAddToWatchlist: (sym: string) => void
  onRemoveFromWatchlist: (sym: string) => void
  onSelectSymbol: (sym: string, interval?: string) => void
  onAnalyze: (symOverride?: string) => void
}

export function WatchlistPage({
  symbol, watchlist, recentAnalyses,
  onAddToWatchlist, onRemoveFromWatchlist, onSelectSymbol, onAnalyze,
}: WatchlistPageProps) {
  const [search,    setSearch   ] = useState('')
  const [newSymbol, setNewSymbol] = useState('')

  const effectiveWatchlist = useMemo(
    () => watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST,
    [watchlist],
  )

  const recentBySymbol = useMemo(() => {
    const map = new Map<string, RecentAnalysis>()
    for (const r of recentAnalyses) {
      if (!map.has(r.symbol)) map.set(r.symbol, r)
    }
    return map
  }, [recentAnalyses])

  const filtered = useMemo(
    () => effectiveWatchlist.filter(sym => sym.toLowerCase().includes(search.toLowerCase())),
    [effectiveWatchlist, search],
  )

  const handleAdd = () => {
    const sym = newSymbol.trim().toUpperCase()
    if (sym) { onAddToWatchlist(sym); setNewSymbol('') }
  }

  return (
    <div className="p-4 pb-20 md:pb-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Star size={14} className="text-slate-500 flex-shrink-0" />
        <h1 className="text-sm font-semibold text-slate-300">Watchlist</h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter symbols…"
          className="w-full h-8 pl-8 pr-3 bg-surface-700 border border-border-subtle rounded-lg text-xs text-slate-200
                     placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/60
                     focus:border-blue-500/40 transition-all"
        />
      </div>

      {/* Add symbol */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="Add symbol (e.g. XRPUSDT)"
          className="flex-1 h-8 px-3 bg-surface-700 border border-border-subtle rounded-lg text-xs text-slate-200
                     placeholder-slate-500 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-500/60
                     focus:border-blue-500/40 transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={!newSymbol.trim()}
          className="h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg
                     transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Symbol list */}
      <div className="space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No symbols found</p>
        ) : filtered.map(sym => {
          const recent   = recentBySymbol.get(sym)
          const isActive = symbol === sym
          return (
            <div
              key={sym}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer group',
                isActive
                  ? 'bg-surface-600 border-border-DEFAULT'
                  : 'bg-surface-800 border-border-subtle hover:bg-surface-700',
              )}
              onClick={() => onSelectSymbol(sym)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSymbol(sym) } }}
              aria-current={isActive ? 'true' : undefined}
            >
              <span className={clsx(
                'text-xs font-medium font-mono flex-1',
                isActive ? 'text-slate-100' : 'text-slate-400 group-hover:text-slate-200',
              )}>
                {sym}
              </span>

              {recent && (
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-mono font-semibold ${gradeColor(recent.grade as ConfidenceGrade)}`}>
                    {formatScore(recent.score)}
                  </span>
                  <p className="text-[10px] text-slate-600">{formatTimeAgo(recent.timestamp)}</p>
                </div>
              )}

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); onSelectSymbol(sym); onAnalyze(sym) }}
                  title={`Analyze ${sym}`}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-blue-400 hover:text-blue-300
                             px-2 py-1 rounded border border-blue-500/30 hover:border-blue-500/50
                             transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  Analyze
                </button>
                {watchlist.includes(sym) && (
                  <button
                    onClick={e => { e.stopPropagation(); onRemoveFromWatchlist(sym) }}
                    title={`Remove ${sym}`}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400
                               transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
