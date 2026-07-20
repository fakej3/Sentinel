import type { SwingPoint } from '../market-structure/types'
import type { TrendDirection } from '../market-structure/types'
import type { SupportResistanceResult } from '../support-resistance/types'
import type { FibResult, FibLevel, FibDirection } from './types'

const RETRACEMENT_RATIOS = [0.236, 0.382, 0.500, 0.618, 0.650, 0.786, 1.000]
const EXTENSION_RATIOS   = [1.272, 1.618, 2.000]
const ALL_RATIOS = [...RETRACEMENT_RATIOS, ...EXTENSION_RATIOS]

const GOLDEN_POCKET = new Set([0.618, 0.650])
const CONFLUENCE_TOLERANCE = 0.005   // 0.5%
const SWING_LOOKBACK = 20

function labelFor(ratio: number): string {
  if (ratio > 1.0) return `${ratio.toFixed(3)} ext`
  return ratio.toFixed(3)
}

function findDominantPair(
  swings: SwingPoint[],
  trend: TrendDirection,
): { high: SwingPoint; low: SwingPoint } | null {
  // Use the last SWING_LOOKBACK labeled swings that have a classification
  const labeled = swings.filter(s => s.label !== null).slice(-SWING_LOOKBACK)
  if (labeled.length < 2) return null

  const highs = labeled.filter(s => s.type === 'high')
  const lows  = labeled.filter(s => s.type === 'low')
  if (highs.length === 0 || lows.length === 0) return null

  // Choose the pair that spans the maximum price range — the dominant move.
  let bestHigh: SwingPoint | null = null
  let bestLow: SwingPoint | null  = null
  let maxRange = 0

  for (const h of highs) {
    for (const l of lows) {
      // Enforce temporal ordering so the Fibonacci direction is unambiguous:
      // Bullish → low must precede high (price moved up to the swing high)
      // Bearish → high must precede low (price moved down to the swing low)
      // Ranging → no constraint
      if (trend === 'bullish' && l.index >= h.index) continue
      if (trend === 'bearish' && h.index >= l.index) continue

      const range = h.price - l.price
      if (range > maxRange) {
        maxRange = range
        bestHigh = h
        bestLow  = l
      }
    }
  }

  if (!bestHigh || !bestLow || maxRange <= 0) return null

  return { high: bestHigh, low: bestLow }
}

function inferDirection(high: SwingPoint, low: SwingPoint): FibDirection {
  // If low came first → price moved up → bullish retracement
  return low.index < high.index ? 'bullish' : 'bearish'
}

function hasConfluence(
  price: number,
  sr: SupportResistanceResult,
): { confluence: boolean; confluenceType?: 'support' | 'resistance' } {
  for (const zone of sr.zones) {
    const ref   = zone.center
    const delta = Math.abs(price - ref) / ref
    if (delta <= CONFLUENCE_TOLERANCE) {
      return { confluence: true, confluenceType: zone.type }
    }
  }
  return { confluence: false }
}

export function computeFibonacci(
  swings: SwingPoint[],
  trend: TrendDirection,
  sr: SupportResistanceResult,
): FibResult {
  const unavailable: FibResult = {
    swingHigh: { price: 0, timestamp: 0 },
    swingLow:  { price: 0, timestamp: 0 },
    direction: 'bullish',
    levels: [],
    available: false,
  }

  const pair = findDominantPair(swings, trend)
  if (!pair) return unavailable

  const { high, low } = pair
  const range     = high.price - low.price
  if (range <= 0) return unavailable

  const direction = inferDirection(high, low)

  const levels: FibLevel[] = ALL_RATIOS.map(ratio => {
    // Retracements (ratio ≤ 1.0): measure back from the swing extreme toward the origin.
    // Extensions (ratio > 1.0): project beyond the swing in the trend direction.
    //   Bullish ext: price = low + ratio * range  (above swingHigh)
    //   Bearish ext: price = high - ratio * range (below swingLow)
    const isExtension = ratio > 1.0
    let price: number
    if (direction === 'bullish') {
      price = isExtension
        ? low.price + ratio * range   // target above swingHigh
        : high.price - ratio * range  // retrace from swingHigh toward swingLow
    } else {
      price = isExtension
        ? high.price - ratio * range  // target below swingLow
        : low.price + ratio * range   // retrace from swingLow toward swingHigh
    }
    const isGoldenPocket = GOLDEN_POCKET.has(ratio)
    const { confluence, confluenceType } = hasConfluence(price, sr)

    return {
      ratio,
      price,
      label: labelFor(ratio),
      isExtension,
      isGoldenPocket,
      confluence,
      ...(confluenceType !== undefined && { confluenceType }),
    }
  })

  return {
    swingHigh: { price: high.price, timestamp: high.timestamp },
    swingLow:  { price: low.price,  timestamp: low.timestamp },
    direction,
    levels,
    available: true,
  }
}
