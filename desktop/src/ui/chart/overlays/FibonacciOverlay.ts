import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { LineStyleValue, ZoneHandle, HorizontalLineHandle } from '../drawing/types'
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
  line: HorizontalLineHandle
  level: FibLevel
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

// ── Overlay ───────────────────────────────────────────────────────────────────

export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'
  private engine:     DrawingEngine | null = null
  private gpZoneH:    ZoneHandle | null = null
  private levelLines: LevelLine[] = []
  private gpLit = false

  mount(engine: DrawingEngine): void {
    this.engine  = engine
    this.gpZoneH = engine.addZone({
      topPrice:    0,
      bottomPrice: 0,
      ...GP_BASE,
      times: [],
    })
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const fib = data?.fibonacci

    if (!fib?.available || fib.levels.length === 0 || !this.engine || !this.gpZoneH) {
      if (this.engine && this.gpZoneH) this.engine.updateZone(this.gpZoneH, { times: [] })
      return
    }

    const recentTimes = data!.candles.slice(-80).map(c => Math.floor(c.openTime / 1000))

    // Golden pocket fill between 0.618 and 0.650
    const gp618 = fib.levels.find(l => l.ratio === 0.618)
    const gp650 = fib.levels.find(l => l.ratio === 0.650)

    if (gp618 && gp650 && recentTimes.length > 0) {
      const gpTop = Math.max(gp618.price, gp650.price)
      const gpBot = Math.min(gp618.price, gp650.price)
      this.engine.updateZone(this.gpZoneH, { topPrice: gpTop, bottomPrice: gpBot, times: recentTimes })
    } else {
      this.engine.updateZone(this.gpZoneH, { times: [] })
    }

    for (const level of fib.levels) {
      const suffix = level.confluence ? ' ✦' : ''
      const title  = `${level.label}${suffix}`
      const line = this.engine.addHorizontalLine({
        price:            level.price,
        color:            colorForLevel(level),
        lineWidth:        lineWidthForLevel(level),
        lineStyle:        lineStyleForLevel(level),
        axisLabelVisible: !level.isExtension,
        title,
      })
      this.levelLines.push({ line, level })
    }

    this.deCollideLabels()
  }

  private deCollideLabels(): void {
    if (!this.engine) return
    const PRIORITY: Partial<Record<number, number>> = {
      0.618: 1, 0.650: 2, 0.500: 3, 0.382: 4, 1.000: 5, 0.786: 6, 0.236: 7,
    }
    const retrace = this.levelLines
      .filter(({ level }) => !level.isExtension)
      .sort((a, b) => (PRIORITY[a.level.ratio] ?? 99) - (PRIORITY[b.level.ratio] ?? 99))

    const usedCoords: number[] = []
    for (const { line, level } of retrace) {
      const coord = this.engine.priceToCoordinate(level.price)
      if (coord === null) continue
      const tooClose = usedCoords.some(c => Math.abs(c - coord) < 14)
      if (tooClose) {
        this.engine.updateHorizontalLine(line, { axisLabelVisible: false })
      } else {
        usedCoords.push(coord)
      }
    }
  }

  setVisible(visible: boolean): void {
    if (!this.engine) return
    if (this.gpZoneH) this.engine.updateZone(this.gpZoneH, { visible })
    for (const { line } of this.levelLines) this.engine.updateHorizontalLine(line, { visible })
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
      this.engine.updateHorizontalLine(line, { lineWidth: w })
    }
  }

  private applyGoldenPocketHighlight(key: string | null): void {
    if (!this.engine || !this.gpZoneH) return
    const lit = key === 'fib:golden-pocket' || key === 'fib:all'
    if (lit === this.gpLit) return
    this.gpLit = lit
    this.engine.updateZone(this.gpZoneH, lit ? GP_LIT : GP_BASE)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  private clearLines(): void {
    if (!this.engine) return
    for (const { line } of this.levelLines) this.engine.removeHorizontalLine(line)
    this.levelLines = []
    this.gpLit = false
  }

  dispose(): void {
    this.clearLines()
    if (this.engine && this.gpZoneH) this.engine.removeZone(this.gpZoneH)
    this.gpZoneH = null
    this.engine  = null
  }
}
