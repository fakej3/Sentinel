import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction, LineStyleValue } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { FibLevel } from '../../../modules/fibonacci/types'
import type { IAnalysisOverlay } from '../types'

// ── Visual helpers ────────────────────────────────────────────────────────────

function colorForLevel(level: FibLevel): string {
  if (level.isExtension)     return level.confluence ? '#00e676' : '#22c55e'
  if (level.ratio === 1.000) return level.confluence ? '#c8e0ff' : '#94a3b8'
  if (level.ratio === 0.786) return level.confluence ? '#ffb340' : '#f97316'
  if (level.ratio === 0.650) return level.confluence ? '#ffd740' : '#eab308'
  if (level.ratio === 0.618) return level.confluence ? '#ffd740' : '#eab308'
  if (level.ratio === 0.500) return level.confluence ? '#ffffff' : '#e2e8f0'
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
  lineColor:  'rgba(234, 179, 8, 0.40)',
} as const

const GP_LIT = {
  fillColor1: 'rgba(234, 179, 8, 0.30)',
  fillColor2: 'rgba(234, 179, 8, 0.18)',
  lineColor:  'rgba(234, 179, 8, 0.90)',
} as const

const PRIORITY: Partial<Record<number, number>> = {
  0.618: 1, 0.650: 2, 0.500: 3, 0.382: 4, 1.000: 5, 0.786: 6, 0.236: 7,
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'

  private engine:           DrawingEngine | null = null
  private lastData:         PipelineResult | null = null
  private lastHighlightKey: string | null = null
  private visible = true

  mount(engine: DrawingEngine): void {
    this.engine = engine
  }

  update(data: PipelineResult | null): void {
    this.lastData = data
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
    const fib = this.lastData?.fibonacci
    if (!fib?.available || fib.levels.length === 0) return []

    const instructions: DrawingInstruction[] = []
    const key  = this.lastHighlightKey
    const gpLit = key === 'fib:golden-pocket' || key === 'fib:all'

    const allCandles = this.lastData!.candles
    const fromTime   = Math.floor(allCandles[0].openTime / 1000)
    const toTime     = Math.floor(allCandles[allCandles.length - 1].openTime / 1000)

    // Golden pocket zone
    const gp618 = fib.levels.find(l => l.ratio === 0.618)
    const gp650 = fib.levels.find(l => l.ratio === 0.650)
    if (gp618 && gp650) {
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

    // Determine which retrace labels are visible (priority order, collision-aware)
    const retraceByPriority = fib.levels
      .filter(l => !l.isExtension)
      .sort((a, b) => (PRIORITY[a.ratio] ?? 99) - (PRIORITY[b.ratio] ?? 99))
    const usedCoords: number[] = []
    const hiddenLabels = new Set<FibLevel>()
    for (const level of retraceByPriority) {
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
      const axisLabelVisible  = !level.isExtension && !hiddenLabels.has(level)

      instructions.push({
        kind:             'hline',
        key:              `fib_${level.ratio}_${level.isExtension ? 'ext' : 'ret'}`,
        price:            level.price,
        color:            colorForLevel(level),
        lineWidth,
        lineStyle:        lineStyleForLevel(level),
        axisLabelVisible,
        title,
        visible:          this.visible,
      })
    }

    return instructions
  }
}
