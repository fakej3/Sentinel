import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { LineStyleValue, SeriesHandle, PriceLineHandle } from '../drawing/types'
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

// ── Typed level-line record ───────────────────────────────────────────────────

interface LevelLine {
  line: PriceLineHandle
  level: FibLevel
}

// Golden-pocket baseline constants
const GP_BASE = {
  topLineColor:     'rgba(234, 179, 8, 0.4)',
  topFillColor1:    'rgba(234, 179, 8, 0.12)',
  topFillColor2:    'rgba(234, 179, 8, 0.06)',
  bottomLineColor:  'transparent',
  bottomFillColor1: 'transparent',
  bottomFillColor2: 'transparent',
} as const

const GP_LIT = {
  topLineColor:  'rgba(234, 179, 8, 0.9)',
  topFillColor1: 'rgba(234, 179, 8, 0.30)',
  topFillColor2: 'rgba(234, 179, 8, 0.18)',
} as const

// ── Overlay ───────────────────────────────────────────────────────────────────

export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'
  private engine: DrawingEngine | null = null
  private gpFillH: SeriesHandle | null = null
  private hostH: SeriesHandle | null = null
  private levelLines: LevelLine[] = []
  private gpLit = false

  mount(engine: DrawingEngine): void {
    this.engine = engine

    // Golden pocket fill: 0.618 → 0.650 band
    this.gpFillH = engine.addBaselineSeries({
      baseValue:              0,
      ...GP_BASE,
      lineWidth:              1,
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.gpFillH, [])

    // Invisible host series for price lines
    this.hostH = engine.addLineSeries({
      color:                  'rgba(0,0,0,0)',
      priceLineVisible:       false,
      lastValueVisible:       false,
      crosshairMarkerVisible: false,
      excludeFromAutoscale:   true,
    })
    engine.setData(this.hostH, [])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const fib = data?.fibonacci

    if (!fib?.available || fib.levels.length === 0 || !this.engine || !this.gpFillH || !this.hostH) {
      if (this.engine && this.gpFillH) this.engine.setData(this.gpFillH, [])
      return
    }

    const allTimes = data!.candles.map(c => Math.floor(c.openTime / 1000))
    // Golden pocket fill only over the most recent 80 candles so it reads as a current zone
    const recentTimes = allTimes.slice(-80)

    // Golden pocket fill between 0.618 and 0.650
    const gp618 = fib.levels.find(l => l.ratio === 0.618)
    const gp650 = fib.levels.find(l => l.ratio === 0.650)

    if (gp618 && gp650 && recentTimes.length > 0) {
      const gpTop = Math.max(gp618.price, gp650.price)
      const gpBot = Math.min(gp618.price, gp650.price)
      this.engine.applySeriesOptions(this.gpFillH, { ...GP_BASE, baseValue: { type: 'price', price: gpBot } })
      this.engine.setData(this.gpFillH, recentTimes.map(time => ({ time, value: gpTop })))
    } else {
      this.engine.setData(this.gpFillH, [])
    }

    // Draw a price line per level — hide axis label on extension levels to reduce clutter
    for (const level of fib.levels) {
      const suffix = level.confluence ? ' ✦' : ''
      const title  = `${level.label}${suffix}`
      const line = this.engine.addPriceLine(this.hostH, {
        price:            level.price,
        color:            colorForLevel(level),
        lineWidth:        lineWidthForLevel(level),
        lineStyle:        lineStyleForLevel(level),
        axisLabelVisible: !level.isExtension,
        title,
      })
      this.levelLines.push({ line, level })
    }

    // Suppress labels for retrace levels within 14px of a higher-priority neighbour.
    // This prevents 0.618/0.650 golden pocket labels from overlapping at compressed zoom.
    this.deCollideLabels()
  }

  private deCollideLabels(): void {
    if (!this.engine || !this.hostH) return
    // Lower index = higher priority
    const PRIORITY: Partial<Record<number, number>> = {
      0.618: 1, 0.650: 2, 0.500: 3, 0.382: 4, 1.000: 5, 0.786: 6, 0.236: 7,
    }
    const retrace = this.levelLines
      .filter(({ level }) => !level.isExtension)
      .sort((a, b) => (PRIORITY[a.level.ratio] ?? 99) - (PRIORITY[b.level.ratio] ?? 99))

    const usedCoords: number[] = []
    for (const { line, level } of retrace) {
      const coord = this.engine.priceToCoordinate(this.hostH, level.price)
      if (coord === null) continue
      const tooClose = usedCoords.some(c => Math.abs(c - coord) < 14)
      if (tooClose) {
        this.engine.updatePriceLine(line, { axisLabelVisible: false })
      } else {
        usedCoords.push(coord)
      }
    }
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.gpFillH) this.engine.applySeriesOptions(this.gpFillH, { visible })
    if (this.hostH)   this.engine.applySeriesOptions(this.hostH, { visible })
  }

  // ── Highlight ────────────────────────────────────────────────────────────────

  highlight(key: string | null): void {
    this.applyLevelHighlight(key)
    this.applyGoldenPocketHighlight(key)
  }

  private applyLevelHighlight(key: string | null): void {
    if (!this.engine) return
    for (const { line, level } of this.levelLines) {
      const base = lineWidthForLevel(level)
      const lit =
        key === 'fib:all' ||
        key === `fib:ratio:${level.ratio}` ||
        (key === 'fib:golden-pocket' && (level.ratio === 0.618 || level.ratio === 0.650))

      const w = (lit ? Math.min(base + 2, 4) : base) as 1 | 2 | 3 | 4
      this.engine.updatePriceLine(line, { lineWidth: w })
    }
  }

  private applyGoldenPocketHighlight(key: string | null): void {
    if (!this.engine || !this.gpFillH) return
    const lit = key === 'fib:golden-pocket' || key === 'fib:all'
    if (lit === this.gpLit) return
    this.gpLit = lit
    this.engine.applySeriesOptions(this.gpFillH, lit ? GP_LIT : GP_BASE)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  private clearLines(): void {
    if (!this.engine) return
    for (const { line } of this.levelLines) this.engine.removePriceLine(line)
    this.levelLines = []
    this.gpLit = false
  }

  dispose(): void {
    this.clearLines()
    if (this.engine) {
      if (this.gpFillH) this.engine.removeSeries(this.gpFillH)
      if (this.hostH)   this.engine.removeSeries(this.hostH)
    }
    this.gpFillH = null
    this.hostH   = null
    this.engine  = null
  }
}
