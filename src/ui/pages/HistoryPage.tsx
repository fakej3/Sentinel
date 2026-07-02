import { useState } from 'react'
import { Clock, Search, Trash2, ArrowRight } from 'lucide-react'
import { formatScore, formatTimeAgo } from '../utils/format'
import { gradeColor } from '../utils/colors'
import type { RecentAnalysis, ConfidenceGrade, AppPage } from '../types'

interface HistoryPageProps {
  recentAnalyses: RecentAnalysis[]
  onSelectSymbol: (sym: string, interval?: string) => void
  onClearHistory: () => void
  onNavigate: (page: AppPage) => void
}

export function HistoryPage({ recentAnalyses, onSelectSymbol, onClearHistory, onNavigate }: HistoryPageProps) {
  const [search, setSearch] = useState('')

  const filtered = recentAnalyses.filter(r =>
    r.symbol.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 pb-20 lg:pb-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-slate-500" />
          <h1 className="text-sm font-semibold text-slate-300">Analysis History</h1>
        </div>
        {recentAnalyses.length > 0 && (
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-red-400 transition-colors
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500 rounded px-1"
          >
            <Trash2 size={11} />
            Clear all
          </button>
        )}
      </div>

      {recentAnalyses.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <Clock size={32} className="text-slate-600 mb-3" />
          <p className="text-xs text-slate-500">No analyses yet. Run an analysis to see it here.</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Search by symbol…"
              className="w-full h-8 pl-8 pr-3 bg-surface-700 border border-border-subtle rounded-lg text-xs text-slate-200
                         placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500/60
                         focus:border-blue-500/40 transition-all"
            />
          </div>

          <div className="space-y-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No matching analyses</p>
            ) : filtered.map((r, i) => (
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-surface-800 border-border-subtle
                           hover:bg-surface-700 cursor-pointer group transition-colors
                           focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium font-mono text-slate-300 group-hover:text-slate-100 transition-colors">
                    {r.symbol}
                  </span>
                  <span className="text-[10px] text-slate-600 ml-2">{r.interval}</span>
                </div>
                <span className={`text-xs font-mono font-semibold flex-shrink-0 ${gradeColor(r.grade as ConfidenceGrade)}`}>
                  {formatScore(r.score)}
                </span>
                <span className="text-[10px] text-slate-600 hidden sm:block flex-shrink-0">
                  {formatTimeAgo(r.timestamp)}
                </span>
                <ArrowRight size={12} className="text-slate-600 group-hover:text-slate-400 transition-colors flex-shrink-0" />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
