import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { TrendDirection, TrendStrength } from '../../../modules/market-structure/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_BOS_LINES    = 2
const MAX_CHOCH_LINES  = 2
// Maximum labeled swings to show when no CHoCH has been detected
const MAX_REGIME_SWINGS = 20

// ── Helpers ───────────────────────────────────────────────────────────────────

function trendLabel(trend: TrendDirection, strength: TrendStrength): string {
  if (trend === 'ranging') return 'Ranging'
  const prefix = strength === 'strong' ? 'Strong ' : strength === 'weak' ? 'Weak ' : ''
  return prefix + (trend === 'bullish' ? 'Bullish' : 'Bearish')
}

function trendColor(trend: TrendDirection): string {
  if (trend === 'bullish') return 'rgba(34, 197, 94, 0.50)'
  if (trend === 'bearish') return 'rgba(239, 83, 80, 0.50)'
  return 'rgba(148, 163, 184, 0.40)'
}

type SwingLabel = 'HH' | 'HL' | 'LH' | 'LL' | 'EH' | 'EL'

function swingLabelColor(label: SwingLabel | null): string {
  if (label === 'HH' || label === 'HL') return '#22c55e'
  if (label === 'LH' || label === 'LL') return '#ef5350'
  return '#8b5cf6'   // EH / EL — liquidity pools (violet, distinct from structural swing colors)
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export class MarketStructureOverlay implements IAnalysisOverlay {
  readonly id = 'market-structure'

  private engine:           DrawingEngine | null = null
  private lastData:         PipelineResult | null = null
  private lastRange:        ChartTimeRange | null = null
  private lastHighlightKey: string | null = null
  private visible = true

  // Cached per-candle lookup — rebuilt only in update(), not on every highlight()
  private candleByTime = new Map<number, { high: number; low: number; close: number }>()
  private times: number[] = []

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null, range: ChartTimeRange | null): void {
    this.lastData  = data
    this.lastRange = range
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

    // Segment end = the chart's live edge (falls back to the analysis snapshot's
    // last candle when the chart range isn't known yet).
    const lastCandleSec = this.lastRange?.toSec
      ?? (this.times.length > 0 ? this.times[this.times.length - 1] : 0)

    // ── CHoCH coords (computed first — BOS defers to CHoCH for axis labels) ──
    const chochEvents = marketStructure.choch.events.slice(-MAX_CHOCH_LINES)
    const chochCoords: number[] = chochEvents
      .map(e => this.engine?.priceToCoordinate(e.level) ?? null)
      .filter((c): c is number => c !== null)

    // ── BOS coords (used to suppress swing text near significant lines) ───────
    const bosCoords: number[] = marketStructure.bos.events.slice(-MAX_BOS_LINES)
      .map(e => this.engine?.priceToCoordinate(e.level) ?? null)
      .filter((c): c is number => c !== null)

    const significantLineCoords = [...chochCoords, ...bosCoords]

    // ── Swing markers — limited to the current regime ─────────────────────────
    // Regime boundary = the most recent CHoCH event. If none, cap at MAX_REGIME_SWINGS.
    // This prevents hundreds of historical HH/HL/LH/LL from earlier regimes cluttering
    // the chart and rendering the zigzag useless.
    const allLabeled    = marketStructure.swings.filter(s => s.label !== null)
    const lastChoch     = marketStructure.choch.events[marketStructure.choch.events.length - 1]
    const regimeStart   = lastChoch?.timestamp ?? 0
    const labeledSwings = lastChoch
      ? allLabeled.filter(s => s.timestamp >= regimeStart)
      : allLabeled.slice(-MAX_REGIME_SWINGS)

    const swingByTime = new Map(marketStructure.swings.map(s => [Math.floor(s.timestamp / 1000), s]))

    // Anchor series only covers the regime time window so the marker set doesn't
    // drag the chart back to the very first candle.
    const regimeStartSec = lastChoch ? Math.floor(regimeStart / 1000) : 0
    const anchor = this.times
      .filter(t => t >= regimeStartSec)
      .map(time => {
        const swing  = swingByTime.get(time)
        const candle = this.candleByTime.get(time)
        if (swing) {
          return { time, value: swing.price }
        }
        return { time, value: candle?.close ?? 0 }
      })

    let litTs: number | null = null
    if (key?.startsWith('ms:swing:')) litTs = Number(key.slice('ms:swing:'.length))
    let litBosTs: number | null = null
    if (key?.startsWith('ms:bos:')) litBosTs = Number(key.slice('ms:bos:'.length))
    const litAll = key === 'ms:all'

    const markers = labeledSwings.map(s => {
      const tsMs      = s.timestamp
      const shouldLit = litAll || (litTs !== null && tsMs === litTs)
      const coord     = this.engine?.priceToCoordinate(s.price) ?? null
      // Suppress swing text when it would stack on top of a BOS/CHoCH axis label
      const nearLine  = coord !== null && significantLineCoords.some(c => Math.abs(c - coord) < 16)

      return {
        time:     Math.floor(s.timestamp / 1000),
        position: s.type === 'high' ? 'aboveBar' as const : 'belowBar' as const,
        shape:    'circle' as const,
        color:    swingLabelColor(s.label as SwingLabel),
        text:     nearLine ? '' : (s.label as string),
        size:     shouldLit ? 3 : 1.5,
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
      color:     'rgba(100, 116, 139, 0.55)',
      lineWidth: 1,
      lineStyle: LineStyle.SparseDotted,
      data:      labeledSwings.map(s => ({ time: Math.floor(s.timestamp / 1000), value: s.price })),
      visible:   this.visible,
    })

    // ── BOS lines — temporally anchored ──────────────────────────────────────
    // Each BOS is drawn as a polyline from its event timestamp to the last candle
    // so it is visually anchored in time. A dim hline (invisible line, visible axis
    // label) provides the price-axis "BOS" label for the most-recent event only.
    const bosEvents = marketStructure.bos.events.slice(-MAX_BOS_LINES)
    const bosUsedCoords: number[] = [...chochCoords]

    for (let i = 0; i < bosEvents.length; i++) {
      const e            = bosEvents[i]
      const isBull       = e.direction === 'bullish'
      const isMostRecent = i === bosEvents.length - 1
      const litLine      = key === 'ms:all' || key === `ms:bos:${e.timestamp}`
      const coord        = this.engine?.priceToCoordinate(e.level) ?? null

      const obscuredByChoch = !litLine && coord !== null && chochCoords.some(c => Math.abs(c - coord) < 8)
      if (obscuredByChoch) continue

      const tooClose = coord !== null && bosUsedCoords.some(c => Math.abs(c - coord) < 14)
      if (coord !== null && !tooClose) bosUsedCoords.push(coord)

      const bosColor = isBull ? 'rgba(34, 197, 94, 0.55)' : 'rgba(239, 83, 80, 0.55)'
      const bosLit   = isBull ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 83, 80, 0.85)'
      const eventSec = Math.floor(e.timestamp / 1000)

      // Temporal polyline — visible only from the BOS event onward
      if (lastCandleSec > 0 && eventSec <= lastCandleSec) {
        instructions.push({
          kind:      'polyline',
          key:       `bos_line_${e.timestamp}`,
          color:     litLine ? bosLit : bosColor,
          lineWidth: litLine ? 3 : 1,
          lineStyle: LineStyle.Solid,
          data:      [{ time: eventSec, value: e.level }, { time: lastCandleSec, value: e.level }],
          visible:   this.visible,
        })
      }

      // Dim hline — provides axis label only; the transparent line itself is invisible
      instructions.push({
        kind:             'hline',
        key:              `bos_label_${e.timestamp}`,
        price:            e.level,
        color:            'rgba(0, 0, 0, 0)',
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: isMostRecent && !tooClose,
        title:            'BOS',
        visible:          this.visible,
      })
    }

    // ── BOS breakout arrows ───────────────────────────────────────────────────
    // Arrow at the exact candle that broke structure — makes the breakout bar unmistakable.
    // Uses a lean anchor (just the BOS candle timestamps) so aboveBar/belowBar positions
    // correctly relative to the candle's high or low.
    const bosArrowMarkers = bosEvents.map(e => {
      const tSec = Math.floor(e.timestamp / 1000)
      const candle = this.candleByTime.get(tSec)
      return {
        time:     tSec,
        value:    e.direction === 'bullish' ? (candle?.low ?? 0) : (candle?.high ?? 0),
        position: e.direction === 'bullish' ? 'belowBar' as const : 'aboveBar' as const,
        shape:    e.direction === 'bullish' ? 'arrowUp'  as const : 'arrowDown' as const,
        color:    e.direction === 'bullish' ? 'rgba(34,197,94,0.9)' : 'rgba(239,83,80,0.9)',
        size:     (litAll || (litBosTs !== null && e.timestamp === litBosTs)) ? 2.5 : 1.2,
      }
    }).sort((a, b) => a.time - b.time)

    if (bosArrowMarkers.length > 0) {
      instructions.push({
        kind:    'markerset',
        key:     'bos-arrows',
        anchor:  bosArrowMarkers.map(m => ({ time: m.time, value: m.value })),
        markers: bosArrowMarkers.map(({ time, position, shape, color, size }) => ({ time, position, shape, color, text: 'BOS', size })),
        visible: this.visible,
      })
    }

    // ── EH / EL liquidity hlines ─────────────────────────────────────────────
    // Dotted violet lines at equal-high / equal-low swing prices.
    // These are unmitigated liquidity pools (resting sell-stops above EH, buy-stops below EL).
    // Only drawn within MAX_DIST_PCT of current price to keep the chart readable.
    const currentPrice = data.analysis.price.current
    const EH_EL_DIST_PCT = 0.20
    for (const s of labeledSwings) {
      if (s.label !== 'EH' && s.label !== 'EL') continue
      if (Math.abs(s.price - currentPrice) / currentPrice > EH_EL_DIST_PCT) continue
      instructions.push({
        kind:             'hline',
        key:              `ehl_${s.timestamp}`,
        price:            s.price,
        color:            'rgba(139, 92, 246, 0.40)',
        lineWidth:        1,
        lineStyle:        LineStyle.Dotted,
        axisLabelVisible: false,
        title:            '',
        visible:          this.visible,
      })
    }

    // ── CHoCH lines — temporally anchored ────────────────────────────────────
    const chochUsedCoords: number[] = []

    for (let i = 0; i < chochEvents.length; i++) {
      const e            = chochEvents[i]
      const isMostRecent = i === chochEvents.length - 1
      const litLine      = key === 'ms:all' || key === `ms:choch:${e.timestamp}`
      const coord        = this.engine?.priceToCoordinate(e.level) ?? null
      const tooClose     = coord !== null && chochUsedCoords.some(c => Math.abs(c - coord) < 14)

      if (coord !== null && !tooClose) chochUsedCoords.push(coord)

      const chochColor = 'rgba(168, 85, 247, 0.65)'
      const chochLit   = 'rgba(168, 85, 247, 0.95)'
      const eventSec   = Math.floor(e.timestamp / 1000)

      // Temporal polyline
      if (lastCandleSec > 0 && eventSec <= lastCandleSec) {
        instructions.push({
          kind:      'polyline',
          key:       `choch_line_${e.timestamp}`,
          color:     litLine ? chochLit : chochColor,
          lineWidth: litLine ? 3 : 2,
          lineStyle: LineStyle.Dashed,
          data:      [{ time: eventSec, value: e.level }, { time: lastCandleSec, value: e.level }],
          visible:   this.visible,
        })
      }

      // Dim hline for axis label
      instructions.push({
        kind:             'hline',
        key:              `choch_label_${e.timestamp}`,
        price:            e.level,
        color:            'rgba(0, 0, 0, 0)',
        lineWidth:        1,
        lineStyle:        LineStyle.Dashed,
        axisLabelVisible: isMostRecent && !tooClose,
        title:            'CHoCH',
        visible:          this.visible,
      })
    }

    // ── Trend badge ───────────────────────────────────────────────────────────
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
