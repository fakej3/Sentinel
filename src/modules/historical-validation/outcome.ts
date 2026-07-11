import type { Candle } from '../binance/types'
import type { TradePlan } from '../pipeline/types'
import type { TradeOutcome } from './types'

/**
 * Simulate a trade outcome by scanning forward candles for TP or SL hits.
 *
 * Conventions:
 *   Entry price  = midpoint of entryZone (lower + upper) / 2
 *   MFE/MAE      = peak favorable/adverse move relative to entry price
 *   Same candle  = if both SL and TP are touched within one candle, SL is
 *                  assumed to hit first (conservative — no cherry-picking)
 *   no_trade     = plan not actionable, entryZone null, or direction neutral
 */
export function simulateOutcome(
  snapshotId: string,
  tradePlan: TradePlan,
  direction: 'bullish' | 'bearish' | 'neutral',
  forwardCandles: Candle[],
): TradeOutcome {
  if (
    !tradePlan.actionable
    || tradePlan.entryZone === null
    || tradePlan.invalidationLevel === null
    || tradePlan.targetLevel === null
    || direction === 'neutral'
  ) {
    return {
      snapshotId,
      result: 'no_trade',
      barsToOutcome: null,
      mfe: 0,
      mfePct: 0,
      mae: 0,
      maePct: 0,
      actualRR: null,
      entryPrice: null,
      stopPrice: tradePlan.invalidationLevel,
      targetPrice: tradePlan.targetLevel,
    }
  }

  const entryPrice = (tradePlan.entryZone.lower + tradePlan.entryZone.upper) / 2
  const stopPrice  = tradePlan.invalidationLevel
  const targetPrice = tradePlan.targetLevel
  const isBullish   = direction === 'bullish'

  let maxMFE = 0
  let maxMAE = 0
  let result: TradeOutcome['result'] = 'neither'
  let barsToOutcome: number | null = null

  for (let i = 0; i < forwardCandles.length; i++) {
    const { high, low } = forwardCandles[i]

    // Update running MFE and MAE
    if (isBullish) {
      maxMFE = Math.max(maxMFE, high - entryPrice)
      maxMAE = Math.max(maxMAE, entryPrice - low)
    } else {
      maxMFE = Math.max(maxMFE, entryPrice - low)
      maxMAE = Math.max(maxMAE, high - entryPrice)
    }

    const slHit = isBullish ? low  <= stopPrice  : high >= stopPrice
    const tpHit = isBullish ? high >= targetPrice : low  <= targetPrice

    // Conservative: when both touched in same candle, assume SL hit first
    if (slHit) {
      result = 'sl_hit'
      barsToOutcome = i + 1
      break
    }
    if (tpHit) {
      result = 'tp_hit'
      barsToOutcome = i + 1
      break
    }
  }

  const mfe = Math.max(0, maxMFE)
  const mae = Math.max(0, maxMAE)
  const mfePct = entryPrice > 0 ? (mfe / entryPrice) * 100 : 0
  const maePct = entryPrice > 0 ? (mae / entryPrice) * 100 : 0

  const actualRR = result === 'tp_hit'
    ? (tradePlan.riskRewardRatio ?? null)
    : result === 'sl_hit'
    ? -1.0
    : null

  return {
    snapshotId,
    result,
    barsToOutcome,
    mfe,
    mfePct,
    mae,
    maePct,
    actualRR,
    entryPrice,
    stopPrice,
    targetPrice,
  }
}
