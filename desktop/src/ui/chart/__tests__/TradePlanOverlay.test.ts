import { describe, expect, it } from 'vitest'
import { TradePlanOverlay } from '../overlays/TradePlanOverlay'
import type { DrawingInstruction } from '../drawing/types'
import type { PipelineResult } from '../../../modules/pipeline/types'
import type { DrawingEngine } from '../drawing/DrawingEngine'

function makeData(direction: 'long' | 'short', actionable = false): PipelineResult {
  const candles = [
    { openTime: 1_000, open: 100, high: 102, low: 98, close: 100 },
    { openTime: 2_000, open: 100, high: 103, low: 99, close: 101 },
  ]

  const tradePlan = direction === 'long'
    ? {
        direction,
        entryZone: { lower: 95, upper: 97 },
        invalidationLevel: 92,
        targetLevel: 110,
        targets: [110, 118],
        riskRewardRatio: 4.0,
        setupQuality: actionable ? 'good' : 'avoid',
        setupQualityReason: actionable ? 'valid' : 'wait for entry',
        actionable,
        patienceMessage: 'Wait for entry',
        maturityScore: 70,
        maturityLabel: 'developing',
        maturityComponents: { momentum: 70, volume: 70, trend: 70, structure: 70, confidence: 70 },
        maturityPrimaryConcern: null,
      }
    : {
        direction,
        entryZone: { lower: 103, upper: 105 },
        invalidationLevel: 110,
        targetLevel: 90,
        targets: [90, 82],
        riskRewardRatio: 3.0,
        setupQuality: actionable ? 'good' : 'avoid',
        setupQualityReason: actionable ? 'valid' : 'wait for entry',
        actionable,
        patienceMessage: 'Wait for entry',
        maturityScore: 70,
        maturityLabel: 'developing',
        maturityComponents: { momentum: 70, volume: 70, trend: 70, structure: 70, confidence: 70 },
        maturityPrimaryConcern: null,
      }

  return { candles, tradePlan } as unknown as PipelineResult
}

function render(data: PipelineResult): DrawingInstruction[] {
  let rendered: DrawingInstruction[] = []
  const engine = {
    render: (_layer: string, instructions: DrawingInstruction[]) => { rendered = instructions },
    clearLayer: () => undefined,
  } as unknown as DrawingEngine

  const overlay = new TradePlanOverlay()
  overlay.mount(engine)
  overlay.update(data, { fromSec: 1, toSec: 17 })
  return rendered
}

describe('TradePlanOverlay future projection', () => {
  it('renders a non-actionable long setup as a bounded future green/red projection', () => {
    const instructions = render(makeData('long'))
    const zones = instructions.filter(i => i.kind === 'zone')
    const lines = instructions.filter(i => i.kind === 'hline')

    expect(zones).toHaveLength(3)
    // TP/SL/entry must never become full-width historical lines.
    expect(lines).toHaveLength(0)
    expect(zones.every(z => z.kind === 'zone' && z.fromTime === 2 && z.toTime === 17)).toBe(true)

    const target = zones.find(z => z.kind === 'zone' && z.key === 'projection-target')
    const stop = zones.find(z => z.kind === 'zone' && z.key === 'projection-stop')
    expect(target).toMatchObject({ topPrice: 110, bottomPrice: 97 })
    expect(stop).toMatchObject({ topPrice: 95, bottomPrice: 92 })
  })

  it('renders the mirrored short geometry correctly', () => {
    const instructions = render(makeData('short'))
    const zones = instructions.filter(i => i.kind === 'zone')
    const lines = instructions.filter(i => i.kind === 'hline')

    expect(zones).toHaveLength(3)
    expect(lines).toHaveLength(0)

    const target = zones.find(i => i.kind === 'zone' && i.key === 'projection-target')
    const stop = zones.find(i => i.kind === 'zone' && i.key === 'projection-stop')

    expect(target).toMatchObject({ topPrice: 103, bottomPrice: 90 })
    expect(stop).toMatchObject({ topPrice: 110, bottomPrice: 105 })
  })

  it('refuses geometrically invalid levels instead of drawing a misleading box', () => {
    const data = makeData('long')
    data.tradePlan.invalidationLevel = 98
    expect(render(data)).toEqual([])
  })
})
