import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TrendDirection, TrendStrength } from '../../../modules/market-structure/types'
import type { IAnalysisOverlay } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_BOS_LINES   = 4
const MAX_CHOCH_LINES = 2

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendLabel(trend: TrendDirection, strength: TrendStrength): string {
  if (trend === 'ranging') return 'Ranging'
  const prefix = strength === 'strong' ? 'Strong ' : strength === 'weak' ? 'Weak ' : ''
  return prefix + (trend === 'bullish' ? 'Bullish' : 'Bearish')
}

function trendColor(trend: TrendDirection): string {
  if (trend === 'bullish') return 'rgba(34, 197, 94, 0.28)'
  if (trend === 'bearish') return 'rgba(239, 83, 80, 0.28)'
  return 'rgba(148, 163, 184, 0.22)'
}

type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

function swingLabelColor(label: SwingLabel | null): string {
  if (label === 'HH' || label === 'HL') return '#22c55e'
  if (label === 'LH' || label === 'LL') return '#ef5350'
  return '#64748b'
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private engine:           DrawingEngine | null = null
  private lastData:         PipelineResult | null = null
  private lastHighlightKey: string | null = null
  private visible = true

  // Cached per-candle lookup — rebuilt only in update(), not on every highlight()
  private candleByTime = new Map<number, { high: number; low: number; close: number }>()
  private times: number[] = []

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.lastData = data
    if (data) {
      this.times        = data.candles.map(c => Math.floor(c.openTime / 1000))
      this.candleByTime = new Map(
        data.candles.map(c => [Math.floor(c.openTime / 1000), { high: c.high, low: c.low, close: c.close }])
      )
    } else {
      this.times        = []
      this.candleByTime = new Map()
    }
    this.submit()
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    this.submit()
  }

  highlight(key: string | null): void {
    this.lastHighlightKey = key
    this.submit()
  }

  dispose(): void {
    this.engine?.clearLayer(this.id)
    this.engine = null
  }

  private submit(): void {
    this.engine?.render(this.id, this.buildInstructions())
  }

  private buildInstructions(): DrawingInstruction[] {
    const data = this.lastData
    const key  = this.lastHighlightKey

    if (!data) {
      // Blank watermark when no data (trend badge must stay registered to avoid flicker)
      return [{
        kind:      'watermark',
        key:       'trend-badge',
        horzAlign: 'right',
        vertAlign: 'top',
        lines:     [{ text: '', color: 'rgba(0,0,0,0)', fontSize: 11 }],
      }]
    }

    const { marketStructure } = data
    const instructions: DrawingInstruction[] = []

    // ── Swing markers ─────────────────────────────────────────────────────────
    // Build swingByTime only when building instructions (cheap: swings << candles).
    // candleByTime is cached in update() so it's not rebuilt per highlight event.
    const swingByTime = new Map(marketStructure.swings.map(s => [Math.floor(s.timestamp / 1000), s]))

    const anchor = this.times.map(time => {
      const swing  = swingByTime.get(time)
      const candle = this.candleByTime.get(time)
      if (swing && candle) {
        return { time, value: swing.type === 'high' ? candle.high : candle.low }
      }
      return { time, value: candle?.close ?? 0 }
    })

    const labeledSwings = marketStructure.swings.filter(s => s.label !== null)

    // Determine highlight for swing markers
    let litTs: number | null = null
    if (key?.startsWith('ms:swing:')) litTs = Number(key.slice('ms:swing:'.length))
    const litAll = key === 'ms:all'

    const markers = labeledSwings.map(s => {
      const tsMs      = s.timestamp
      const shouldLit = litAll || (litTs !== null && tsMs === litTs)
      return {
        time:     Math.floor(s.timestamp / 1000),
        position: s.type === 'high' ? 'aboveBar' as const : 'belowBar' as const,
        shape:    'circle' as const,
        color:    swingLabelColor(s.label as SwingLabel),
        text:     s.label as string,
        size:     shouldLit ? 2.5 : 1.2,
      }
    })

    instructions.push({
      kind:    'markerset',
      key:     'swings',
      anchor,
      markers,
      visible: this.visible,
    })

    // ── Zigzag through labeled swings ─────────────────────────────────────────
    instructions.push({
      kind:      'polyline',
      key:       'zigzag',
      color:     'rgba(100, 116, 139, 0.45)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      data:      labeledSwings.map(s => ({ time: Math.floor(s.timestamp / 1000), value: s.price })),
      visible:   this.visible,
    })

    // ── BOS price lines ───────────────────────────────────────────────────────
    for (const e of marketStructure.bos.events.slice(-MAX_BOS_LINES)) {
      const isBull  = e.direction === 'bullish'
      const litLine = key === 'ms:all' || key === `ms:bos:${e.timestamp}`
      instructions.push({
        kind:             'hline',
        key:              `bos_${e.timestamp}`,
        price:            e.level,
        color:            isBull ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 83, 80, 0.55)',
        lineWidth:        litLine ? 3 : 1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: true,
        title:            'BOS',
        visible:          this.visible,
      })
    }

    // ── CHoCH price lines ─────────────────────────────────────────────────────
    for (const e of marketStructure.choch.events.slice(-MAX_CHOCH_LINES)) {
      const litLine = key === 'ms:all' || key === `ms:choch:${e.timestamp}`
      instructions.push({
        kind:             'hline',
        key:              `choch_${e.timestamp}`,
        price:            e.level,
        color:            'rgba(168, 85, 247, 0.65)',
        lineWidth:        litLine ? 3 : 2,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: true,
        title:            'CHoCH',
        visible:          this.visible,
      })
    }

    // ── Trend badge (top-right, away from OHLCV HUD) ─────────────────────────
    instructions.push({
      kind:      'watermark',
      key:       'trend-badge',
      horzAlign: 'right',
      vertAlign: 'top',
      lines: [{
        text:      trendLabel(marketStructure.trend, marketStructure.strength),
        color:     trendColor(marketStructure.trend),
        fontSize:  11,
        fontStyle: 'bold',
      }],
      visible: this.visible,
    })

    return instructions
  }
}
