/**
 * TradePlanOverlay — renders the complete trade plan as ONE coherent drawing:
 * entry zone, stop loss, target ladder, and risk/reward bands.
 *
 * Replaces the former EntryZone / StopLoss / TakeProfit / RiskReward overlays.
 * Rationale: they rendered a single object (the plan) as four layers, each
 * re-deriving direction geometrically and re-computing the others' label
 * positions to dodge collisions. One overlay = one source of truth, coherent
 * visibility, and collision handling in one place.
 *
 * Renders nothing unless the plan is actionable. All values (direction,
 * targets) come from the pipeline — this class contains zero trade logic.
 */
import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

// ── Colors (carried over unchanged from the four merged overlays) ─────────────

const ENTRY_FILL_DIM = {
  fillColor1: 'rgba(59, 130, 246, 0.10)',
  fillColor2: 'rgba(59, 130, 246, 0.10)',
  lineColor:  'rgba(59, 130, 246, 0.40)',
} as const

const ENTRY_FILL_LIT = {
  fillColor1: 'rgba(59, 130, 246, 0.25)',
  fillColor2: 'rgba(59, 130, 246, 0.25)',
  lineColor:  'rgba(59, 130, 246, 0.90)',
} as const

const ENTRY_EDGE = 'rgba(59, 130, 246, 0.5)'
const SL_COLOR   = '#ef5350'

const TP_COLORS: [string, string, string] = ['#22c55e', 'rgba(34, 197, 94, 0.65)', 'rgba(34, 197, 94, 0.40)']

const RISK_DIM        = 'rgba(239, 83, 80, 0.15)'
const RISK_LIT        = 'rgba(239, 83, 80, 0.28)'
const RISK_EDGE_DIM   = 'rgba(239, 83, 80, 0.35)'
const RISK_EDGE_LIT   = 'rgba(239, 83, 80, 0.70)'
const REWARD_DIM      = 'rgba(34, 197, 94, 0.15)'
const REWARD_LIT      = 'rgba(34, 197, 94, 0.28)'
const REWARD_EDGE_DIM = 'rgba(34, 197, 94, 0.35)'
const REWARD_EDGE_LIT = 'rgba(34, 197, 94, 0.70)'

const LABEL_COLLISION_PX = 14

export class TradePlanOverlay implements IAnalysisOverlay {
  readonly id = 'trade-plan'

  private engine:           DrawingEngine | null = null
  private lastData:         PipelineResult | null = null
  private lastRange:        ChartTimeRange | null = null
  private lastHighlightKey: string | null = null
  private visible = true

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null, range: ChartTimeRange | null): void {
    this.lastData  = data
    this.lastRange = range
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
    const plan  = this.lastData?.tradePlan
    const range = this.lastRange
    if (!plan?.actionable || !plan.entryZone || plan.direction === null ||
        plan.invalidationLevel === null || plan.targetLevel === null || range === null) {
      return []
    }

    const key      = this.lastHighlightKey
    const long     = plan.direction === 'long'
    const { lower: entryLow, upper: entryHigh } = plan.entryZone
    const entryMid = (entryLow + entryHigh) / 2
    const stop     = plan.invalidationLevel
    const tp1      = plan.targetLevel
    const risk     = Math.abs(entryMid - stop)
    const { fromSec, toSec } = range

    const entryLit = key === 'entry:zone' || key === 'trade:full'
    const slLit    = key === 'stop:loss'  || key === 'trade:full'
    const bandsLit = key === 'trade:full' || key === 'entry:zone' || key === 'stop:loss' ||
                     (key?.startsWith('tp:') ?? false)

    const instructions: DrawingInstruction[] = []

    // ── Risk / reward bands ───────────────────────────────────────────────────
    instructions.push({
      kind: 'zone',
      key:  'risk',
      topPrice:    long ? entryLow : stop,
      bottomPrice: long ? stop     : entryHigh,
      fillColor1:  bandsLit ? RISK_LIT      : RISK_DIM,
      lineColor:   bandsLit ? RISK_EDGE_LIT : RISK_EDGE_DIM,
      fromTime: fromSec,
      toTime:   toSec,
      visible:  this.visible,
    })
    instructions.push({
      kind: 'zone',
      key:  'reward',
      topPrice:    long ? tp1       : entryLow,
      bottomPrice: long ? entryHigh : tp1,
      fillColor1:  bandsLit ? REWARD_LIT      : REWARD_DIM,
      lineColor:   bandsLit ? REWARD_EDGE_LIT : REWARD_EDGE_DIM,
      fromTime: fromSec,
      toTime:   toSec,
      visible:  this.visible,
    })

    // ── Entry zone ────────────────────────────────────────────────────────────
    instructions.push({
      kind: 'zone',
      key:  'entry-fill',
      topPrice:    entryHigh,
      bottomPrice: entryLow,
      ...(entryLit ? ENTRY_FILL_LIT : ENTRY_FILL_DIM),
      fromTime: fromSec,
      toTime:   toSec,
      visible:  this.visible,
    })
    const entryEdgeWidth: 1 | 2 = entryLit ? 2 : 1
    instructions.push({
      kind: 'hline', key: 'entry-lower', price: entryLow,
      color: ENTRY_EDGE, lineWidth: entryEdgeWidth, lineStyle: LineStyle.Dashed,
      axisLabelVisible: false, visible: this.visible,
    })
    instructions.push({
      kind: 'hline', key: 'entry-upper', price: entryHigh,
      color: ENTRY_EDGE, lineWidth: entryEdgeWidth, lineStyle: LineStyle.Dashed,
      axisLabelVisible: false, visible: this.visible,
    })

    // ── Stop loss ─────────────────────────────────────────────────────────────
    instructions.push({
      kind:             'hline',
      key:              'sl',
      price:            stop,
      color:            SL_COLOR,
      lineWidth:        slLit ? 4 : 2,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: true,
      title:            'SL',
      visible:          this.visible,
    })

    // ── Label collision — resolved once, inside the single overlay ────────────
    // SL label always shows; Entry defers to SL; TPs defer to both.
    const slCoord    = this.engine?.priceToCoordinate(stop) ?? null
    const entryCoord = this.engine?.priceToCoordinate(entryMid) ?? null
    const usedCoords: number[] = slCoord !== null ? [slCoord] : []

    const entryLabelVisible = entryCoord === null ||
      !usedCoords.some(c => Math.abs(c - entryCoord) < LABEL_COLLISION_PX)
    if (entryCoord !== null && entryLabelVisible) usedCoords.push(entryCoord)

    instructions.push({
      kind:             'hline',
      key:              'entry-mid',
      price:            entryMid,
      color:            'rgba(0,0,0,0)',
      lineWidth:        1,
      lineStyle:        LineStyle.Solid,
      axisLabelVisible: entryLabelVisible,
      title:            'Entry',
      visible:          this.visible,
    })

    // ── Target ladder (computed by the pipeline, rendered here) ───────────────
    const targets = plan.targets.length > 0 ? plan.targets.slice(0, 3) : [tp1]
    for (let i = 0; i < targets.length; i++) {
      const price    = targets[i]
      const rr       = risk > 0 ? (Math.abs(price - entryMid) / risk).toFixed(1) : '—'
      const coord    = this.engine?.priceToCoordinate(price) ?? null
      const tooClose = coord !== null && usedCoords.some(c => Math.abs(c - coord) < LABEL_COLLISION_PX)
      const lit      = key === 'trade:full' || key === `tp:${i + 1}`

      instructions.push({
        kind:             'hline',
        key:              `tp${i + 1}`,
        price,
        color:            TP_COLORS[i],
        lineWidth:        lit ? 3 : (i === 0 ? 2 : 1),
        lineStyle:        LineStyle.Solid,
        axisLabelVisible: !tooClose,
        title:            `TP${i + 1} ${rr}R`,
        visible:          this.visible,
      })
      if (!tooClose && coord !== null) usedCoords.push(coord)
    }

    // ── RR axis label (zoom-adaptive: hidden when the band is too short) ──────
    const tpCoord        = this.engine?.priceToCoordinate(tp1) ?? null
    const entryEdgeCoord = this.engine?.priceToCoordinate(long ? entryHigh : entryLow) ?? null
    const rewardPx       = tpCoord !== null && entryEdgeCoord !== null
      ? Math.abs(tpCoord - entryEdgeCoord)
      : 999
    const rewardVal = Math.abs(tp1 - entryMid)
    const rrText    = risk > 0 ? (rewardVal / risk).toFixed(2) : '—'

    instructions.push({
      kind:             'hline',
      key:              'rr-label',
      price:            (tp1 + (long ? entryHigh : entryLow)) / 2,
      color:            'rgba(0,0,0,0)',
      lineWidth:        1,
      lineStyle:        LineStyle.Dotted,
      axisLabelVisible: rewardPx >= 24,
      title:            `RR ${rrText}`,
      visible:          this.visible,
    })

    return instructions
  }
}
