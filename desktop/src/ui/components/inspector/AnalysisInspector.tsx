import { useState } from 'react'
import {
  ChevronDown, ChevronUp, X, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, XCircle, Clock, BarChart3, Target,
  Activity, GitMerge, Zap, ShieldCheck, Info,
} from 'lucide-react'
import { formatPrice, formatScore, formatMs, formatTimestamp, formatPercent } from '../../utils/format'
import type { PipelineResult } from '../../types'

// ── Primitives ─────────────────────────────────────────────────────────────────

function Val({ v, mono = true, dim }: { v: string | number | null | undefined; mono?: boolean; dim?: boolean }) {
  const display = v === null || v === undefined ? '—' : String(v)
  return (
    <span className={`${mono ? 'font-mono' : ''} ${dim ? 'text-slate-600' : 'text-slate-200'} tabular-nums`}>
      {display}
    </span>
  )
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-[3px] ${className ?? ''}`}>
      <span className="text-[10px] text-slate-500 flex-shrink-0 min-w-0">{label}</span>
      <span className="text-[10px] text-right min-w-0">{children}</span>
    </div>
  )
}

function Divider() {
  return <div className="h-px bg-white/5 my-1" />
}

function DirChip({ dir }: { dir: string }) {
  if (dir === 'bullish') return <span className="text-[9px] font-semibold px-1 py-px rounded bg-emerald-500/15 text-emerald-400">bull</span>
  if (dir === 'bearish') return <span className="text-[9px] font-semibold px-1 py-px rounded bg-red-500/15 text-red-400">bear</span>
  return <span className="text-[9px] font-semibold px-1 py-px rounded bg-slate-500/20 text-slate-400">—</span>
}

function SevChip({ sev }: { sev: string }) {
  if (sev === 'critical') return <span className="text-[9px] font-bold px-1 py-px rounded bg-red-500/20 text-red-400">CRIT</span>
  if (sev === 'warning')  return <span className="text-[9px] font-bold px-1 py-px rounded bg-amber-500/20 text-amber-400">WARN</span>
  return <span className="text-[9px] font-bold px-1 py-px rounded bg-blue-500/10 text-blue-400">INFO</span>
}

function TrendIcon({ t }: { t: string }) {
  if (t.includes('bullish')) return <TrendingUp size={10} className="text-emerald-400 inline mr-0.5" />
  if (t.includes('bearish')) return <TrendingDown size={10} className="text-red-400 inline mr-0.5" />
  return <Minus size={10} className="text-slate-400 inline mr-0.5" />
}

function trendCls(t: string) {
  if (t.includes('bullish')) return 'text-emerald-400'
  if (t.includes('bearish')) return 'text-red-400'
  return 'text-slate-400'
}

function scoreCls(s: number) {
  if (s >= 7) return 'text-emerald-400'
  if (s >= 5) return 'text-amber-400'
  return 'text-red-400'
}

// ── Section wrapper ────────────────────────────────────────────────────────────

interface SectionProps {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function Section({ icon, title, badge, defaultOpen = false, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-white/[0.03] transition-colors focus-visible:outline-none"
      >
        <span className="text-slate-500 flex-shrink-0">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex-1 text-left">
          {title}
        </span>
        {badge && <span className="mr-1">{badge}</span>}
        {open
          ? <ChevronUp size={10} className="text-slate-600 flex-shrink-0" />
          : <ChevronDown size={10} className="text-slate-600 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-0">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Section 1: Overall Summary ─────────────────────────────────────────────────

function SummarySection({ d }: { d: PipelineResult }) {
  const { analysis, confidence, decision, tradePlan, marketContext, metadata } = d
  const { price, fullTrend } = analysis

  return (
    <Section icon={<Activity size={11} />} title="Summary" defaultOpen={true}
      badge={
        <span className={`text-[9px] font-bold px-1.5 py-px rounded font-mono ${scoreCls(confidence.score)}`}>
          {formatScore(confidence.score)}
        </span>
      }
    >
      <Row label="Price">
        <Val v={formatPrice(price.current)} />
        <span className={`ml-1 text-[9px] font-mono ${price.change24hPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPercent(price.change24hPercent)}
        </span>
      </Row>
      <Row label="Trend">
        <TrendIcon t={fullTrend.trend} />
        <span className={`font-mono text-[10px] ${trendCls(fullTrend.trend)}`}>
          {fullTrend.trend.replace(/_/g, ' ')}
        </span>
      </Row>
      <Row label="Strength">
        <Val v={d.marketStructure.strength} />
      </Row>
      <Row label="Confidence">
        <span className={`font-mono ${scoreCls(confidence.score)}`}>{formatScore(confidence.score)}/10</span>
        <span className="ml-1 text-slate-500 text-[9px] font-mono">{confidence.grade}</span>
      </Row>
      <Row label="Signal">
        <Val v={decision.label} mono={false} />
        <span className="ml-1 text-[9px] text-slate-500">{decision.riskLevel} risk</span>
      </Row>
      <Divider />
      <Row label="Market Phase">
        <Val v={marketContext.phase.replace(/_/g, ' ')} mono={false} />
      </Row>
      <Row label="Volatility">
        <Val v={marketContext.volatility} mono={false} />
      </Row>
      <Row label="Setup Quality">
        <Val v={tradePlan.setupQuality.replace(/_/g, ' ')} mono={false} />
      </Row>
      <Row label="Actionable">
        {tradePlan.actionable
          ? <CheckCircle2 size={10} className="text-emerald-400 inline" />
          : <XCircle size={10} className="text-slate-600 inline" />}
        <span className="ml-1 text-[10px] text-slate-500">{tradePlan.actionable ? 'yes' : 'no'}</span>
      </Row>
      <Row label="RR Ratio">
        <Val v={tradePlan.riskRewardRatio !== null ? `${tradePlan.riskRewardRatio.toFixed(2)}:1` : '—'} />
      </Row>
      <Row label="ATR">
        <Val v={d.indicators.atr !== null ? formatPrice(d.indicators.atr) : null} />
        {d.indicators.atrPercent !== null && (
          <span className="ml-1 text-[9px] text-slate-500">{d.indicators.atrPercent.toFixed(2)}%</span>
        )}
      </Row>
      <Divider />
      <Row label="Candles">
        <Val v={metadata.candleCount} />
      </Row>
      <Row label="Version">
        <Val v={metadata.version} dim />
      </Row>
      <Row label="Timestamp">
        <Val v={formatTimestamp(metadata.timestamp)} dim />
      </Row>
    </Section>
  )
}

// ── Section 2: Confidence Breakdown ───────────────────────────────────────────

const BD_LABELS: Record<string, string> = {
  trendQuality:    'Trend / EMAs',
  marketStructure: 'Market Structure',
  momentum:        'Momentum',
  volume:          'Volume / OBV',
  srPositioning:   'S&R Position',
  contradictions:  'Contradictions ↓',
}

function ConfidenceSection({ d }: { d: PipelineResult }) {
  const { confidence } = d
  const { breakdown, penalties } = confidence

  return (
    <Section icon={<BarChart3 size={11} />} title="Confidence Breakdown">
      <Row label="Score">
        <span className={`font-mono ${scoreCls(confidence.score)}`}>{formatScore(confidence.score)}</span>
        <span className="ml-1 text-[9px] text-slate-500">grade: {confidence.grade}</span>
      </Row>
      <Row label="Bull pts">
        <Val v={`${(confidence.bullishConfidence * 10).toFixed(0)} pts`} />
      </Row>
      <Row label="Bear pts">
        <Val v={`${(confidence.bearishConfidence * 10).toFixed(0)} pts`} />
      </Row>
      <Row label="Neutral">
        <Val v={confidence.neutralContribution} />
      </Row>
      <Divider />
      {(Object.entries(breakdown) as [string, number][]).map(([key, val]) => (
        <div key={key} className="flex items-center gap-1.5 py-[2px]">
          <span className={`text-[10px] flex-1 ${key === 'contradictions' ? 'text-red-400/70' : 'text-slate-500'}`}>
            {BD_LABELS[key] ?? key}
          </span>
          <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
            <div
              className={`h-full rounded-full ${key === 'contradictions' ? 'bg-red-500/50' : 'bg-blue-500/60'}`}
              style={{ width: `${(val / 10) * 100}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono w-6 text-right flex-shrink-0 ${key === 'contradictions' ? 'text-red-400/70' : 'text-slate-400'}`}>
            {val.toFixed(1)}
          </span>
        </div>
      ))}
      {penalties.length > 0 && (
        <>
          <Divider />
          <span className="text-[9px] text-amber-400/60 font-semibold uppercase tracking-wide">Penalties</span>
          {penalties.map((p, i) => (
            <div key={i} className="flex items-start gap-1 py-[2px]">
              <span className="text-amber-500/60 text-[9px] mt-px flex-shrink-0">↓</span>
              <span className="text-[10px] text-slate-500 leading-snug">{p.description}</span>
              <span className="text-[10px] font-mono text-amber-400/70 ml-auto flex-shrink-0">−{p.scoreReduction.toFixed(1)}</span>
            </div>
          ))}
        </>
      )}
      {confidence.warnings.length > 0 && (
        <>
          <Divider />
          {confidence.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1 py-[2px]">
              <AlertTriangle size={9} className="text-amber-400/60 flex-shrink-0 mt-px" />
              <span className="text-[10px] text-slate-500 leading-snug">{w.message}</span>
            </div>
          ))}
        </>
      )}
    </Section>
  )
}

// ── Section 3: Market Structure ────────────────────────────────────────────────

function MarketStructureSection({ d }: { d: PipelineResult }) {
  const ms = d.marketStructure
  const counts = ms.structure
  const recent = ms.recentStructure

  return (
    <Section icon={<GitMerge size={11} />} title="Market Structure">
      <Row label="Trend">
        <TrendIcon t={ms.trend} />
        <span className={`font-mono text-[10px] ${trendCls(ms.trend)}`}>{ms.trend}</span>
      </Row>
      <Row label="Strength"><Val v={ms.strength} /></Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">Structure Counts (all / recent)</span>
      {[
        ['HH', counts.higherHighs, recent.higherHighs],
        ['HL', counts.higherLows,  recent.higherLows],
        ['LH', counts.lowerHighs,  recent.lowerHighs],
        ['LL', counts.lowerLows,   recent.lowerLows],
        ['EH', counts.equalHighs,  recent.equalHighs],
        ['EL', counts.equalLows,   recent.equalLows],
      ].map(([lbl, all, rec]) => (
        <div key={lbl as string} className="flex items-center gap-2 py-[2px]">
          <span className="text-[10px] w-5 flex-shrink-0 font-mono font-semibold text-slate-400">{lbl}</span>
          <span className="text-[10px] font-mono text-slate-300 w-4 text-right">{all as number}</span>
          <span className="text-[10px] text-slate-600">/</span>
          <span className="text-[10px] font-mono text-slate-400">{rec as number}</span>
        </div>
      ))}
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">
        BOS Events ({ms.bos.events.length})
      </span>
      {ms.bos.events.slice(-6).map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 py-[2px]">
          <DirChip dir={e.direction} />
          <span className="text-[10px] font-mono text-slate-300 flex-1">{formatPrice(e.level)}</span>
          <span className="text-[9px] text-slate-600 flex-shrink-0">{formatTimestamp(e.timestamp)}</span>
        </div>
      ))}
      {ms.bos.events.length === 0 && <span className="text-[10px] text-slate-600">none</span>}
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">
        CHoCH Events ({ms.choch.events.length})
      </span>
      {ms.choch.events.slice(-4).map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 py-[2px]">
          <DirChip dir={e.direction} />
          <span className="text-[10px] font-mono text-slate-300 flex-1">{formatPrice(e.level)}</span>
          <span className="text-[9px] text-slate-600 flex-shrink-0">{formatTimestamp(e.timestamp)}</span>
        </div>
      ))}
      {ms.choch.events.length === 0 && <span className="text-[10px] text-slate-600">none</span>}
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">
        Consolidation / Breakout
      </span>
      <Row label="Consolidating">
        <Val v={ms.consolidation.detected ? 'yes' : 'no'} mono={false} />
        {ms.consolidation.detected && ms.consolidation.rangePercent !== null && (
          <span className="ml-1 text-[9px] text-slate-500">{ms.consolidation.rangePercent.toFixed(2)}% range</span>
        )}
      </Row>
      <Row label="Breakout">
        <Val v={ms.breakout.confirmed ? 'confirmed' : ms.breakout.failed ? 'failed' : 'none'} mono={false} />
      </Row>
      <Row label="Pullback">
        <Val v={ms.pullback.detected ? 'yes' : 'no'} mono={false} />
        {ms.pullback.depth !== null && (
          <span className="ml-1 text-[9px] text-slate-500">{(ms.pullback.depth * 100).toFixed(1)}%</span>
        )}
      </Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">
        Recent Swings (last 10)
      </span>
      {ms.swings.slice(-10).map((s, i) => (
        <div key={i} className="flex items-center gap-1.5 py-[2px]">
          <span className={`text-[9px] font-mono font-semibold w-4 ${s.type === 'high' ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
            {s.type === 'high' ? 'H' : 'L'}
          </span>
          <span className="text-[9px] font-mono w-6 text-slate-400">{s.label ?? '  '}</span>
          <span className="text-[10px] font-mono text-slate-300 flex-1">{formatPrice(s.price)}</span>
        </div>
      ))}
      {ms.swings.length === 0 && <span className="text-[10px] text-slate-600">no swings detected</span>}
    </Section>
  )
}

// ── Section 4: Support / Resistance ───────────────────────────────────────────

function SRSection({ d }: { d: PipelineResult }) {
  const { supportResistance, analysis } = d
  const currentPrice = analysis.price.current
  const zones = [...supportResistance.activeSupport, ...supportResistance.activeResistance]
    .sort((a, b) => Math.abs(a.center - currentPrice) - Math.abs(b.center - currentPrice))

  return (
    <Section icon={<Target size={11} />} title="Support / Resistance"
      badge={<span className="text-[9px] text-slate-600 font-mono">{zones.length}</span>}
    >
      <Row label="Nearest Support">
        <Val v={supportResistance.nearestSupport ? formatPrice(supportResistance.nearestSupport.center) : null} />
      </Row>
      <Row label="Nearest Resistance">
        <Val v={supportResistance.nearestResistance ? formatPrice(supportResistance.nearestResistance.center) : null} />
      </Row>
      <Divider />
      {zones.length === 0 && <span className="text-[10px] text-slate-600">no zones</span>}
      {zones.map((z, i) => {
        const dist = ((z.center - currentPrice) / currentPrice) * 100
        return (
          <div key={z.id ?? i} className="flex items-center gap-1.5 py-[2px]">
            <span className={`text-[9px] font-mono font-semibold w-4 flex-shrink-0 ${z.type === 'support' ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
              {z.type === 'support' ? 'S' : 'R'}
            </span>
            <span className="text-[10px] font-mono text-slate-300 flex-1">{formatPrice(z.center)}</span>
            <span className={`text-[9px] font-mono flex-shrink-0 ${dist >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
              {dist >= 0 ? '+' : ''}{dist.toFixed(1)}%
            </span>
            <span className="text-[9px] text-slate-600 flex-shrink-0 w-6 text-right">{z.strength.toFixed(1)}</span>
            <span className="text-[9px] text-slate-600 flex-shrink-0">×{z.touchCount}</span>
          </div>
        )
      })}
    </Section>
  )
}

// ── Section 5: Fibonacci ───────────────────────────────────────────────────────

function FibonacciSection({ d }: { d: PipelineResult }) {
  const fib = d.fibonacci

  if (!fib?.available) {
    return (
      <Section icon={<Zap size={11} />} title="Fibonacci">
        <span className="text-[10px] text-slate-600">Fibonacci unavailable — insufficient swing data</span>
      </Section>
    )
  }

  return (
    <Section icon={<Zap size={11} />} title="Fibonacci"
      badge={<DirChip dir={fib.direction} />}
    >
      <Row label="Direction"><DirChip dir={fib.direction} /></Row>
      <Row label="Swing High">
        <Val v={formatPrice(fib.swingHigh.price)} />
        <span className="ml-1 text-[9px] text-slate-600">{formatTimestamp(fib.swingHigh.timestamp)}</span>
      </Row>
      <Row label="Swing Low">
        <Val v={formatPrice(fib.swingLow.price)} />
        <span className="ml-1 text-[9px] text-slate-600">{formatTimestamp(fib.swingLow.timestamp)}</span>
      </Row>
      <Divider />
      {fib.levels.map((lv, i) => (
        <div key={i} className="flex items-center gap-1.5 py-[2px]">
          <span className={`text-[9px] font-mono font-semibold w-8 flex-shrink-0 ${
            lv.isGoldenPocket ? 'text-yellow-400' : lv.isExtension ? 'text-emerald-400/70' : 'text-slate-400'
          }`}>
            {lv.label}
          </span>
          <span className="text-[10px] font-mono text-slate-300 flex-1">{formatPrice(lv.price)}</span>
          {lv.confluence && (
            <span className={`text-[9px] px-1 rounded font-medium flex-shrink-0 ${
              lv.confluenceType === 'support'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-red-400 bg-red-500/10'
            }`}>
              {lv.confluenceType}
            </span>
          )}
          {lv.isGoldenPocket && (
            <span className="text-[9px] text-yellow-400/70 flex-shrink-0">GP</span>
          )}
        </div>
      ))}
    </Section>
  )
}

// ── Section 6: Indicators ─────────────────────────────────────────────────────

function IndicatorsSection({ d }: { d: PipelineResult }) {
  const ind = d.indicators

  return (
    <Section icon={<Activity size={11} />} title="Indicators (Raw)">
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">EMAs</span>
      <Row label="EMA 20"><Val v={ind.ema20 !== null ? formatPrice(ind.ema20) : null} /></Row>
      <Row label="EMA 50"><Val v={ind.ema50 !== null ? formatPrice(ind.ema50) : null} /></Row>
      <Row label="EMA 100"><Val v={ind.ema100 !== null ? formatPrice(ind.ema100) : null} /></Row>
      <Row label="EMA 200"><Val v={ind.ema200 !== null ? formatPrice(ind.ema200) : null} /></Row>
      <Divider />
      <Row label="RSI">
        <Val v={ind.rsi !== null ? ind.rsi.toFixed(2) : null} />
      </Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">MACD</span>
      {ind.macd ? (
        <>
          <Row label="MACD Line"><Val v={ind.macd.macdLine.toFixed(4)} /></Row>
          <Row label="Signal Line"><Val v={ind.macd.signalLine.toFixed(4)} /></Row>
          <Row label="Histogram"><Val v={ind.macd.histogram.toFixed(4)} /></Row>
          <Row label="Prev Histo"><Val v={ind.macd.previousHistogram !== null ? ind.macd.previousHistogram.toFixed(4) : null} /></Row>
          <Row label="Bias"><DirChip dir={ind.macd.bias} /></Row>
        </>
      ) : (
        <span className="text-[10px] text-slate-600">N/A</span>
      )}
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">ADX</span>
      {ind.adx ? (
        <>
          <Row label="ADX"><Val v={ind.adx.adx.toFixed(2)} /></Row>
          <Row label="DI+"><Val v={ind.adx.diPlus.toFixed(2)} /></Row>
          <Row label="DI−"><Val v={ind.adx.diMinus.toFixed(2)} /></Row>
        </>
      ) : (
        <span className="text-[10px] text-slate-600">N/A</span>
      )}
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">Bollinger Bands</span>
      {ind.bollingerBands ? (
        <>
          <Row label="Upper"><Val v={formatPrice(ind.bollingerBands.upper)} /></Row>
          <Row label="Middle"><Val v={formatPrice(ind.bollingerBands.middle)} /></Row>
          <Row label="Lower"><Val v={formatPrice(ind.bollingerBands.lower)} /></Row>
          <Row label="Bandwidth"><Val v={ind.bollingerBands.bandwidth.toFixed(4)} /></Row>
        </>
      ) : (
        <span className="text-[10px] text-slate-600">N/A</span>
      )}
      <Divider />
      <Row label="VWAP"><Val v={formatPrice(ind.vwap)} /></Row>
      <Row label="OBV"><Val v={ind.obv.toFixed(0)} /></Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">Stoch RSI</span>
      {ind.stochRsi ? (
        <>
          <Row label="%K"><Val v={ind.stochRsi.k.toFixed(2)} /></Row>
          <Row label="%D"><Val v={ind.stochRsi.d.toFixed(2)} /></Row>
        </>
      ) : (
        <span className="text-[10px] text-slate-600">N/A</span>
      )}
      <Divider />
      <Row label="MFI"><Val v={ind.mfi !== null ? ind.mfi.toFixed(2) : null} /></Row>
      <Row label="CCI"><Val v={ind.cci !== null ? ind.cci.toFixed(2) : null} /></Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">Volume</span>
      {ind.volumeMA ? (
        <>
          <Row label="Vol MA"><Val v={ind.volumeMA.ma.toFixed(0)} /></Row>
          <Row label="Rel Vol"><Val v={ind.volumeMA.relativeVolume.toFixed(2)} /></Row>
        </>
      ) : (
        <span className="text-[10px] text-slate-600">N/A</span>
      )}
    </Section>
  )
}

// ── Section 7: Trade Plan ─────────────────────────────────────────────────────

function TradePlanSection({ d }: { d: PipelineResult }) {
  const plan = d.tradePlan

  return (
    <Section icon={<ShieldCheck size={11} />} title="Trade Plan">
      <Row label="Actionable">
        {plan.actionable
          ? <CheckCircle2 size={10} className="text-emerald-400 inline" />
          : <XCircle size={10} className="text-slate-600 inline" />}
        <span className="ml-1 text-[10px] text-slate-400">{plan.actionable ? 'yes' : 'no'}</span>
      </Row>
      <Row label="Quality">
        <Val v={plan.setupQuality.replace(/_/g, ' ')} mono={false} />
      </Row>
      <Divider />
      {plan.entryZone ? (
        <>
          <Row label="Entry Low"><Val v={formatPrice(plan.entryZone.lower)} /></Row>
          <Row label="Entry High"><Val v={formatPrice(plan.entryZone.upper)} /></Row>
        </>
      ) : (
        <Row label="Entry Zone"><Val v={null} /></Row>
      )}
      <Row label="Stop / Invalidation">
        <Val v={plan.invalidationLevel !== null ? formatPrice(plan.invalidationLevel) : null} />
      </Row>
      <Row label="Target">
        <Val v={plan.targetLevel !== null ? formatPrice(plan.targetLevel) : null} />
      </Row>
      <Row label="RR">
        <Val v={plan.riskRewardRatio !== null ? `${plan.riskRewardRatio.toFixed(2)}:1` : null} />
      </Row>
      <Divider />
      <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">
        Maturity ({plan.maturityScore}/100 · {plan.maturityLabel})
      </span>
      <Row label="Momentum"><Val v={`${plan.maturityComponents.momentum}/25`} /></Row>
      <Row label="Volume"><Val v={`${plan.maturityComponents.volume}/20`} /></Row>
      <Row label="Trend"><Val v={`${plan.maturityComponents.trend}/20`} /></Row>
      <Row label="Structure"><Val v={`${plan.maturityComponents.structure}/20`} /></Row>
      <Row label="Confidence"><Val v={`${plan.maturityComponents.confidence}/15`} /></Row>
      {plan.maturityPrimaryConcern && (
        <>
          <Divider />
          <div className="flex items-start gap-1 py-[2px]">
            <AlertTriangle size={9} className="text-amber-400/60 flex-shrink-0 mt-0.5" />
            <span className="text-[10px] text-slate-500 leading-snug">{plan.maturityPrimaryConcern}</span>
          </div>
        </>
      )}
      {plan.setupQualityReason && (
        <>
          <Divider />
          <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wide block mb-0.5">Why this quality?</span>
          <span className="text-[10px] text-slate-500 leading-snug block">{plan.setupQualityReason}</span>
        </>
      )}
      {plan.patienceMessage && (
        <>
          <Divider />
          <span className="text-[10px] text-slate-500 leading-snug italic block">{plan.patienceMessage}</span>
        </>
      )}
    </Section>
  )
}

// ── Section 8: Validation ─────────────────────────────────────────────────────

function ValidationSection({ d }: { d: PipelineResult }) {
  const v = d.validation

  return (
    <Section icon={<ShieldCheck size={11} />} title="Validation"
      badge={
        v.passed
          ? <CheckCircle2 size={10} className="text-emerald-400" />
          : <AlertTriangle size={10} className="text-amber-400" />
      }
    >
      <Row label="Passed">
        {v.passed
          ? <CheckCircle2 size={10} className="text-emerald-400 inline" />
          : <XCircle size={10} className="text-red-400 inline" />}
        <span className="ml-1 text-[10px] text-slate-400">{v.passed ? 'yes' : 'no'}</span>
      </Row>
      <Row label="Clean">
        {v.clean
          ? <CheckCircle2 size={10} className="text-emerald-400 inline" />
          : <XCircle size={10} className="text-slate-600 inline" />}
        <span className="ml-1 text-[10px] text-slate-400">{v.clean ? 'yes' : 'no'}</span>
      </Row>
      <Row label="Critical"><Val v={v.criticalCount} /></Row>
      <Row label="Warnings"><Val v={v.warningCount} /></Row>
      <Row label="Info"><Val v={v.infoCount} /></Row>
      {v.issues.length > 0 && (
        <>
          <Divider />
          {v.issues.map((issue, i) => (
            <div key={i} className="py-1.5 border-b border-white/5 last:border-b-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <SevChip sev={issue.severity} />
                <span className="text-[9px] font-mono text-slate-500">{issue.field}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">{issue.message}</p>
              {(issue.expected !== undefined || issue.actual !== undefined) && (
                <div className="mt-0.5 flex gap-2">
                  {issue.expected !== undefined && (
                    <span className="text-[9px] text-slate-600">exp: <span className="text-slate-500 font-mono">{issue.expected}</span></span>
                  )}
                  {issue.actual !== undefined && (
                    <span className="text-[9px] text-slate-600">got: <span className="text-slate-500 font-mono">{issue.actual}</span></span>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {v.issues.length === 0 && (
        <div className="flex items-center gap-1 pt-1">
          <CheckCircle2 size={10} className="text-emerald-400" />
          <span className="text-[10px] text-emerald-400/80">All checks passed</span>
        </div>
      )}
    </Section>
  )
}

// ── Section 9: Engine Timing ───────────────────────────────────────────────────

function TimingSection({ d }: { d: PipelineResult }) {
  const { timings } = d.metadata
  const stages: [string, number | undefined][] = [
    ['Fetch',           timings.fetch],
    ['Indicators',      timings.indicators],
    ['Market Structure',timings.marketStructure],
    ['Support/Resist',  timings.supportResistance],
    ['Volume',          timings.volume],
    ['Analysis',        timings.analysis],
    ['Validation',      timings.validation],
    ['Confidence',      timings.confidence],
    ['Writer',          timings.writer],
    ['AI Enhancement',  timings.aiEnhancement],
  ]

  const maxMs = Math.max(...stages.map(([, v]) => v ?? 0), 1)

  return (
    <Section icon={<Clock size={11} />} title="Engine Timing">
      {stages.map(([name, ms], i) => (
        ms !== undefined ? (
          <div key={i} className="flex items-center gap-1.5 py-[2px]">
            <span className="text-[10px] text-slate-500 flex-1">{name}</span>
            <div className="w-16 h-1 rounded-full bg-white/5 overflow-hidden flex-shrink-0">
              <div
                className="h-full rounded-full bg-blue-500/40"
                style={{ width: `${(ms / maxMs) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-400 w-12 text-right flex-shrink-0">{formatMs(ms)}</span>
          </div>
        ) : null
      ))}
      <Divider />
      <Row label="Total">
        <span className="font-mono text-slate-200 font-semibold">{formatMs(timings.total)}</span>
      </Row>
    </Section>
  )
}

// ── Main Inspector Component ───────────────────────────────────────────────────

interface AnalysisInspectorProps {
  data: PipelineResult
  onClose: () => void
}

export function AnalysisInspector({ data, onClose }: AnalysisInspectorProps) {
  return (
    <div className="flex flex-col h-full bg-[#08090f]/97 backdrop-blur-sm border-l border-white/8">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-white/8">
        <div className="flex items-center gap-1.5">
          <Info size={11} className="text-slate-500" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Analysis Inspector
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-600">
            {data.metadata.symbol} · {data.metadata.interval}
          </span>
          <button
            onClick={onClose}
            className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors focus-visible:outline-none"
            aria-label="Close inspector"
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <SummarySection d={data} />
        <ConfidenceSection d={data} />
        <MarketStructureSection d={data} />
        <SRSection d={data} />
        <FibonacciSection d={data} />
        <IndicatorsSection d={data} />
        <TradePlanSection d={data} />
        <ValidationSection d={data} />
        <TimingSection d={data} />
      </div>
    </div>
  )
}
