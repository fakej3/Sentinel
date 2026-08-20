import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TrendDirection, TrendStrength } from '../../../modules/market-structure/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

/**
 * Signal-first market structure rendering.
 *
 * The pipeline remains the authority; this layer only decides how much of the
 * already-computed structure deserves visual attention. The chart should make
 * the current thesis obvious without turning every historical event into a
 * permanent horizontal line.
 */
const MAX_SWINGS = 8
const MAX_BOS = 1
const MAX_CHOCH = 1
const LIQUIDITY_DISTANCE_PCT = 0.08

function trendLabel(trend: TrendDirection, strength: TrendStrength): string {
  if (trend === 'ranging') return 'Ranging'
  const prefix = strength === 'strong' ? 'Strong ' : strength === 'weak' ? 'Weak ' : ''
  return prefix + (trend === 'bullish' ? 'Bullish' : 'Bearish')
}

function trendColor(trend: TrendDirection): string {
  if (trend === 'bullish') return 'rgba(34, 197, 94, 0.55)'
  if (trend === 'bearish') return 'rgba(239, 83, 80, 0.55)'
  return 'rgba(148, 163, 184, 0.42)'
}

type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

function swingColor(label: SwingLabel | null): string {
  if (label === 'HH' || label === 'HL') return '#22c55e'
  if (label === 'LH' || label === 'LL') return '#ef5350'
  return '#8b5cf6'
}

export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private engine: DrawingEngine | null = null
  private data: PipelineResult | null = null
  private range: ChartTimeRange | null = null
  private highlightKey: string | null = null
  private visible = true
  private candleByTime = new Map<number, { high: number; low: number }>()

  mount(engine: DrawingEngine): void { this.engine = engine }

  update(data: PipelineResult | null, range: ChartTimeRange | null): void {
    this.data = data
    this.range = range
    this.candleByTime = data
      ? new Map(data.candles.map(c => [Math.floor(c.openTime / 1000), { high: c.high, low: c.low }]))
      : new Map()
    this.submit()
  }

  setVisible(visible: boolean): void { this.visible = visible; this.submit() }
  highlight(key: string | null): void { this.highlightKey = key; this.submit() }

  dispose(): void {
    this.engine?.clearLayer(this.id)
    this.engine = null
  }

  private submit(): void { this.engine?.render(this.id, this.buildInstructions()) }

  private buildInstructions(): DrawingInstruction[] {
    const data = this.data
    if (!data) return []

    const ms = data.marketStructure
    const key = this.highlightKey
    const instructions: DrawingInstruction[] = []
    const lastSec = this.range?.toSec ?? Math.floor((data.candles.at(-1)?.openTime ?? 0) / 1000)

    // Keep only the current structural story. Older regimes remain available in
    // the pipeline/analysis tabs but do not compete with the current signal.
    const labeled = ms.swings.filter(s => s.label !== null).slice(-MAX_SWINGS)

    instructions.push({
      kind: 'markerset',
      key: 'swings',
      anchor: labeled.map(s => ({ time: Math.floor(s.timestamp / 1000), value: s.price })),
      markers: labeled.map(s => {
        const lit = key === 'ms:all' || key === `ms:swing:${s.timestamp}`
        return {
          time: Math.floor(s.timestamp / 1000),
          position: s.type === 'high' ? 'aboveBar' as const : 'belowBar' as const,
          shape: 'circle' as const,
          color: swingColor(s.label as SwingLabel),
          text: String(s.label),
          size: lit ? 3 : 2,
        }
      }),
      visible: this.visible,
    })

    if (labeled.length >= 2) {
      instructions.push({
        kind: 'polyline',
        key: 'zigzag',
        color: 'rgba(148, 163, 184, 0.34)',
        lineWidth: 1,
        lineStyle: LineStyle.SparseDotted,
        data: labeled.map(s => ({ time: Math.floor(s.timestamp / 1000), value: s.price })),
        visible: this.visible,
      })
    }

    // Only the latest BOS/CHoCH remains on the default chart. The analysis tab
    // still exposes the complete event history.
    const bos = ms.bos.events.slice(-MAX_BOS)
    for (const event of bos) {
      const eventSec = Math.floor(event.timestamp / 1000)
      if (eventSec > lastSec) continue
      const bullish = event.direction === 'bullish'
      const lit = key === 'ms:all' || key === `ms:bos:${event.timestamp}`
      const lineColor = bullish ? 'rgba(34,197,94,0.72)' : 'rgba(239,83,80,0.72)'
      instructions.push({
        kind: 'polyline',
        key: `bos-line-${event.timestamp}`,
        color: lit ? (bullish ? '#22c55e' : '#ef5350') : lineColor,
        lineWidth: lit ? 2 : 1,
        lineStyle: LineStyle.Solid,
        data: [{ time: eventSec, value: event.level }, { time: lastSec, value: event.level }],
        visible: this.visible,
      })
      const candle = this.candleByTime.get(eventSec)
      if (candle) {
        instructions.push({
          kind: 'markerset',
          key: `bos-marker-${event.timestamp}`,
          anchor: [{ time: eventSec, value: bullish ? candle.low : candle.high }],
          markers: [{
            time: eventSec,
            position: bullish ? 'belowBar' : 'aboveBar',
            shape: bullish ? 'arrowUp' : 'arrowDown',
            color: bullish ? '#22c55e' : '#ef5350',
            text: 'BOS',
            size: lit ? 3 : 2,
          }],
          visible: this.visible,
        })
      }
    }

    const choch = ms.choch.events.slice(-MAX_CHOCH)
    for (const event of choch) {
      const eventSec = Math.floor(event.timestamp / 1000)
      if (eventSec > lastSec) continue
      const lit = key === 'ms:all' || key === `ms:choch:${event.timestamp}`
      instructions.push({
        kind: 'polyline',
        key: `choch-line-${event.timestamp}`,
        color: lit ? 'rgba(168,85,247,0.90)' : 'rgba(168,85,247,0.45)',
        lineWidth: lit ? 2 : 1,
        lineStyle: LineStyle.Dashed,
        data: [{ time: eventSec, value: event.level }, { time: lastSec, value: event.level }],
        visible: this.visible,
      })
      instructions.push({
        kind: 'hline',
        key: `choch-label-${event.timestamp}`,
        price: event.level,
        color: 'rgba(0,0,0,0)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'CHoCH',
        visible: this.visible,
      })
    }

    // Equal highs/lows are useful context, but only the nearest liquidity pool
    // belongs on the default chart. This avoids a second set of purple clutter.
    const current = data.candles.at(-1)?.close ?? 0
    const liquidity = labeled
      .filter(s => s.label === 'EH' || s.label === 'EL')
      .filter(s => current > 0 && Math.abs(s.price - current) / current <= LIQUIDITY_DISTANCE_PCT)
      .sort((a, b) => Math.abs(a.price - current) - Math.abs(b.price - current))[0]
    if (liquidity) {
      instructions.push({
        kind: 'hline',
        key: `liquidity-${liquidity.timestamp}`,
        price: liquidity.price,
        color: 'rgba(139,92,246,0.32)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: false,
        visible: this.visible,
      })
    }

    instructions.push({
      kind: 'watermark',
      key: 'trend-badge',
      horzAlign: 'right',
      vertAlign: 'top',
      lines: [{
        text: trendLabel(ms.trend, ms.strength),
        color: trendColor(ms.trend),
        fontSize: 11,
        fontStyle: 'bold',
      }],
      visible: this.visible,
    })

    return instructions
  }
}
