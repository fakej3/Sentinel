import {
  BaselineSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts'
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

function lineStyleForLevel(level: FibLevel): LineStyle {
  return level.isExtension ? LineStyle.Dashed : LineStyle.Dotted
}

// ── Typed level-line record ───────────────────────────────────────────────────

interface LevelLine {
  line: IPriceLine
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
  topLineColor:     'rgba(234, 179, 8, 0.9)',
  topFillColor1:    'rgba(234, 179, 8, 0.30)',
  topFillColor2:    'rgba(234, 179, 8, 0.18)',
} as const

// ── Overlay ───────────────────────────────────────────────────────────────────

export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'
  private chart: IChartApi | null = null
  private gpFill: ISeriesApi<'Baseline'> | null = null
  private host: ISeriesApi<'Line'> | null = null
  private levelLines: LevelLine[] = []
  private gpLit = false

  mount(chart: IChartApi): void {
    this.chart = chart

    // Golden pocket fill: 0.618 → 0.650 band
    this.gpFill = chart.addSeries(BaselineSeries, {
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
      ...GP_BASE,
      baseValue: { type: 'price', price: 0 },
    })
    this.gpFill.setData([])

    // Invisible host series for price lines
    this.host = chart.addSeries(LineSeries, {
      color: 'rgba(0,0,0,0)',
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    })
    this.host.setData([])
  }

  update(data: PipelineResult | null): void {
    this.clearLines()
    const fib = data?.fibonacci

    if (!fib?.available || fib.levels.length === 0) {
      this.gpFill?.setData([])
      return
    }

    const allTimes = data!.candles.map(c => Math.floor(c.openTime / 1000) as UTCTimestamp)
    // Golden pocket fill only over the most recent 80 candles so it reads as a current zone
    const recentTimes = allTimes.slice(-80)

    // Golden pocket fill between 0.618 and 0.650
    const gp618 = fib.levels.find(l => l.ratio === 0.618)
    const gp650 = fib.levels.find(l => l.ratio === 0.650)

    if (gp618 && gp650 && recentTimes.length > 0) {
      const gpTop = Math.max(gp618.price, gp650.price)
      const gpBot = Math.min(gp618.price, gp650.price)
      this.gpFill!.applyOptions({ ...GP_BASE, baseValue: { type: 'price', price: gpBot } })
      this.gpFill!.setData(recentTimes.map(time => ({ time, value: gpTop })))
    } else {
      this.gpFill?.setData([])
    }

    // Draw a price line per level — hide axis label on extension levels to reduce clutter
    for (const level of fib.levels) {
      const suffix = level.confluence ? ' ✦' : ''
      const title  = `${level.label}${suffix}`
      const line = this.host!.createPriceLine({
        price: level.price,
        color: colorForLevel(level),
        lineWidth: lineWidthForLevel(level),
        lineStyle: lineStyleForLevel(level),
        axisLabelVisible: !level.isExtension,
        title,
      })
      this.levelLines.push({ line, level })
    }
  }

  // ── Highlight ────────────────────────────────────────────────────────────────

  highlight(key: string | null): void {
    this.applyLevelHighlight(key)
    this.applyGoldenPocketHighlight(key)
  }

  private applyLevelHighlight(key: string | null): void {
    for (const { line, level } of this.levelLines) {
      const base = lineWidthForLevel(level)
      const lit =
        key === 'fib:all' ||
        key === `fib:ratio:${level.ratio}` ||
        (key === 'fib:golden-pocket' && (level.ratio === 0.618 || level.ratio === 0.650))

      const w = lit ? Math.min(base + 2, 4) as 1 | 2 | 3 | 4 : base
      line.applyOptions({ lineWidth: w })
    }
  }

  private applyGoldenPocketHighlight(key: string | null): void {
    if (!this.gpFill) return
    const lit = key === 'fib:golden-pocket' || key === 'fib:all'
    if (lit === this.gpLit) return
    this.gpLit = lit
    this.gpFill.applyOptions(lit ? GP_LIT : GP_BASE)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  private clearLines(): void {
    if (!this.host) return
    for (const { line } of this.levelLines) this.host.removePriceLine(line)
    this.levelLines = []
    this.gpLit = false
  }

  dispose(): void {
    this.clearLines()
    if (this.chart) {
      if (this.gpFill) this.chart.removeSeries(this.gpFill)
      if (this.host)   this.chart.removeSeries(this.host)
    }
    this.gpFill = null
    this.host   = null
    this.chart  = null
  }
}
