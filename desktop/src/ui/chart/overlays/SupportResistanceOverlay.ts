import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { PriceZone } from '../../../modules/support-resistance/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

const MAX_ZONES = 3
// Only draw zones within this fraction of current price; prevents far-away levels
// from adding noise when they have no immediate relevance.
const MAX_DIST_PCT = 0.20

// ── Support center/line colors ────────────────────────────────────────────────
const SUPPORT_DIM  = 'rgba(34, 197, 94, 0.22)'
const SUPPORT_NEAR = 'rgba(34, 197, 94, 0.60)'

// ── Resistance center/line colors ─────────────────────────────────────────────
const RESIST_DIM  = 'rgba(239, 83, 80, 0.22)'
const RESIST_NEAR = 'rgba(239, 83, 80, 0.60)'

// ── Flipped zone center colors (resistance→support = cyan, support→resistance = orange) ─
const FLIPPED_SUP_DIM  = '#0891b2'  // cyan-600 (resistance that flipped to support)
const FLIPPED_SUP_NEAR = '#06b6d4'  // cyan-500
const FLIPPED_RES_DIM  = '#c2410c'  // orange-700 (support that flipped to resistance)
const FLIPPED_RES_NEAR = '#ea580c'  // orange-600

// ── Zone body fills ───────────────────────────────────────────────────────────
const SUPPORT_FILL_DIM    = 'rgba(34, 197, 94, 0.06)'
const SUPPORT_FILL_ACTIVE = 'rgba(34, 197, 94, 0.16)'
const SUPPORT_FILL_LIT    = 'rgba(34, 197, 94, 0.26)'
const RESIST_FILL_DIM     = 'rgba(239, 83, 80, 0.06)'
const RESIST_FILL_ACTIVE  = 'rgba(239, 83, 80, 0.16)'
const RESIST_FILL_LIT     = 'rgba(239, 83, 80, 0.26)'
const FLIPPED_FILL_DIM    = 'rgba(148, 163, 184, 0.04)'
const FLIPPED_FILL_ACTIVE = 'rgba(148, 163, 184, 0.12)'
const FLIPPED_FILL_LIT    = 'rgba(148, 163, 184, 0.22)'

function isFlipped(zone: PriceZone, effectiveType: 'support' | 'resistance'): boolean {
  return zone.state === 'flipped' && zone.type !== effectiveType
}

export class SupportResistanceOverlay implements IAnalysisOverlay {
  readonly id = 'sr'

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
    if (!this.lastData) return []

    const currentPrice        = this.lastData.analysis.price.current
    const nearestSupportId    = this.lastData.supportResistance.nearestSupport?.id    ?? null
    const nearestResistanceId = this.lastData.supportResistance.nearestResistance?.id ?? null
    const currentZoneId       = this.lastData.supportResistance.currentZone?.id       ?? null
    const key                 = this.lastHighlightKey

    // Zone fill time extent: limited to recent 30 bars so S/R fills don't
    // paint large opaque rectangles across the full chart history.
    const toSec   = this.lastRange?.toSec   ?? 0
    const candles = this.lastData.candles
    const intervalSec = candles.length >= 2
      ? (candles[candles.length - 1].openTime - candles[0].openTime) / (candles.length - 1) / 1000
      : 0
    const lookback30 = intervalSec > 0 ? Math.round(intervalSec * 30) : 0
    const lastCandleSec = candles.length > 0 ? Math.floor(candles[candles.length - 1].openTime / 1000) : 0
    const fromSec = lookback30 > 0
      ? Math.max(this.lastRange?.fromSec ?? 0, lastCandleSec - lookback30)
      : (this.lastRange?.fromSec ?? 0)

    const support    = this.lastData.supportResistance.activeSupport
      .filter(z => Math.abs(z.center - currentPrice) / currentPrice <= MAX_DIST_PCT)
      .slice(0, MAX_ZONES)
    const resistance = this.lastData.supportResistance.activeResistance
      .filter(z => Math.abs(z.center - currentPrice) / currentPrice <= MAX_DIST_PCT)
      .slice(0, MAX_ZONES)

    // Collect trade-plan price coords — S/R axis labels defer to these.
    const tradePlanCoords: number[] = []
    const plan = this.lastData.tradePlan
    if (plan?.actionable) {
      if (plan.invalidationLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.invalidationLevel) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
      if (plan.entryZone) {
        const mid = (plan.entryZone.lower + plan.entryZone.upper) / 2
        const c = this.engine?.priceToCoordinate(mid) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
      if (plan.targetLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.targetLevel) ?? null
        if (c !== null) tradePlanCoords.push(c)
      }
    }

    const instructions: DrawingInstruction[] = []

    const supportUsedCoords:    number[] = []
    const resistanceUsedCoords: number[] = []

    for (const zone of support) {
      this.pushZone(zone, 'support', {
        isNearest: zone.id === nearestSupportId,
        isActive:  zone.id === currentZoneId,
        key, fromSec, toSec, tradePlanCoords,
        usedCoords: supportUsedCoords,
        nearestId: nearestSupportId,
        instructions,
      })
    }

    for (const zone of resistance) {
      this.pushZone(zone, 'resistance', {
        isNearest: zone.id === nearestResistanceId,
        isActive:  zone.id === currentZoneId,
        key, fromSec, toSec, tradePlanCoords,
        usedCoords: resistanceUsedCoords,
        nearestId: nearestResistanceId,
        instructions,
      })
    }

    return instructions
  }

  private pushZone(
    zone: PriceZone,
    effectiveType: 'support' | 'resistance',
    ctx: {
      isNearest:     boolean
      isActive:      boolean
      key:           string | null
      fromSec:       number
      toSec:         number
      tradePlanCoords: number[]
      usedCoords:    number[]
      nearestId:     string | null
      instructions:  DrawingInstruction[]
    },
  ): void {
    const { isNearest, isActive, key, fromSec, toSec, tradePlanCoords, usedCoords, instructions } = ctx
    const flipped = isFlipped(zone, effectiveType)
    const isSup   = effectiveType === 'support'

    const coord   = this.engine?.priceToCoordinate(zone.center) ?? null
    const pixDup  = coord !== null && usedCoords.some(c => Math.abs(c - coord) < 6)
    if (pixDup) return
    if (coord !== null) usedCoords.push(coord)

    const lit = key === 'sr:all' || key === `sr:zone:${zone.id}` ||
      (key === 'sr:nearest-support'    && zone.id === ctx.nearestId && isSup) ||
      (key === 'sr:nearest-resistance' && zone.id === ctx.nearestId && !isSup)

    // ── Zone body fill ────────────────────────────────────────────────────────
    if (fromSec > 0 && toSec > fromSec) {
      let fillColor: string
      if (flipped) {
        fillColor = lit ? FLIPPED_FILL_LIT : (isActive ? FLIPPED_FILL_ACTIVE : FLIPPED_FILL_DIM)
      } else if (isSup) {
        fillColor = lit ? SUPPORT_FILL_LIT : (isActive ? SUPPORT_FILL_ACTIVE : SUPPORT_FILL_DIM)
      } else {
        fillColor = lit ? RESIST_FILL_LIT  : (isActive ? RESIST_FILL_ACTIVE  : RESIST_FILL_DIM)
      }
      instructions.push({
        kind:       'zone',
        key:        `fill_${zone.id}`,
        topPrice:    zone.upper,
        bottomPrice: zone.lower,
        fillColor1:  fillColor,
        fromTime:    fromSec,
        toTime:      toSec,
        visible:     this.visible,
      })
    }

    // ── Center line ───────────────────────────────────────────────────────────
    let centerColor: string
    if (flipped) {
      centerColor = isSup ? (isNearest ? FLIPPED_SUP_NEAR : FLIPPED_SUP_DIM)
                          : (isNearest ? FLIPPED_RES_NEAR : FLIPPED_RES_DIM)
    } else {
      centerColor = isSup ? (isNearest ? SUPPORT_NEAR : SUPPORT_DIM)
                          : (isNearest ? RESIST_NEAR  : RESIST_DIM)
    }

    const baseWidth: 1 | 2 = (isNearest || zone.strength >= 7) ? 2 : 1
    const lineWidth = (lit ? Math.min(baseWidth + 2, 4) : (isActive ? Math.min(baseWidth + 1, 3) : baseWidth)) as 1 | 2 | 3 | 4

    const nearPlan = isNearest && coord !== null && tradePlanCoords.some(c => Math.abs(c - coord) < 14)
    const touches  = zone.touchCount > 1 ? ` ×${zone.touchCount}` : ''
    const typeLabel = flipped ? (isSup ? 'R→S' : 'S→R') : (isSup ? 'S' : 'R')

    instructions.push({
      kind:             'hline',
      key:              `center_${zone.id}`,
      price:            zone.center,
      color:            centerColor,
      lineWidth,
      lineStyle:        isNearest ? LineStyle.Dashed : LineStyle.Dotted,
      axisLabelVisible: isNearest && !nearPlan,
      title:            `${typeLabel}${touches}`,
      visible:          this.visible,
    })
  }
}
