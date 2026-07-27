/**
 * Flattens a V5 pipeline result into a scale-free design matrix row.
 *
 * TWO RULES, both load-bearing for Phase 3:
 *
 * 1. NO RAW PRICES. Every price-derived feature is expressed as a ratio to the
 *    decision-bar close or as a multiple of ATR. A feature carrying price level
 *    would let a model separate 2019 BTC from 2024 BTC and "predict" the era
 *    rather than the market — the classic pooled-panel confound.
 *
 * 2. NO SILENT DEFAULTS. An unavailable indicator is omitted, not zero-filled.
 *    Zero-filling would place "EMA200 unavailable" and "price exactly at EMA200"
 *    at the same coordinate, which is the V5 zero-VWAP defect in a new place.
 *    Downstream code must handle absence explicitly.
 */
import type { MarketAnalysisResult } from '../modules/analysis/types'
import type { ConfidenceResult } from '../modules/confidence/types'
import type { ValidationResult } from '../modules/validation/types'
import type { IndicatorResult } from '../modules/indicators/types'
import type { MarketStructureResult } from '../modules/market-structure/types'
import type { SupportResistanceResult } from '../modules/support-resistance/types'
import type { TradePlan } from '../modules/pipeline/types'

export interface PipelineSnapshot {
  readonly indicators: IndicatorResult
  readonly marketStructure: MarketStructureResult
  readonly supportResistance: SupportResistanceResult
  readonly analysis: MarketAnalysisResult
  readonly validation: ValidationResult
  readonly confidence: ConfidenceResult
  readonly tradePlan: TradePlan
}

/** Adds `key` only when `v` is a finite number. Absence stays absence. */
function put(into: Record<string, number>, key: string, v: number | null | undefined): void {
  if (typeof v === 'number' && Number.isFinite(v)) into[key] = v
}

export function extractFeatures(s: PipelineSnapshot, price: number): Record<string, number> {
  const f: Record<string, number> = {}
  const ind = s.indicators
  const atr = ind.atr

  // ── Indicators, made scale-free ────────────────────────────────────────────
  // Price-relative distance, not the level itself.
  const rel = (v: number | null): number | null =>
    v !== null && price > 0 ? (price - v) / price : null
  put(f, 'dist_ema20', rel(ind.ema20))
  put(f, 'dist_ema50', rel(ind.ema50))
  put(f, 'dist_ema100', rel(ind.ema100))
  put(f, 'dist_ema200', rel(ind.ema200))
  put(f, 'dist_sma20', rel(ind.sma20))
  put(f, 'dist_sma50', rel(ind.sma50))
  put(f, 'dist_sma200', rel(ind.sma200))
  put(f, 'rsi', ind.rsi)
  put(f, 'atr_pct', ind.atrPercent)
  if (ind.macd !== null && atr !== null && atr > 0) {
    put(f, 'macd_hist_atr', ind.macd.histogram / atr)
    put(f, 'macd_sep_atr', (ind.macd.macdLine - ind.macd.signalLine) / atr)
    if (ind.macd.previousHistogram !== null) {
      put(f, 'macd_hist_delta_atr', (ind.macd.histogram - ind.macd.previousHistogram) / atr)
    }
  }
  if (ind.adx !== null) {
    put(f, 'adx', ind.adx.adx)
    put(f, 'adx_di_spread', ind.adx.diPlus - ind.adx.diMinus)
  }
  // NOT `ind.bollingerBands.bandwidth` — that is the RAW width `upper - lower`
  // in price units, and recording it would smuggle price level into the design
  // matrix (a 1000x rescale moved it by exactly 1000x). The interpretation
  // layer's `bandwidthPercent` is the scale-free quantity, and it is the same
  // number the engine classifies `bandwidthState` from, so Phase 3 measures
  // what the engine actually reasons about.
  put(f, 'bb_bandwidth_pct', s.analysis.indicatorSummary.bollinger.bandwidthPercent)
  if (ind.stochRsi !== null) { put(f, 'stoch_k', ind.stochRsi.k); put(f, 'stoch_d', ind.stochRsi.d) }
  put(f, 'mfi', ind.mfi)
  put(f, 'cci', ind.cci)
  if (ind.volumeMA !== null) put(f, 'rel_volume', ind.volumeMA.relativeVolume)
  if (ind.vwap.available && price > 0) put(f, 'dist_vwap', (price - ind.vwap.value) / price)

  // ── Market structure ───────────────────────────────────────────────────────
  const ms = s.marketStructure
  put(f, 'ms_confidence', ms.confidence)
  put(f, 'ms_hh', ms.recentStructure.higherHighs)
  put(f, 'ms_hl', ms.recentStructure.higherLows)
  put(f, 'ms_lh', ms.recentStructure.lowerHighs)
  put(f, 'ms_ll', ms.recentStructure.lowerLows)
  put(f, 'ms_swings', ms.swings.length)
  put(f, 'ms_bos_detected', ms.bos.detected ? 1 : 0)
  put(f, 'ms_choch_detected', ms.choch.detected ? 1 : 0)
  put(f, 'ms_breakout_confirmed', ms.breakout.confirmed ? 1 : 0)
  put(f, 'ms_consolidating', ms.consolidation.detected ? 1 : 0)

  // ── S/R context — distances only, never levels ─────────────────────────────
  const sr = s.analysis.srContext
  put(f, 'sr_support_dist', sr.nearestSupportDistance)
  put(f, 'sr_resistance_dist', sr.nearestResistanceDistance)
  put(f, 'sr_inside_support', sr.insideSupport ? 1 : 0)
  put(f, 'sr_inside_resistance', sr.insideResistance ? 1 : 0)
  put(f, 'sr_active_zones', s.supportResistance.zones.length)

  // ── Volume ─────────────────────────────────────────────────────────────────
  const vc = s.analysis.volumeContext
  put(f, 'vol_relative', vc.relativeVolume)
  put(f, 'vol_strength', vc.overallStrength)
  put(f, 'vol_confirms', vc.confirmsCurrentMove ? 1 : 0)
  if (vc.vwap.available) {
    put(f, 'vwap_distance_pct', vc.vwap.distancePercent)
    put(f, 'vwap_respecting', vc.vwap.respectingVWAP ? 1 : 0)
  }

  // ── Trend conditions, as indicators of what the engine believes ────────────
  for (const [k, v] of Object.entries(s.analysis.fullTrend.conditions)) {
    if (typeof v === 'boolean') f[`cond_${k}`] = v ? 1 : 0
  }

  // ── Engine outputs, recorded as features so Phase 3 can test whether the
  //    ENGINE'S OWN AGGREGATION adds anything beyond its raw inputs ───────────
  put(f, 'confidence_score', s.confidence.score)
  put(f, 'confidence_bullish', s.confidence.bullishConfidence)
  put(f, 'confidence_bearish', s.confidence.bearishConfidence)
  put(f, 'trust_score', s.confidence.trust.score)
  put(f, 'validation_critical', s.validation.criticalCount)
  put(f, 'validation_warning', s.validation.warningCount)
  put(f, 'evidence_count', s.analysis.evidence.length)
  put(f, 'rr', s.tradePlan.riskRewardRatio)
  put(f, 'maturity', s.tradePlan.maturityScore)
  put(f, 'actionable', s.tradePlan.actionable ? 1 : 0)

  // ── Trade-plan geometry, in ATR units ──────────────────────────────────────
  // Needed to express outcomes as R multiples: R = (return in ATR) / (risk in
  // ATR). Without the engine's OWN stop distance, an R multiple would have to
  // assume a risk unit, and every trading metric would then be measuring the
  // assumption rather than the engine. Absent when the plan has no stop, and
  // the metrics layer reports how many trades that excluded.
  const plan = s.tradePlan
  if (atr !== null && atr > 0) {
    const entryMid = plan.entryZone !== null ? (plan.entryZone.lower + plan.entryZone.upper) / 2 : null
    if (entryMid !== null && plan.invalidationLevel !== null) {
      put(f, 'stop_distance_atr', Math.abs(entryMid - plan.invalidationLevel) / atr)
    }
    if (entryMid !== null && plan.targetLevel !== null) {
      put(f, 'target_distance_atr', Math.abs(plan.targetLevel - entryMid) / atr)
    }
    // How far the decision-bar close sits from the planned entry. A large value
    // means the recorded outcome (measured from the close) is not the outcome
    // the plan would have had.
    if (entryMid !== null) put(f, 'entry_offset_atr', (price - entryMid) / atr)
  }

  return f
}

/**
 * Categorical engine outputs.
 *
 * ABSENCE IS NAMED, NOT STRINGIFIED. `String(null)` yields the string
 * `"null"`, which then appears in a report as a category called "null" — a
 * stringified absence masquerading as a value, indistinguishable at a glance
 * from a rendering failure. Every optional field is mapped to a token that
 * says what it means.
 */
export function extractCategorical(s: PipelineSnapshot): Record<string, string> {
  return {
    trend: s.analysis.fullTrend.trend,
    grade: s.confidence.grade,
    setup_quality: s.tradePlan.setupQuality,
    /** 'none' = the engine named no tradeable direction. */
    direction: s.tradePlan.direction ?? 'none',
    ms_trend: s.marketStructure.trend,
    ms_strength: s.marketStructure.strength,
    ema_alignment: s.analysis.emaContext.emaAlignment,
    /** 'unavailable' = VWAP could not be computed for this bar. */
    vwap_side: s.analysis.volumeContext.vwap.side ?? 'unavailable',
  }
}

/** Union of feature names across observations — the design-matrix columns. */
export function featureNames(rows: ReadonlyArray<{ features: Readonly<Record<string, number>> }>): string[] {
  const s = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r.features)) s.add(k)
  return [...s].sort()
}
