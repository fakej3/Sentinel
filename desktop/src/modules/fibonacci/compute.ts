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
      const range = h.price - l.price
      if (range > maxRange) {
        maxRange = range
        bestHigh = h
        bestLow  = l
      }
    }
  }

  if (!bestHigh || !bestLow || maxRange <= 0) return null

  // Validate pair ordering relative to trend:
  // Bullish → the swing low should precede the swing high (price moved up)
  // Bearish → the swing high should precede the swing low (price moved down)
  // Ranging → accept whichever ordering the dominant pair naturally has
  if (trend === 'bullish' && bestHigh.index < bestLow.index) {
    // swap so that high came after low
    ;[bestHigh, bestLow] = [bestLow as unknown as SwingPoint, bestHigh as unknown as SwingPoint]
    // if types got mixed up after swap, just return whatever dominant pair we have
    if (bestHigh.type !== 'high' || bestLow.type !== 'low') return { high: bestHigh, low: bestLow }
  }
  if (trend === 'bearish' && bestLow.index < bestHigh.index) {
    ;[bestHigh, bestLow] = [bestLow as unknown as SwingPoint, bestHigh as unknown as SwingPoint]
    if (bestHigh.type !== 'high' || bestLow.type !== 'low') return { high: bestHigh, low: bestLow }
  }

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
    // Retracement: measured from the extreme back toward the origin
    // Bullish retracement → price pulls back from high toward low
    // Bearish retracement → price pulls back from low toward high
    let price: number
    if (direction === 'bullish') {
      price = high.price - ratio * range
    } else {
      price = low.price + ratio * range
    }

    const isExtension   = ratio > 1.0
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
