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
import type { IAnalysisOverlay } from '../types'

const FILL_DIM = { topFillColor1: 'rgba(59, 130, 246, 0.10)', topFillColor2: 'rgba(59, 130, 246, 0.10)', topLineColor: 'rgba(59, 130, 246, 0.4)' } as const
const FILL_LIT = { topFillColor1: 'rgba(59, 130, 246, 0.25)', topFillColor2: 'rgba(59, 130, 246, 0.25)', topLineColor: 'rgba(59, 130, 246, 0.9)' } as const

export class EntryZoneOverlay implements IAnalysisOverlay {
  readonly id = 'entry-zone'
  private chart: IChartApi | null = null
  private fill: ISeriesApi<'Baseline'> | null = null
  private host: ISeriesApi<'Line'> | null = null
  private lines: IPriceLine[] = []
  private lit = false

  mount(chart: IChartApi): void {
    this.chart = chart

    this.fill = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      ...FILL_DIM,
      bottomFillColor1: 'transparent',
      bottomFillColor2: 'transparent',
      bottomLineColor: 'transparent',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    })
    this.fill.setData([])

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
    const plan = data?.tradePlan

    if (!data || !plan?.actionable || !plan.entryZone) {
      this.fill?.setData([])
      return
    }

    const { lower, upper } = plan.entryZone
    const mid = (lower + upper) / 2

    // Fill only the most recent 80 candles so it reads as a current zone
    const recentCandles = data.candles.slice(-80)
    this.fill!.applyOptions({ baseValue: { type: 'price', price: lower } })
    this.fill!.setData(recentCandles.map(c => ({
      time: Math.floor(c.openTime / 1000) as UTCTimestamp,
      value: upper,
    })))

    // Single boundary lines — no axis labels except center label
    this.lines.push(this.host!.createPriceLine({
      price: lower,
      color: 'rgba(59, 130, 246, 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    }))
    this.lines.push(this.host!.createPriceLine({
      price: upper,
      color: 'rgba(59, 130, 246, 0.5)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    }))
    // Single 'Entry' label at midpoint
    this.lines.push(this.host!.createPriceLine({
      price: mid,
      color: 'rgba(0,0,0,0)',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'Entry',
    }))
  }

  highlight(key: string | null): void {
    const lit = key === 'entry:zone' || key === 'trade:full'
    if (lit === this.lit) return
    this.lit = lit
    this.fill?.applyOptions(lit ? FILL_LIT : FILL_DIM)
    const w = lit ? 2 : 1
    for (const line of this.lines) line.applyOptions({ lineWidth: w })
  }

  private clearLines(): void {
    if (!this.host) return
    for (const line of this.lines) this.host.removePriceLine(line)
    this.lines = []
  }

  dispose(): void {
    this.clearLines()
    if (this.chart) {
      if (this.fill) this.chart.removeSeries(this.fill)
      if (this.host) this.chart.removeSeries(this.host)
    }
    this.fill = null
    this.host = null
    this.chart = null
  }
}
