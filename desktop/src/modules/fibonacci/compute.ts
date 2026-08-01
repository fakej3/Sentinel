import type { SwingPoint } from '../market-structure/types'
import type { TrendDirection } from '../market-structure/types'
import type { SupportResistanceResult } from '../support-resistance/types'
import type { FibResult, FibLevel, FibDirection } from './types'
import type { UnavailableCode } from '../common/availability'
import { unavailable } from '../common/availability'

// 0.000 is the impulse-origin anchor (swing high for bullish, swing low for bearish).
// Without it the chart shows retracement lines with no anchor at the starting extreme,
// making the Fibonacci grid appear to float with no reference point.
const RETRACEMENT_RATIOS = [0.000, 0.236, 0.382, 0.500, 0.618, 0.650, 0.786, 1.000]
const EXTENSION_RATIOS   = [1.272, 1.618, 2.000]
const ALL_RATIOS = [...RETRACEMENT_RATIOS, ...EXTENSION_RATIOS]

const GOLDEN_POCKET = new Set([0.618, 0.650])
const CONFLUENCE_TOLERANCE = 0.005   // 0.5%
const SWING_LOOKBACK = 20
/**
 * Minimum impulse size as a multiple of ATR.
 * Rationale: ATR is the market's own unit of one-bar noise. An "impulse" leg
 * smaller than one ATR is indistinguishable from ordinary bar-to-bar movement,
 * so retracement levels inside it subdivide noise, not structure. 1.0 is the
 * smallest multiple with a defensible meaning ("the leg exceeded typical
 * single-bar range") — it is deliberately the least aggressive valid filter.
 */
const MIN_IMPULSE_ATR_MULT = 1.0

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
    // A broken zone is no longer a level the market respects — confluence
    // with a dead level is not confluence.
    if (zone.broken) continue
    const ref   = zone.center
    const delta = Math.abs(price - ref) / ref
    if (delta <= CONFLUENCE_TOLERANCE) {
      return { confluence: true, confluenceType: zone.type }
    }
  }
  return { confluence: false }
}

/**
 * @param atr Current ATR in price units (Wilder-14, from the indicator engine).
 *            Used to reject impulses smaller than MIN_IMPULSE_ATR_MULT × ATR.
 *            Pass null only when ATR is genuinely unavailable (< 15 candles) —
 *            the size filter is then skipped, since there is no volatility
 *            unit to measure against.
 */
export function computeFibonacci(
  swings: SwingPoint[],
  trend: TrendDirection,
  sr: SupportResistanceResult,
  atr: number | null,
): FibResult {
  const withhold = (code: UnavailableCode, detail: string): FibResult => ({
    swingHigh: { price: 0, timestamp: 0 },
    swingLow:  { price: 0, timestamp: 0 },
    direction: 'bullish',
    levels: [],
    available: false,
    unavailable: unavailable(code, detail),
  })

  // 'not-applicable': the data is fine and the computation would produce
  // numbers; a retracement of a move that never happened is just meaningless.
  if (trend === 'ranging') {
    return withhold('not-applicable', 'Ranging market — no directional impulse to measure.')
  }

  // 'insufficient-structure': more history would not necessarily help. The
  // market has to print the impulse leg first.
  const pair = findDominantPair(swings, trend)
  if (!pair) {
    return withhold('insufficient-structure',
      `No confirmed ${trend === 'bullish' ? 'HH+HL' : 'LL+LH'} impulse leg in recent swings.`)
  }

  const { high, low } = pair
  const range     = high.price - low.price
  // 'malformed-input': a swing high at or below its swing low violates an
  // invariant the range arithmetic depends on.
  if (range <= 0) return withhold('malformed-input', 'Degenerate impulse (non-positive range).')

  if (atr !== null && range < MIN_IMPULSE_ATR_MULT * atr) {
    return withhold('not-applicable',
      `Impulse of ${range.toFixed(2)} is below ${MIN_IMPULSE_ATR_MULT}× ATR (${atr.toFixed(2)}) — leg is within noise range.`)
  }

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
    unavailable: null,
  }
}
