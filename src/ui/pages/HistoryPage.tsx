import { useState, useEffect, useCallback } from 'react'
import { Clock, Search, Trash2, FolderOpen, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { fetchHistory, deleteHistoryEntry, fetchHistoryEntry } from '../api'
import { formatScore, formatTimeAgo } from '../utils/format'
import { gradeColor } from '../utils/colors'
import type { RecentAnalysis, ConfidenceGrade, AppPage, TradeDecisionLabel, HistoryMeta } from '../types'

interface HistoryPageProps {
  recentAnalyses: RecentAnalysis[]
  onSelectSymbol: (sym: string, interval?: string) => void
  onClearHistory: () => void
  onNavigate: (page: AppPage) => void
  onLoadEntry?: (entry: import('../api').HistoryEntry) => void
}

const DECISION_OPTIONS = ['All', 'Buy', 'Sell', 'Hold'] as const
const INTERVAL_OPTIONS = ['All', '1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const

export function HistoryPage({
  recentAnalyses, onSelectSymbol, onClearHistory, onNavigate, onLoadEntry,
}: HistoryPageProps) {
  const [search,      setSearch     ] = useState('')
  const [decision,    setDecision   ] = useState<string>('All')
  const [intervalF,   setIntervalF  ] = useState<string>('All')
  const [saved,       setSaved      ] = useState<HistoryMeta[]>([])
  const [loadingS,    setLoadingS   ] = useState(true)
  const [reopening,   setReopening  ] = useState<string | null>(null)
  const [reopenError, setReopenError] = useState<string | null>(null)

  const loadSaved = useCallback(async () => {
    setLoadingS(true)
    const entries = await fetchHistory()
    setSaved(entries)
    setLoadingS(false)
  }, [])

  useEffect(() => { void loadSaved() }, [loadSaved])

  const handleDelete = useCallback(async (id: string) => {
    await deleteHistoryEntry(id)
    setSaved(p => p.filter(e => e.id !== id))
  }, [])

  const handleReopen = useCallback(async (id: string) => {
    if (!onLoadEntry) return
    setReopening(id)
    setReopenError(null)
    const entry = await fetchHistoryEntry(id)
    setReopening(null)
    if (entry) {
      onLoadEntry(entry)
      onNavigate('analysis')
    } else {
      setReopenError('Failed to load analysis. It may have been deleted.')
    }
  }, [onLoadEntry, onNavigate])

  const filteredSaved = saved.filter(e => {
    const matchSearch   = !search || e.symbol.includes(search.toUpperCase())
    const matchDecision = decision === 'All' || e.decision.toLowerCase().includes(decision.toLowerCase())
    const matchInterval = intervalF === 'All' || e.interval === intervalF
    return matchSearch && matchDecision && matchInterval
  })

  const filteredRecent = recentAnalyses.filter(r =>
    !search || r.symbol.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 pb-20 lg:pb-4 space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-slate-500" />
          <h1 className="text-sm font-semibold text-slate-300">History</h1>
        </div>
        <button
          onClick={loadSaved}
          disabled={loadingS}
          className="text-[11px] text-slate-600 hover:text-slate-300 transition-colors flex items-center gap-1
                     focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded px-1
                     disabled:opacity-40"
          title="Refresh saved analyses"
        >
          <RefreshCw size={11} className={loadingS ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search symbol…"
            className="w-full h-8 pl-8 pr-3 bg-surface-700 border border-border-subtle rounded-lg text-xs text-slate-200
                       placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/60
                       focus:border-blue-500/40 transition-all uppercase"
          />
        </div>
        <select
          value={decision}
          onChange={e => setDecision(e.target.value)}
          className="h-8 px-2 text-[11px] bg-surface-700 border border-border-subtle rounded-lg text-slate-400
                     focus:outline-none focus:ring-1 focus:ring-blue-500/60 cursor-pointer"
        >
          {DECISION_OPTIONS.map(d => <option key={d} value={d}>{d === 'All' ? 'All decisions' : d}</option>)}
        </select>
        <select
          value={intervalF}
          onChange={e => setIntervalF(e.target.value)}
          className="h-8 px-2 text-[11px] bg-surface-700 border border-border-subtle rounded-lg text-slate-400
                     focus:outline-none focus:ring-1 focus:ring-blue-500/60 cursor-pointer"
        >
          {INTERVAL_OPTIONS.map(i => <option key={i} value={i}>{i === 'All' ? 'All intervals' : i}</option>)}
        </select>
      </div>

      {/* Reopen error */}
      {reopenError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          {reopenError}
          <button onClick={() => setReopenError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}

      {/* ── Saved analyses (server) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="section-label flex items-center gap-1">
            <FolderOpen size={9} className="text-slate-600" />
            Saved Analyses
          </p>
          <span className="text-[10px] text-slate-600">{saved.length} saved</span>
        </div>

        {loadingS ? (
          <div className="flex items-center justify-center py-8 text-xs text-slate-600 gap-2">
            <span className="w-3 h-3 border border-slate-600 border-t-slate-400 rounded-full animate-spin" />
            Loading…
          </div>
        ) : filteredSaved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FolderOpen size={24} className="text-slate-700 mb-2" />
            <p className="text-xs text-slate-500">
              {saved.length === 0
                ? 'No saved analyses. Use the Save button after an analysis.'
                : 'No matches for current filters.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSaved.map(e => (
              <div
                key={e.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-surface-800 border-border-subtle group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium font-mono text-slate-300">{e.symbol}</span>
                    <span className="text-[10px] text-slate-600">{e.interval}</span>
                    <span className={clsx(
                      'text-[10px] font-medium',
                      (e.decision as TradeDecisionLabel).includes('Buy') ? 'text-emerald-400'
                        : (e.decision as TradeDecisionLabel).includes('Sell') ? 'text-red-400'
                        : 'text-slate-500',
                    )}>
                      {e.decision}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-mono font-semibold ${gradeColor(e.grade as ConfidenceGrade)}`}>
                      {formatScore(e.confidence)}
                    </span>
                    {e.rr !== null && (
                      <span className="text-[10px] text-slate-600">{e.rr.toFixed(1)}R</span>
                    )}
                    <span className="text-[10px] text-slate-600">{formatTimeAgo(e.savedAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  {onLoadEntry && (
                    <button
                      onClick={() => handleReopen(e.id)}
                      disabled={reopening === e.id}
                      title="Reopen this analysis"
                      className="h-7 px-2 text-[11px] text-blue-400 hover:text-blue-300 border border-blue-500/30
                                 hover:border-blue-500/50 rounded-md transition-colors flex items-center gap-1
                                 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                    >
                      {reopening === e.id
                        ? <span className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                        : 'Reopen'
                      }
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(e.id)}
                    title="Delete"
                    className="h-7 w-7 flex items-center justify-center text-slate-600 hover:text-red-400
                               rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent session analyses (local) ── */}
      {recentAnalyses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="section-label flex items-center gap-1">
              <Clock size={9} className="text-slate-600" />
              Recent (this session)
            </p>
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-red-400 transition-colors
                         focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded px-1"
            >
              <Trash2 size={10} />
              Clear
            </button>
          </div>

          <div className="space-y-1">
            {filteredRecent.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-3">No matching analyses</p>
            ) : filteredRecent.map((r, i) => (
              <div
                key={i}
                onClick={() => { onSelectSymbol(r.symbol, r.interval); onNavigate('analysis') }}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectSymbol(r.symbol, r.interval)
                    onNavigate('analysis')
                  }
                }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-surface-800 border-border-subtle
                           hover:bg-surface-700 cursor-pointer group transition-colors
                           focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium font-mono text-slate-300 group-hover:text-slate-100 transition-colors">
                    {r.symbol}
                  </span>
                  <span className="text-[10px] text-slate-600 ml-2">{r.interval}</span>
                  {r.decision && (
                    <span className={clsx(
                      'text-[10px] ml-2 font-medium',
                      (r.decision as TradeDecisionLabel).includes('Buy') ? 'text-emerald-400'
                        : (r.decision as TradeDecisionLabel).includes('Sell') ? 'text-red-400'
                        : 'text-slate-500',
                    )}>
                      {r.decision}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-mono font-semibold ${gradeColor(r.grade as ConfidenceGrade)}`}>
                    {formatScore(r.score)}
                  </span>
                  <span className="text-[10px] text-slate-600 hidden sm:block">{formatTimeAgo(r.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
