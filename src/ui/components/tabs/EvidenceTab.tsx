import { useState, useMemo } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react'
import { Badge } from '../shared/Badge'
import { directionBg, impactBg, impactColor } from '../../utils/colors'
import type { PipelineResult, EvidenceItem, EvidenceDirection, EvidenceImpact } from '../../types'
import { clsx } from 'clsx'

interface EvidenceTabProps {
  result: PipelineResult
}

function DirectionDot({ dir }: { dir: EvidenceDirection }) {
  const cls = dir === 'bullish' ? 'bg-emerald-400' : dir === 'bearish' ? 'bg-red-400' : 'bg-slate-500'
  return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${cls}`} />
}

function DirectionIcon({ dir }: { dir: EvidenceDirection }) {
  if (dir === 'bullish') return <TrendingUp size={13} className="text-emerald-400 flex-shrink-0" />
  if (dir === 'bearish') return <TrendingDown size={13} className="text-red-400 flex-shrink-0" />
  return <Minus size={13} className="text-slate-500 flex-shrink-0" />
}

function ImpactPill({ impact }: { impact: EvidenceImpact }) {
  return (
    <span className={`tag border text-[10px] ${impactBg(impact)}`}>
      <span className={`w-1 h-1 rounded-full bg-current ${impactColor(impact)}`} />
      {impact}
    </span>
  )
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  return (
    <div className="card p-3 hover:border-border-strong transition-all duration-150 animate-slide-up group">
      <div className="flex items-start gap-3">
        <DirectionDot dir={item.direction} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${directionBg(item.direction)} border text-[10px]`} dot>
                {item.direction}
              </Badge>
              <ImpactPill impact={item.impact} />
              <span className="text-[10px] text-slate-600 bg-surface-700 px-1.5 py-0.5 rounded">
                {item.source.replace(/_/g, ' ')}
              </span>
            </div>
            <DirectionIcon dir={item.direction} />
          </div>
          <p className="text-xs font-semibold text-slate-200 mb-0.5 leading-snug">{item.factor}</p>
          <p className="text-[11px] text-slate-400 leading-relaxed">{item.description}</p>
        </div>
      </div>
    </div>
  )
}

type DirectionFilter = EvidenceDirection | 'all'
type ImpactFilter = EvidenceImpact | 'all'

export function EvidenceTab({ result }: EvidenceTabProps) {
  const [query, setQuery] = useState('')
  const [dirFilter, setDirFilter] = useState<DirectionFilter>('all')
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('all')
  const evidence = result.analysis.evidence

  const filtered = useMemo(() => {
    return evidence.filter(e => {
      if (dirFilter !== 'all' && e.direction !== dirFilter) return false
      if (impactFilter !== 'all' && e.impact !== impactFilter) return false
      if (query) {
        const q = query.toLowerCase()
        return e.factor.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      }
      return true
    })
  }, [evidence, dirFilter, impactFilter, query])

  const counts = useMemo(() => ({
    bullish: evidence.filter(e => e.direction === 'bullish').length,
    bearish: evidence.filter(e => e.direction === 'bearish').length,
    neutral: evidence.filter(e => e.direction === 'neutral').length,
    high: evidence.filter(e => e.impact === 'high').length,
    medium: evidence.filter(e => e.impact === 'medium').length,
    low: evidence.filter(e => e.impact === 'low').length,
  }), [evidence])

  return (
    <div>
      {/* Filters */}
      <div className="px-4 pt-3 pb-2 border-b border-border-subtle space-y-2">
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search evidence…"
            className="input-base w-full pl-8 text-xs"
          />
        </div>

        {/* Direction + Impact filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={11} className="text-slate-600 flex-shrink-0" />
          {(['all', 'bullish', 'bearish', 'neutral'] as DirectionFilter[]).map(d => (
            <button
              key={d}
              onClick={() => setDirFilter(d)}
              className={clsx(
                'tag border text-[10px] transition-all duration-100',
                dirFilter === d
                  ? d === 'bullish' ? 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30'
                    : d === 'bearish' ? 'bg-red-400/15 text-red-400 border-red-400/30'
                    : d === 'neutral' ? 'bg-slate-400/15 text-slate-300 border-slate-400/30'
                    : 'bg-surface-600 text-slate-300 border-border-strong'
                  : 'bg-surface-800 text-slate-500 border-border-subtle hover:text-slate-300',
              )}
            >
              {d === 'all' ? `All ${evidence.length}` : `${d} ${counts[d]}`}
            </button>
          ))}
          <div className="w-px h-3 bg-border-subtle" />
          {(['all', 'high', 'medium', 'low'] as ImpactFilter[]).map(i => (
            <button
              key={i}
              onClick={() => setImpactFilter(i)}
              className={clsx(
                'tag border text-[10px] transition-all duration-100',
                impactFilter === i
                  ? i === 'high' ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                    : i === 'medium' ? 'bg-blue-400/15 text-blue-400 border-blue-400/30'
                    : i === 'low' ? 'bg-slate-500/15 text-slate-400 border-slate-500/30'
                    : 'bg-surface-600 text-slate-300 border-border-strong'
                  : 'bg-surface-800 text-slate-500 border-border-subtle hover:text-slate-300',
              )}
            >
              {i === 'all' ? 'All impact' : `${i} ${counts[i]}`}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <Filter size={24} className="mb-2 opacity-30" />
            <p className="text-sm">No evidence matches filters</p>
          </div>
        ) : (
          filtered.map((item, i) => <EvidenceCard key={i} item={item} />)
        )}
      </div>
    </div>
  )
}
