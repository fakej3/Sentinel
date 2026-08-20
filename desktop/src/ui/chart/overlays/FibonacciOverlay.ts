import type { DrawingEngine } from '../drawing/DrawingEngine'
import { LineStyle } from '../drawing/types'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { IAnalysisOverlay, ChartTimeRange } from '../types'

/** Signal-first Fibonacci: show the impulse and the actionable retracement pocket, not a ladder of every ratio. */
export class FibonacciOverlay implements IAnalysisOverlay {
  readonly id = 'fibonacci'
  private engine: DrawingEngine | null = null
  private data: PipelineResult | null = null
  private range: ChartTimeRange | null = null
  private visible = true
  private highlightKey: string | null = null

  mount(engine: DrawingEngine): void { this.engine = engine }
  update(data: PipelineResult | null, range: ChartTimeRange | null): void {
    this.data = data
    this.range = range
    this.submit()
  }
  setVisible(visible: boolean): void { this.visible = visible; this.submit() }
  highlight(key: string | null): void { this.highlightKey = key; this.submit() }
  dispose(): void { this.engine?.clearLayer(this.id); this.engine = null }
  private submit(): void { this.engine?.render(this.id, this.buildInstructions()) }

  private buildInstructions(): DrawingInstruction[] {
    const fib = this.data?.fibonacci
    if (!fib?.available || !this.range) return []

    const start = Math.min(Math.floor(fib.swingLow.timestamp / 1000), Math.floor(fib.swingHigh.timestamp / 1000))
    const end = this.range.toSec
    const lit = this.highlightKey === 'fib:all' || this.highlightKey === 'fib:golden-pocket'
    const levels = fib.levels.filter(l => !l.isExtension)
    const golden = levels.filter(l => l.isGoldenPocket)
    const zero = levels.find(l => Math.abs(l.ratio) < 0.0001)
    const one = levels.find(l => Math.abs(l.ratio - 1) < 0.0001)
    const instructions: DrawingInstruction[] = []

    instructions.push({
      kind: 'polyline',
      key: 'impulse-leg',
      color: 'rgba(245,158,11,0.50)',
      lineWidth: lit ? 2 : 1,
      lineStyle: LineStyle.SparseDotted,
      data: [
        { time: Math.floor(fib.swingLow.timestamp / 1000), value: fib.swingLow.price },
        { time: Math.floor(fib.swingHigh.timestamp / 1000), value: fib.swingHigh.price },
      ],
      visible: this.visible,
    })

    instructions.push({
      kind: 'markerset',
      key: 'fib-anchors',
      anchor: [
        { time: Math.floor(fib.swingLow.timestamp / 1000), value: fib.swingLow.price },
        { time: Math.floor(fib.swingHigh.timestamp / 1000), value: fib.swingHigh.price },
      ],
      markers: [
        { time: Math.floor(fib.swingLow.timestamp / 1000), position: 'belowBar', shape: 'circle', color: '#f59e0b', text: '', size: 2 },
        { time: Math.floor(fib.swingHigh.timestamp / 1000), position: 'aboveBar', shape: 'circle', color: '#f59e0b', text: '', size: 2 },
      ],
      visible: this.visible,
    })

    if (golden.length >= 2 && start < end) {
      const top = Math.max(...golden.map(l => l.price))
      const bottom = Math.min(...golden.map(l => l.price))
      instructions.push({
        kind: 'zone',
        key: 'golden-pocket',
        topPrice: top,
        bottomPrice: bottom,
        fillColor1: lit ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.045)',
        fillColor2: 'rgba(245,158,11,0.015)',
        lineColor: lit ? 'rgba(245,158,11,0.60)' : 'rgba(245,158,11,0.28)',
        fromTime: start,
        toTime: end,
        visible: this.visible,
      })
      for (const g of golden) {
        instructions.push({
          kind: 'polyline',
          key: `fib-${g.ratio}`,
          color: lit ? 'rgba(245,158,11,0.85)' : 'rgba(245,158,11,0.42)',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          data: [{ time: start, value: g.price }, { time: end, value: g.price }],
          visible: this.visible,
        })
      }
    }

    // Only the impulse anchors receive axis labels. The trade plan owns actual
    // entry/target levels, preventing duplicate price labels.
    for (const [ratio, item, title] of [[0, zero, '0'], [1, one, '1']] as const) {
      if (!item) continue
      instructions.push({
        kind: 'hline',
        key: `fib-anchor-${ratio}`,
        price: item.price,
        color: 'rgba(245,158,11,0.18)',
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title,
        visible: this.visible,
      })
    }

    return instructions
  }
}
