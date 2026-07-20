import type { PipelineResult } from '../pipeline/types'
import type { Candle } from '../market/types'
import type { TrackedTrade, TradeDirection, TradeOutcome } from './types'

let _counter = 0
function nextId(): string {
  return `trade_${++_counter}`
}

/** Derive trade direction from the trade plan */
function detectDirection(result: PipelineResult): TradeDirection | null {
  const plan = result.tradePlan
  if (!plan.actionable || !plan.entryZone || plan.invalidationLevel === null) return null
  return plan.invalidationLevel < plan.entryZone.lower ? 'bullish' : 'bearish'
}

/**
 * Decide whether the current result constitutes a genuinely new trade setup
 * (as opposed to the same setup persisting across candles).
 */
function isNewSetup(last: TrackedTrade | null, result: PipelineResult, dir: TradeDirection): boolean {
  if (!last) return true
  const plan = result.tradePlan
  if (!plan.entryZone) return true
  if (last.direction !== dir) return true
  // Treat it as a new setup only if the entry mid shifts by more than 0.2%
  const newMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
  return Math.abs(newMid - last.entryMid) / last.entryMid > 0.002
}

/** Update MFE/MAE and check TP/SL for one candle */
function advanceTrade(trade: TrackedTrade, candle: Candle, candleIndex: number): TrackedTrade {
  const { direction, entryMid, takeProfit, stopLoss } = trade

  const favorable = direction === 'bullish' ? candle.high - entryMid : entryMid - candle.low
  const adverse   = direction === 'bullish' ? entryMid - candle.low  : candle.high - entryMid

  const mfe = Math.max(trade.mfe, Math.max(0, favorable))
  const mae = Math.max(trade.mae, Math.max(0, adverse))

  let outcome: TradeOutcome = 'open'
  let exitPrice: number | null = null

  if (direction === 'bullish') {
    if (candle.high >= takeProfit) { outcome = 'tp_hit'; exitPrice = takeProfit }
    else if (candle.low <= stopLoss) { outcome = 'sl_hit'; exitPrice = stopLoss }
  } else {
    if (candle.low <= takeProfit)  { outcome = 'tp_hit'; exitPrice = takeProfit }
    else if (candle.high >= stopLoss) { outcome = 'sl_hit'; exitPrice = stopLoss }
  }

  if (outcome !== 'open') {
    return {
      ...trade, mfe, mae, outcome, exitPrice,
      exitIndex: candleIndex,
      exitTimestamp: candle.openTime,
      durationCandles: candleIndex - trade.detectedAtIndex,
    }
  }
  return { ...trade, mfe, mae }
}

/**
 * Tracks trade setups across replay frames.
 *
 * At each frame:
 *  1. Advance all open trades (MFE/MAE, TP/SL check) on the newest candle.
 *  2. Check whether the current PipelineResult contains a new unique setup.
 *  3. If yes, record it.
 */
export class TradeTracker {
  private trades: TrackedTrade[] = []
  private lastSetup: TrackedTrade | null = null

  processFrame(
    index: number,
    result: PipelineResult,
    latestCandle: Candle,
  ): { newTrade: TrackedTrade | null; trades: TrackedTrade[] } {
    // 1. Advance open trades on this candle
    this.trades = this.trades.map(t =>
      t.outcome === 'open' ? advanceTrade(t, latestCandle, index) : t,
    )

    // 2. Detect new setup
    const plan = result.tradePlan
    const dir  = detectDirection(result)

    if (!dir || !plan.entryZone || plan.invalidationLevel === null || plan.targetLevel === null) {
      return { newTrade: null, trades: this.trades }
    }

    if (!isNewSetup(this.lastSetup, result, dir)) {
      return { newTrade: null, trades: this.trades }
    }

    const entryMid = (plan.entryZone.lower + plan.entryZone.upper) / 2
    const risk     = Math.abs(entryMid - plan.invalidationLevel)
    const reward   = Math.abs(plan.targetLevel - entryMid)

    const trade: TrackedTrade = {
      id: nextId(),
      direction: dir,
      detectedAtIndex: index,
      detectedTimestamp: latestCandle.openTime,
      entryZoneLower: plan.entryZone.lower,
      entryZoneUpper: plan.entryZone.upper,
      entryMid,
      stopLoss:     plan.invalidationLevel,
      takeProfit:   plan.targetLevel,
      riskRewardRatio: risk > 0 ? reward / risk : null,
      confidence:   result.confidence.score,
      setupQuality: plan.setupQuality,
      trend:        result.marketStructure.trend,
      outcome:      'open',
      exitIndex:    null,
      exitPrice:    null,
      exitTimestamp: null,
      mfe: 0,
      mae: 0,
      durationCandles: null,
    }

    this.trades.push(trade)
    this.lastSetup = trade

    return { newTrade: trade, trades: this.trades }
  }

  getTrades(): TrackedTrade[] {
    return [...this.trades]
  }

  reset(): void {
    this.trades    = []
    this.lastSetup = null
    _counter       = 0
  }
}
