import { describe, it, expect } from 'vitest'
import { computeAtr } from '../compute/atr'

// Build candle arrays where H = C+1, L = C-1 (no gaps between candles)
function makeCandles(closes: number[]) {
  const highs = closes.map(c => c + 1)
  const lows = closes.map(c => c - 1)
  return { highs, lows, closes }
}

describe('computeAtr', () => {
  it('returns null when closes.length < period + 1', () => {
    const { highs, lows, closes } = makeCandles(Array(14).fill(100))
    expect(computeAtr(highs, lows, closes, 14)).toBeNull()
  })

  it('returns the constant range when H-L is always equal and there are no gaps', () => {
    // Each candle: H = C+1, L = C-1, range = 2, no close-to-close gap
    // TR = max(2, |H-PrevClose|, |L-PrevClose|)
    // Since next close = prev close + 0 (constant close), TR = max(2, 1, 1) = 2
    // Actually if all closes are the same, H = C+1 = same every bar
    // TR at bar i = max(H[i]-L[i], |H[i]-C[i-1]|, |L[i]-C[i-1]|)
    //             = max(2, |C+1-C|, |C-1-C|) = max(2, 1, 1) = 2
    const closes = Array(20).fill(100)
    const { highs, lows } = makeCandles(closes)
    const atr = computeAtr(highs, lows, closes, 14)!
    expect(atr).toBeCloseTo(2)
  })

  it('returns a positive value', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + i)
    const { highs, lows } = makeCandles(closes)
    const atr = computeAtr(highs, lows, closes, 14)!
    expect(atr).toBeGreaterThan(0)
  })

  it('returns a higher ATR when candles have larger ranges', () => {
    const closes = Array(30).fill(100)
    const narrowH = closes.map(c => c + 1)
    const narrowL = closes.map(c => c - 1)
    const wideH = closes.map(c => c + 5)
    const wideL = closes.map(c => c - 5)

    const narrowAtr = computeAtr(narrowH, narrowL, closes, 14)!
    const wideAtr = computeAtr(wideH, wideL, closes, 14)!
    expect(wideAtr).toBeGreaterThan(narrowAtr)
  })

  it('respects close-to-close gaps in true range', () => {
    // Create a large gap: bar 1 opens way above previous close
    const closes = [100, 120, ...Array(18).fill(120)]
    const highs = closes.map(c => c + 1)
    const lows = closes.map(c => c - 1)
    const atr = computeAtr(highs, lows, closes, 14)!
    // TR at bar 1 = max(2, |121-100|, |119-100|) = max(2, 21, 19) = 21
    // This should keep ATR above 2
    expect(atr).toBeGreaterThan(2)
  })
})
