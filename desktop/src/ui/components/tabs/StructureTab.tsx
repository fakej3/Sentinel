import { ArrowUpRight, ArrowDownRight, Minus, Layers, AlertCircle } from 'lucide-react'
import { Card } from '../shared/Card'
import { Badge } from '../shared/Badge'
import { formatPrice, formatTimestamp } from '../../utils/format'
import { trendBg, trendColor } from '../../utils/colors'
import type { PipelineResult, StructureEvent } from '../../types'
import { clsx } from 'clsx'

interface StructureTabProps {
  result: PipelineResult
}

function SwingCountPill({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="flex flex-col items-center bg-surface-700 rounded-lg px-3 py-2">
      <span className={`text-lg font-bold font-mono ${colorClass}`}>{value}</span>
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
    </div>
  )
}

function EventRow({ event }: { event: StructureEvent }) {
  const isBullish = event.direction === 'bullish'
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border-subtle last:border-0">
      <div className={clsx(
        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isBullish ? 'bg-emerald-400/15' : 'bg-red-400/15',
      )}>
        {event.type === 'BOS'
          ? isBullish ? <ArrowUpRight size={12} className="text-emerald-400" /> : <ArrowDownRight size={12} className="text-red-400" />
          : <AlertCircle size={12} className={isBullish ? 'text-emerald-400' : 'text-red-400'} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded', {
            'bg-emerald-400/10 text-emerald-400': event.type === 'BOS' && isBullish,
            'bg-red-400/10 text-red-400': event.type === 'BOS' && !isBullish,
            'bg-amber-400/10 text-amber-400': event.type === 'CHOCH' && isBullish,
            'bg-violet-400/10 text-violet-400': event.type === 'CHOCH' && !isBullish,
          })}>
            {event.type}
          </span>
          <span className={`text-[10px] font-medium ${isBullish ? 'text-emerald-400' : 'text-red-400'}`}>
            {event.direction}
          </span>
        </div>
        <p className="text-xs font-mono text-slate-300">Level: {formatPrice(event.level)}</p>
        <p className="text-[10px] text-slate-600">{formatTimestamp(event.timestamp)} · Bar #{event.index}</p>
      </div>
    </div>
  )
}

export function StructureTab({ result }: StructureTabProps) {
  const { marketStructure } = result
  const { bos, choch, consolidation, breakout, pullback, structure, recentStructure } = marketStructure
  const recentEvents = marketStructure.events.slice(-6).reverse()

  return (
    <div className="p-4 space-y-4 animate-in">
      {/* Trend + Strength */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4 col-span-1">
          <p className="section-label mb-2">Structure Bias</p>
          <Badge dot className={`${trendBg(marketStructure.trend)} border text-sm`}>
            {marketStructure.trend}
          </Badge>
          <p className={`text-xs font-medium mt-2 ${trendColor(marketStructure.trend)}`}>
            {marketStructure.strength} strength
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Conf: {marketStructure.confidence.toFixed(1)}/10
          </p>
        </Card>

        <Card className="p-4 col-span-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="section-label mb-2">Recent Structure</p>
              <div className="flex flex-wrap gap-1.5">
                <SwingCountPill label="HH" value={recentStructure.higherHighs} colorClass="text-emerald-400" />
                <SwingCountPill label="HL" value={recentStructure.higherLows} colorClass="text-emerald-300" />
                <SwingCountPill label="LH" value={recentStructure.lowerHighs} colorClass="text-red-400" />
                <SwingCountPill label="LL" value={recentStructure.lowerLows} colorClass="text-red-300" />
              </div>
            </div>
            <div>
              <p className="section-label mb-2">Lifetime Structure</p>
              <div className="flex flex-wrap gap-1.5">
                <SwingCountPill label="HH" value={structure.higherHighs} colorClass="text-emerald-400" />
                <SwingCountPill label="HL" value={structure.higherLows} colorClass="text-emerald-300" />
                <SwingCountPill label="LH" value={structure.lowerHighs} colorClass="text-red-400" />
                <SwingCountPill label="LL" value={structure.lowerLows} colorClass="text-red-300" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* BOS + CHoCH */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">BOS</p>
            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', {
              'bg-emerald-400/10 text-emerald-400': bos.detected,
              'bg-surface-600 text-slate-500': !bos.detected,
            })}>
              {bos.detected ? `${bos.events.length} detected` : 'None'}
            </span>
          </div>
          {bos.last && (
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400">Last BOS</p>
              <p className={`text-xs font-semibold ${bos.last.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                {bos.last.direction} · {formatPrice(bos.last.level)}
              </p>
              <p className="text-[10px] text-slate-600">{formatTimestamp(bos.last.timestamp)}</p>
            </div>
          )}
          {!bos.last && <p className="text-xs text-slate-600">No BOS events</p>}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">CHoCH</p>
            <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded-full', {
              'bg-amber-400/10 text-amber-400': choch.detected,
              'bg-surface-600 text-slate-500': !choch.detected,
            })}>
              {choch.detected ? `${choch.events.length} detected` : 'None'}
            </span>
          </div>
          {choch.last && (
            <div className="space-y-1">
              <p className="text-[11px] text-slate-400">Last CHoCH</p>
              <p className={`text-xs font-semibold ${choch.last.direction === 'bullish' ? 'text-emerald-400' : 'text-red-400'}`}>
                {choch.last.direction} · {formatPrice(choch.last.level)}
              </p>
              <p className="text-[10px] text-slate-600">{formatTimestamp(choch.last.timestamp)}</p>
            </div>
          )}
          {!choch.last && <p className="text-xs text-slate-600">No CHoCH events</p>}
        </Card>
      </div>

      {/* Consolidation + Breakout + Pullback */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="section-label mb-2">Consolidation</p>
          <div className={clsx('w-2 h-2 rounded-full mb-2', consolidation.detected ? 'bg-amber-400' : 'bg-slate-600')} />
          <p className="text-sm font-semibold text-slate-200">
            {consolidation.detected ? 'Active' : 'None'}
          </p>
          {consolidation.detected && consolidation.rangePercent !== null && (
            <p className="text-[11px] text-slate-500 mt-1">
              Range: {consolidation.rangePercent.toFixed(2)}%
            </p>
          )}
        </Card>

        <Card className="p-3">
          <p className="section-label mb-2">Breakout</p>
          <div className={clsx('w-2 h-2 rounded-full mb-2',
            breakout.confirmed ? 'bg-emerald-400' : breakout.failed ? 'bg-red-400' : 'bg-slate-600'
          )} />
          <p className={`text-sm font-semibold ${
            breakout.confirmed ? 'text-emerald-400' : breakout.failed ? 'text-red-400' : 'text-slate-400'
          }`}>
            {breakout.confirmed ? 'Confirmed' : breakout.failed ? 'Failed' : 'None'}
          </p>
          {breakout.direction && (
            <p className="text-[11px] text-slate-500 mt-1">{breakout.direction}</p>
          )}
        </Card>

        <Card className="p-3">
          <p className="section-label mb-2">Pullback</p>
          <div className={clsx('w-2 h-2 rounded-full mb-2', pullback.detected ? 'bg-blue-400' : 'bg-slate-600')} />
          <p className={`text-sm font-semibold ${pullback.detected ? 'text-blue-400' : 'text-slate-400'}`}>
            {pullback.detected ? 'Detected' : 'None'}
          </p>
          {pullback.depth !== null && (
            <p className="text-[11px] text-slate-500 mt-1">
              Depth: {(pullback.depth * 100).toFixed(1)}%
            </p>
          )}
        </Card>
      </div>

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={13} className="text-slate-500" />
            <p className="section-label">Recent Events</p>
          </div>
          <div>
            {recentEvents.map((event, i) => (
              <EventRow key={i} event={event} />
            ))}
          </div>
        </Card>
      )}

      {/* Structure Evidence */}
      {marketStructure.evidence.length > 0 && (
        <Card className="p-4">
          <p className="section-label mb-3">Evidence</p>
          <div className="space-y-1.5">
            {marketStructure.evidence.map((e, i) => (
              <div key={i} className="flex items-start gap-2">
                <Minus size={10} className="text-slate-600 flex-shrink-0 mt-1.5" />
                <p className="text-xs text-slate-400 leading-relaxed">{e}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
