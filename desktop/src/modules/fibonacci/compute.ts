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

/**
 * Returns the most recently completed impulse leg that matches the trend:
 *   Bullish — most recent HH swing + the most recent HL that immediately preceded it.
 *   Bearish — most recent LL swing + the most recent LH that immediately preceded it.
 *
 * Anchoring to the most recent impulse keeps Fibonacci levels tied to the move traders
 * are currently watching rather than to whatever historical leg happened to be largest.
 */
function findMostRecentImpulse(
  labeled: SwingPoint[],
  trend: TrendDirection,
): { high: SwingPoint; low: SwingPoint } | null {
  if (trend === 'bullish') {
    const hhs = labeled.filter(s => s.label === 'HH').sort((a, b) => b.index - a.index)
    const hls = labeled.filter(s => s.label === 'HL')
    for (const hh of hhs) {
      const hl = hls.filter(l => l.index < hh.index).sort((a, b) => b.index - a.index)[0]
      if (hl && hh.price > hl.price) return { high: hh, low: hl }
    }
  } else if (trend === 'bearish') {
    const lls = labeled.filter(s => s.label === 'LL').sort((a, b) => b.index - a.index)
    const lhs = labeled.filter(s => s.label === 'LH')
    for (const ll of lls) {
      const lh = lhs.filter(h => h.index < ll.index).sort((a, b) => b.index - a.index)[0]
      if (lh && lh.price > ll.price) return { high: lh, low: ll }
    }
  }
  return null
}

function findDominantPair(
  swings: SwingPoint[],
  trend: TrendDirection,
): { high: SwingPoint; low: SwingPoint } | null {
  const labeled = swings.filter(s => s.label !== null).slice(-SWING_LOOKBACK)
  if (labeled.length < 2) return null

  const highs = labeled.filter(s => s.type === 'high')
  const lows  = labeled.filter(s => s.type === 'low')
  if (highs.length === 0 || lows.length === 0) return null

  // Require a confirmed impulse leg matching the trend direction.
  // Ranging markets and structures without a valid HH+HL or LL+LH sequence
  // return null — silence is better than Fibonacci on an arbitrary price range.
  return findMostRecentImpulse(labeled, trend)
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
