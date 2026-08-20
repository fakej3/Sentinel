import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction, LineStyleValue } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { FibLevel } from '../../../modules/fibonacci/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

// ── Visual helpers ────────────────────────────────────────────────────────────

function colorForLevel(level: FibLevel): string {
  if (level.isExtension)     return level.confluence ? '#22d3ee' : '#06b6d4'
  if (level.ratio === 0.000) return level.confluence ? '#f1f5f9' : '#cbd5e1'  // slate-200/300 — impulse-origin anchor
  if (level.ratio === 1.000) return level.confluence ? '#e0e7ff' : '#c7d2fe'  // indigo-100/200 — impulse-end anchor
  if (level.ratio === 0.786) return level.confluence ? '#fbbf24' : '#d97706'  // amber — distinct from S→R flipped orange (#f97316)
  if (level.ratio === 0.650) return level.confluence ? '#ffd740' : '#eab308'
  if (level.ratio === 0.618) return level.confluence ? '#ffd740' : '#eab308'
  if (level.ratio === 0.500) return level.confluence ? '#a8b8cc' : '#7a8fa8'
  if (level.ratio === 0.382) return level.confluence ? '#60a5fa' : '#3b82f6'
  if (level.ratio === 0.236) return level.confluence ? '#94a3b8' : '#64748b'
  return '#94a3b8'
}

function lineWidthForLevel(level: FibLevel): 1 | 2 {
  if (level.confluence) return 2
  if (level.ratio === 0.650 || level.ratio === 0.618) return 2
  return 1
}

function lineStyleForLevel(level: FibLevel): LineStyleValue {
  return level.isExtension ? LineStyle.Dashed : LineStyle.Dotted
}

// Golden-pocket zone colors
const GP_BASE = {
  fillColor1: 'rgba(234, 179, 8, 0.12)',
  fillColor2: 'rgba(234, 179, 8, 0.06)',
  lineColor:  'rgba(234, 179, 8, 0.55)',
} as const

const GP_LIT = {
  fillColor1: 'rgba(234, 179, 8, 0.30)',
  fillColor2: 'rgba(234, 179, 8, 0.18)',
  lineColor:  'rgba(234, 179, 8, 0.90)',
} as const

const PRIORITY: Partial<Record<number, number>> = {
  0.000: 1, 0.618: 2, 0.650: 3, 0.500: 4, 0.382: 5, 1.000: 6, 0.786: 7, 0.236: 8,
}

// Impulse anchor levels whose axis labels must always be visible regardless of
// collision proximity — removing them makes the Fibonacci grid unreadable.
const ANCHOR_RATIOS = new Set([0.000, 1.000])

// ── Overlay ───────────────────────────────────────────────────────────────────

export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'

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
    const fib   = this.lastData?.fibonacci
    const range = this.lastRange
    if (!fib?.available || fib.levels.length === 0 || range === null) return []

    const instructions: DrawingInstruction[] = []
    const key  = this.lastHighlightKey
    const gpLit = key === 'fib:golden-pocket' || key === 'fib:all'

    // Lightweight Charts requires every time-series data array to be in
    // chronological order. A bullish impulse naturally runs low→high in time,
    // but a bearish impulse is high→low in time. Always order the two anchors by
    // timestamp while preserving which price belongs to which swing.
    const highSec = Math.floor(fib.swingHigh.timestamp / 1000)
    const lowSec  = Math.floor(fib.swingLow.timestamp  / 1000)
    const anchorsByTime = highSec <= lowSec
      ? [
          { time: highSec, value: fib.swingHigh.price, kind: 'high' as const },
          { time: lowSec,  value: fib.swingLow.price,  kind: 'low' as const },
        ]
      : [
          { time: lowSec,  value: fib.swingLow.price,  kind: 'low' as const },
          { time: highSec, value: fib.swingHigh.price, kind: 'high' as const },
        ]

    const impulseStartSec = Math.min(highSec, lowSec)
    const fromTime = Math.max(range.fromSec, impulseStartSec)
    const toTime   = range.toSec

    // Impulse leg — diagonal line from swingLow to swingHigh shows the measured move.
    // Makes the anchor visually obvious and distinguishes this fib from floating lines.
    instructions.push({
      kind:      'polyline',
      key:       'impulse-leg',
      color:     'rgba(234, 179, 8, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.SparseDotted,
      data:      anchorsByTime.map(a => ({ time: a.time, value: a.value })),
      visible: this.visible,
    })

    // Anchor markers at swingHigh and swingLow — small gold circles that pin the fib grid.
    instructions.push({
      kind:    'markerset',
      key:     'fib-anchors',
      anchor:  anchorsByTime.map(a => ({ time: a.time, value: a.value })),
      markers: anchorsByTime.map(a => ({
        time:     a.time,
        position: a.kind === 'low' ? 'belowBar' as const : 'aboveBar' as const,
        shape:    'circle' as const,
        color:    'rgba(234, 179, 8, 0.80)',
        text:     '',
        size:     0.8,
      })),
      visible: this.visible,
    })

    // Golden pocket zone (guard fromTime < toTime to prevent degenerate zones)
    const gp618 = fib.levels.find(l => l.ratio === 0.618)
    const gp650 = fib.levels.find(l => l.ratio === 0.650)
    if (gp618 && gp650 && fromTime < toTime) {
      const gpTop = Math.max(gp618.price, gp650.price)
      const gpBot = Math.min(gp618.price, gp650.price)
      const gp    = gpLit ? GP_LIT : GP_BASE
      instructions.push({
        kind: 'zone',
        key:  'gp',
        topPrice:    gpTop,
        bottomPrice: gpBot,
        ...gp,
        fromTime,
        toTime,
        visible: this.visible,
      })
    }

    // Determine which retrace labels are visible (priority order, collision-aware).
    // Pre-seed usedCoords with pixel positions of axis labels from other overlays
    // so Fibonacci labels never stack on BOS, CHoCH, S/R, SL, Entry, or TP labels.
    const usedCoords: number[] = []

    const sr = this.lastData!.supportResistance
    for (const zone of [sr.nearestSupport, sr.nearestResistance]) {
      if (!zone) continue
      const c = this.engine?.priceToCoordinate(zone.center) ?? null
      if (c !== null) usedCoords.push(c)
    }

    const ms = this.lastData!.marketStructure
    const lastBos   = ms.bos.events[ms.bos.events.length - 1]
    const lastChoch = ms.choch.events[ms.choch.events.length - 1]
    if (lastBos)   { const c = this.engine?.priceToCoordinate(lastBos.level)   ?? null; if (c !== null) usedCoords.push(c) }
    if (lastChoch) { const c = this.engine?.priceToCoordinate(lastChoch.level) ?? null; if (c !== null) usedCoords.push(c) }

    const plan = this.lastData!.tradePlan
    if (plan?.actionable) {
      if (plan.invalidationLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.invalidationLevel) ?? null
        if (c !== null) usedCoords.push(c)
      }
      if (plan.entryZone) {
        const c = this.engine?.priceToCoordinate((plan.entryZone.lower + plan.entryZone.upper) / 2) ?? null
        if (c !== null) usedCoords.push(c)
      }
      if (plan.targetLevel !== null) {
        const c = this.engine?.priceToCoordinate(plan.targetLevel) ?? null
        if (c !== null) usedCoords.push(c)
      }
    }

    const retraceByPriority = fib.levels
      .filter(l => !l.isExtension)
      .sort((a, b) => (PRIORITY[a.ratio] ?? 99) - (PRIORITY[b.ratio] ?? 99))
    const hiddenLabels = new Set<FibLevel>()
    for (const level of retraceByPriority) {
      // Anchor levels (0.000 and 1.000) are always visible — they define the
      // impulse range; suppressing them makes the Fibonacci grid unreadable.
      if (ANCHOR_RATIOS.has(level.ratio)) continue
      const coord = this.engine?.priceToCoordinate(level.price) ?? null
      if (coord !== null && usedCoords.some(c => Math.abs(c - coord) < 14)) {
        hiddenLabels.add(level)
      } else if (coord !== null) {
        usedCoords.push(coord)
      }
    }

    for (const level of fib.levels) {
      const suffix    = level.confluence ? ' ✦' : ''
      const title     = `${level.label}${suffix}`
      const base      = lineWidthForLevel(level)
      const lit       =
        key === 'fib:all' ||
        key === `fib:ratio:${level.ratio}` ||
        (key === 'fib:golden-pocket' && (level.ratio === 0.618 || level.ratio === 0.650))
      const lineWidth         = (lit ? Math.min(base + 2, 4) : base) as 1 | 2 | 3 | 4
      const axisLabelVisible  = !level.isExtension && (ANCHOR_RATIOS.has(level.ratio) || !hiddenLabels.has(level))

      // Time-bounded polyline: anchored from impulse start to live edge so the
      // level visually originates from the measured swing, not from chart history.
      if (fromTime < toTime) {
        instructions.push({
          kind:      'polyline',
          key:       `fib_line_${level.ratio}_${level.isExtension ? 'ext' : 'ret'}`,
          color:     colorForLevel(level),
          lineWidth,
          lineStyle: lineStyleForLevel(level),
          data:      [
            { time: fromTime, value: level.price },
            { time: toTime,   value: level.price },
          ],
          visible: this.visible,
        })
      }

      // Invisible hline carries the axis label — polylines have no axis label.
      instructions.push({
        kind:             'hline',
        key:              `fib_${level.ratio}_${level.isExtension ? 'ext' : 'ret'}`,
        price:            level.price,
        color:            'rgba(0,0,0,0)',
        lineWidth:        1,
        lineStyle:        LineStyle.Solid,
        axisLabelVisible,
        title,
        visible:          this.visible,
      })
    }

    return instructions
  }
}
