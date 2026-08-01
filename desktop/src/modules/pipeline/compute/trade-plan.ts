import type { MarketAnalysisResult } from '../../analysis/types'
import type { SupportResistanceResult } from '../../support-resistance/types'
import type { ConfidenceResult } from '../../confidence/types'
import type { ValidationResult } from '../../validation/types'
import type { MarketStructureResult } from '../../market-structure/types'
import type { TradePlan, TradeSetupQuality, MultiTimeframeAgreement } from '../types'
import { computeTradeMaturity } from './trade-maturity'
import type { TradeMaturityResult } from './trade-maturity'

/**
 * Entry zones further than this many ATRs from current price are treated as
 * 'avoid' (entry_too_distant). The setup may be structurally valid but requires
 * too much uninterrupted movement before entry becomes realistic.
 *
 * Rationale: price commonly retraces 1–3 ATRs before finding an entry zone.
 * 5 ATRs is the outer bound of a realistic short-term pullback; beyond it the
 * zone is a level to watch, not an entry to plan today. Using ATR (not %) means
 * the gate scales automatically with timeframe and volatility regime.
 */
const MAX_ENTRY_DISTANCE_ATR = 5

const CLEAN_VALIDATION: ValidationResult = {
  passed: true, clean: true, issues: [],
  criticalCount: 0, warningCount: 0, infoCount: 0,
  summary: '',
}

/**
 * Derives an actionable trade plan from the S/R context, trend, and confidence.
 *
 * Entry zone: for bullish trends, near nearest support; for bearish, near nearest resistance.
 * Invalidation: the level at which the directional thesis is broken.
 * Target: the nearest opposing S/R level.
 * RR: computed from the entry zone midpoint (not current price) so it reflects the actual
 *     risk of entering at the zone rather than wherever price is now.
 */
export function computeTradePlan(
  analysis: MarketAnalysisResult,
  supportResistance: SupportResistanceResult,
  confidence: ConfidenceResult,
  validation: ValidationResult = CLEAN_VALIDATION,
  mtfAgreement?: MultiTimeframeAgreement,
  marketStructure?: MarketStructureResult,
): TradePlan {
  const { fullTrend, srContext } = analysis
  const trend = fullTrend.trend
  const isBullish = trend.includes('bullish')
  const isBearish = trend.includes('bearish')

  const nearestSupport    = supportResistance.nearestSupport
  const nearestResistance = supportResistance.nearestResistance
  const currentZone       = supportResistance.currentZone

  // ── Entry/stop zone selection: exclude weakening zones ────────────────────
  // A 'weakening' zone has already failed to hold at least once
  // (failedReactions >= 1). Anchoring an ENTRY or a STOP to a level that has
  // already demonstrated failure is the single most common way to hand a
  // trader a bad reference: the zone most likely to fail again is the one
  // that just failed. Weakening zones are excluded from entry/stop selection;
  // the nearest reliable zone (activeSupport/activeResistance are sorted
  // nearest-first) is used instead. If NO reliable zone exists on the trade
  // side, we deliberately fall through to the ATR-based levels below, which
  // are already capped at 'average' quality — honest volatility-based levels
  // beat structure-based levels anchored to demonstrated failure.
  //
  // TARGETS intentionally still use the plain nearest opposing zone: taking
  // profit BEFORE a weakening level is conservative (price reaching a level
  // likely to break does not hurt a target placed in front of it).
  const isReliable = (z: { state: string }) => z.state !== 'weakening'

  const reliableNearestSupport =
    (nearestSupport && isReliable(nearestSupport)) ? nearestSupport
      : supportResistance.activeSupport.find(isReliable) ?? null
  const reliableNearestResistance =
    (nearestResistance && isReliable(nearestResistance)) ? nearestResistance
      : supportResistance.activeResistance.find(isReliable) ?? null

  // When price is AT a zone, nearestSupport/nearestResistance is null (filtered out).
  // Fall back to currentZone so we can still establish trade levels — but only
  // when the current zone itself is reliable.
  const effectiveSupport    = reliableNearestSupport
    ?? (currentZone?.type === 'support'    && isReliable(currentZone) ? currentZone : null)
  const effectiveResistance = reliableNearestResistance
    ?? (currentZone?.type === 'resistance' && isReliable(currentZone) ? currentZone : null)

  // ── Entry zone ────────────────────────────────────────────────────────────
  let entryZone: TradePlan['entryZone'] = null
  if (isBullish && effectiveSupport) {
    entryZone = { lower: effectiveSupport.lower, upper: effectiveSupport.upper }
  } else if (isBearish && effectiveResistance) {
    entryZone = { lower: effectiveResistance.lower, upper: effectiveResistance.upper }
  }

  // ── Invalidation level ────────────────────────────────────────────────────
  // Bullish: a close below support breaks the thesis.
  // Bearish: a close above resistance breaks the thesis.
  // Stop buffer scales with ATR so high-volatility assets get a wider cushion
  // (fixed 0.5% is too tight for crypto with 2–5% daily ATR).
  const atrPct = analysis.price.atrPercent
  const stopBufferFraction = atrPct !== null
    ? Math.max(0.005, atrPct / 200)   // max(0.5%, half ATR as a fraction)
    : 0.005
  let invalidationLevel: number | null = null
  if (isBullish && effectiveSupport) {
    invalidationLevel = effectiveSupport.lower * (1 - stopBufferFraction)
  } else if (isBearish && effectiveResistance) {
    invalidationLevel = effectiveResistance.upper * (1 + stopBufferFraction)
  }

  // ── Structural (BOS-anchored) invalidation ────────────────────────────────
  // A confirmed same-direction BOS below a long entry (above a short entry)
  // is the TRUE invalidation structure: a close back through the broken
  // level kills the directional thesis by definition. When the zone-derived
  // stop sits on the wrong side of that structure — above it (long) / below
  // it (short) — the stop lies in the sweep zone: price can wick through the
  // synthetic zone boundary, take the stop, and reverse without structure
  // ever breaking. In that case the stop moves beyond the BOS level (same
  // relative buffer).
  //
  // Bound: the adjustment applies only when it moves the stop by at most
  // 1 ATR. Within one ATR, the zone stop is inside a single bar's typical
  // range of the structure — statistically indistinguishable from sitting AT
  // the level, but on the sweepable side, so anchoring beyond structure is
  // strictly better. Beyond one ATR the BOS is a materially different
  // (usually stale) structure; silently multiplying the trade's risk to
  // reach it would be wrong — the conservative zone stop stands and the
  // setup's RR is judged on it. Requires ATR; skipped when unavailable
  // (no volatility unit to bound the adjustment).
  const lastBos = marketStructure?.bos.last ?? null
  if (invalidationLevel !== null && entryZone !== null && lastBos !== null && atrPct !== null) {
    const atrPrice = analysis.price.current * atrPct / 100
    if (isBullish && lastBos.direction === 'bullish' && lastBos.level < entryZone.lower) {
      const structuralStop = lastBos.level * (1 - stopBufferFraction)
      const adjustment = invalidationLevel - structuralStop
      if (adjustment > 0 && adjustment <= atrPrice) {
        invalidationLevel = structuralStop
      }
    } else if (isBearish && lastBos.direction === 'bearish' && lastBos.level > entryZone.upper) {
      const structuralStop = lastBos.level * (1 + stopBufferFraction)
      const adjustment = structuralStop - invalidationLevel
      if (adjustment > 0 && adjustment <= atrPrice) {
        invalidationLevel = structuralStop
      }
    }
  }

  // ── Target level ──────────────────────────────────────────────────────────
  // Use zone boundary (not center) to avoid inflating RR with an optimistic midpoint target.
  let targetLevel: number | null = null
  if (isBullish && nearestResistance) {
    targetLevel = nearestResistance.lower
  } else if (isBearish && nearestSupport) {
    targetLevel = nearestSupport.upper
  }

  // ── ATR-based fallback when any trade level is missing ───────────────────
  // When a clear directional trend exists but S/R structure is incomplete
  // (e.g. entry zone found from support but no resistance target above price),
  // fill every absent level using ATR-derived values (2 ATR stop, 4 ATR target).
  // Target is measured from the entry zone midpoint so RR reflects actual risk.
  // These setups are capped at 'average' quality — levels are volatility-derived,
  // not anchored to key market structure, so exact price reactions are less reliable.
  let atrBased = false
  const needsFallback = entryZone === null || invalidationLevel === null || targetLevel === null
  if (needsFallback && (isBullish || isBearish) && analysis.price.atrPercent !== null) {
    const currentPrice = analysis.price.current
    const atr = currentPrice * analysis.price.atrPercent / 100
    if (entryZone === null) {
      entryZone = { lower: currentPrice * 0.999, upper: currentPrice * 1.001 }
    }
    if (invalidationLevel === null) {
      invalidationLevel = isBullish ? currentPrice - 2 * atr : currentPrice + 2 * atr
    }
    if (targetLevel === null) {
      // Anchor to entry zone midpoint so RR is measured from where we actually enter.
      const entryRef = (entryZone.lower + entryZone.upper) / 2
      targetLevel = isBullish ? entryRef + 4 * atr : entryRef - 4 * atr
    }
    atrBased = true
  }

  // ── Geometry validation ───────────────────────────────────────────────────
  // Long: stop must be below zone, target must be above zone.
  // Short: stop must be above zone, target must be below zone.
  let geometryValid = false
  if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
    if (isBullish) {
      geometryValid = invalidationLevel < entryZone.lower && targetLevel > entryZone.upper
    } else if (isBearish) {
      geometryValid = invalidationLevel > entryZone.upper && targetLevel < entryZone.lower
    }
  }

  // ── Risk / reward ratio (from entry zone midpoint) ────────────────────────
  // Using the zone midpoint as the reference rather than current price because
  // the plan describes where to enter, not where price is now.
  let riskRewardRatio: number | null = null
  if (entryZone !== null && invalidationLevel !== null && targetLevel !== null && geometryValid) {
    const entryMid = (entryZone.lower + entryZone.upper) / 2
    const risk     = Math.abs(entryMid - invalidationLevel)
    const reward   = Math.abs(targetLevel - entryMid)
    if (risk > 0) riskRewardRatio = Math.round((reward / risk) * 100) / 100
  }

  // ── Trade Maturity Score (Module 41) ─────────────────────────────────────
  // Compute before quality classification so maturity can inform the quality tier.
  // Requires marketStructure; falls back to a zero-scored result when unavailable
  // (maintains backward compatibility with callers that don't pass it yet).
  const maturity = marketStructure
    ? computeTradeMaturity(analysis, marketStructure, confidence)
    : { score: 50, label: 'developing' as const, components: { momentum: 10, volume: 10, trend: 10, structure: 10, confidence: 10 }, primaryConcern: null }

  // ── Setup quality ─────────────────────────────────────────────────────────
  const { setupQuality, setupQualityReason, cause } = classifySetupQuality(
    entryZone, invalidationLevel, targetLevel,
    geometryValid, riskRewardRatio,
    confidence, validation, mtfAgreement, trend, maturity.score, atrBased,
    analysis.price.atrPercent,
    analysis.price.current,
  )

  // excellent / good / average are actionable; poor / avoid / no_setup are not
  const actionable = setupQuality === 'excellent' || setupQuality === 'good' || setupQuality === 'average'

  // ── Direction + target ladder ─────────────────────────────────────────────
  // The single directional authority for every renderer. The ladder extends
  // targetLevel with up to two further S/R levels beyond it in trade direction
  // (zone boundary facing the trade, same convention as the primary target).
  const direction: TradePlan['direction'] = isBullish ? 'long' : isBearish ? 'short' : null
  const targets: number[] = []
  if (targetLevel !== null && direction !== null) {
    targets.push(targetLevel)
    const ladderZones = direction === 'long'
      ? supportResistance.activeResistance
      : supportResistance.activeSupport
    // Each rung must be further along the trade than the PREVIOUS rung, not
    // merely further than the first. `ladderZones` is sorted by zone CENTRE
    // while the ladder pushes zone BOUNDARIES, and those two orderings differ
    // whenever zone widths differ (merged zones are wider by construction).
    // Comparing against targetLevel therefore admitted a wide high-centre zone
    // whose near boundary sat below an already-pushed rung, producing a ladder
    // that went 105 → 130 → 120 for a long. A target sequence that reverses
    // direction is not a plan a trader can act on.
    for (const zone of ladderZones) {
      if (targets.length >= 3) break
      const price = direction === 'long' ? zone.lower : zone.upper
      const last = targets[targets.length - 1]
      if (direction === 'long' ? price > last : price < last) {
        targets.push(price)
      }
    }
  }

  // ── Patience message ──────────────────────────────────────────────────────
  const patienceMessage = buildPatienceMessage(
    setupQuality, cause, setupQualityReason, trend, confidence, srContext, riskRewardRatio,
    entryZone, invalidationLevel, targetLevel, maturity, atrBased,
  )

  return {
    direction,
    entryZone,
    invalidationLevel,
    targetLevel,
    targets,
    riskRewardRatio,
    setupQuality,
    setupQualityReason,
    actionable,
    patienceMessage,
    maturityScore:          maturity.score,
    maturityLabel:          maturity.label,
    maturityComponents:     maturity.components,
    maturityPrimaryConcern: maturity.primaryConcern,
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Why `classifySetupQuality` returned the tier it did.
 *
 * This exists because `buildPatienceMessage` used to RE-DERIVE the reason from
 * the same raw inputs, testing a partial copy of the chain below: it checked
 * criticalCount, confidence < 4 and maturity < 30, but not trust < 50 and not
 * RR > 6. Any setup downgraded by one of the two it did not check fell through
 * to a default message — "Data quality is insufficient; wait for more price
 * history" — describing a condition that was not the reason and, for RR > 6,
 * was not true at all. The near-zero-ATR path likewise reported "ATR is
 * unavailable" when ATR was present and merely small.
 *
 * Duplicated decision logic was the defect; deleting the duplicate is the fix.
 * The cause travels with the tier so the explanation cannot diverge from the
 * decision, and the switch over it is exhaustive so a new tier cannot be added
 * without giving it a message.
 */
type SetupQualityCause =
  | 'near_zero_atr'
  | 'no_levels'
  | 'invalid_geometry'
  | 'rr_below_min'
  | 'rr_above_max'
  | 'critical_validation'
  | 'low_confidence'
  | 'low_trust'
  | 'immature'
  | 'atr_based'
  | 'mtf_conflict'
  | 'entry_too_distant'
  /** Passed every gate — the tier is driven by RR/confidence, not by a fault. */
  | 'qualified'

function classifySetupQuality(
  entryZone: TradePlan['entryZone'],
  invalidationLevel: number | null,
  targetLevel: number | null,
  geometryValid: boolean,
  riskRewardRatio: number | null,
  confidence: ConfidenceResult,
  validation: ValidationResult,
  mtfAgreement?: MultiTimeframeAgreement,
  trend?: string,
  maturityScore?: number,
  atrBased?: boolean,
  atrPercent?: number | null,
  currentPrice?: number,
): { setupQuality: TradeSetupQuality; setupQualityReason: string; cause: SetupQualityCause } {
  // Weak trend (weak bullish / weak bearish / ranging) reduces setup reliability.
  // Evidence: 8/10 synthetic validation losses had weak trend labels despite high
  // confidence scores — weak-trend excellent scored 83.3% WR vs 96.6% for strong/moderate.
  const isWeakTrend = trend !== undefined && (trend.includes('weak') || trend === 'ranging')

  // 0. Near-zero ATR — stablecoin, peg, or illiquid asset with no tradeable volatility.
  // Any S/R levels found are meaningless noise when price barely moves.
  if (atrPercent !== null && atrPercent !== undefined && atrPercent < 0.2) {
    return {
      setupQuality: 'no_setup',
      setupQualityReason: `ATR of ${atrPercent.toFixed(3)}% is below the 0.2% minimum — market has insufficient volatility (stablecoin or peg); no reliable trade setup`,
      cause: 'near_zero_atr',
    }
  }

  // 1. Insufficient S/R data — no trade levels available
  if (entryZone === null || invalidationLevel === null || targetLevel === null) {
    return {
      setupQuality: 'no_setup',
      setupQualityReason: 'Insufficient support/resistance data to establish trade levels',
      cause: 'no_levels',
    }
  }

  // 2. Geometry invalid — stop/entry/target are not in the correct order
  if (!geometryValid) {
    return {
      setupQuality: 'avoid',
      setupQualityReason: 'Trade geometry is invalid — stop, entry, and target are not in the correct order',
      cause: 'invalid_geometry',
    }
  }

  // 2b. Entry zone too distant from current price.
  // A geometrically valid setup can still be non-actionable when price must
  // travel more than MAX_ENTRY_DISTANCE_ATR before reaching the entry zone.
  // For SHORT the entry is above price; distance = max(0, entry.lower - price).
  // For LONG  the entry is below price; distance = max(0, price - entry.upper).
  // When price is inside the zone both expressions are ≤ 0, so distance = 0 and
  // the gate never fires. Skip the check when ATR is unavailable.
  if (
    currentPrice !== undefined &&
    atrPercent !== null && atrPercent !== undefined &&
    atrPercent >= 0.2
  ) {
    const atr = currentPrice * atrPercent / 100
    if (atr > 0) {
      const isBull = trend?.includes('bullish') ?? false
      const distance = isBull
        ? Math.max(0, currentPrice - entryZone.upper)
        : Math.max(0, entryZone.lower - currentPrice)
      const distanceATR = distance / atr
      if (distanceATR > MAX_ENTRY_DISTANCE_ATR) {
        const distStr = distanceATR.toFixed(1)
        const zoneStr = `${fmtPrice(entryZone.lower)}–${fmtPrice(entryZone.upper)}`
        const zoneType = isBull ? 'support' : 'resistance'
        return {
          setupQuality: 'avoid',
          setupQualityReason: `Entry zone is ${distStr} ATR away — too far to reach the ${zoneType} zone (${zoneStr}); wait for price to approach`,
          cause: 'entry_too_distant',
        }
      }
    }
  }

  // 3. RR too poor to justify the trade
  if (riskRewardRatio === null || riskRewardRatio < 1.5) {
    const rrStr = riskRewardRatio !== null ? riskRewardRatio.toFixed(2) : 'N/A'
    return {
      setupQuality: 'avoid',
      setupQualityReason: `Risk/reward of ${rrStr} is below the minimum threshold of 1.5`,
      cause: 'rr_below_min',
    }
  }

  // 3b. RR unrealistically high — target is likely beyond meaningful structure.
  // A 6:1 target requires moving 6× the risk distance; in most market regimes this
  // implies the target is at a level price may never reach before invalidating.
  // Cap rather than reject so the plan is still useful — but only at 'poor'.
  if (riskRewardRatio > 6.0) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `RR of ${riskRewardRatio.toFixed(2)} exceeds the 6.0 maximum — target level is likely too distant; consider a closer target or skip`,
      cause: 'rr_above_max',
    }
  }

  // 4. Data quality issues undermine the analysis
  if (validation.criticalCount > 0) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `${validation.criticalCount} critical data quality issue(s) undermine the analysis`,
      cause: 'critical_validation',
    }
  }
  if (confidence.score < 4.0) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Confidence score of ${confidence.score.toFixed(1)} is too low for a reliable setup`,
      cause: 'low_confidence',
    }
  }
  if (confidence.trust.score < 50) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Data trust of ${confidence.trust.score}% is below the 50% reliability threshold`,
      cause: 'low_trust',
    }
  }

  // 4b. Maturity gate (Module 41) — block Immature setups regardless of other signals.
  // Evidence: score < 30 had 0% WR across 132 resolved M38/M39 historical trades.
  // Pure improvement: 1 loss blocked, 0 wins removed, selectivity = 100%.
  if (maturityScore !== undefined && maturityScore < 30) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Trade maturity ${maturityScore}/100 (Immature) — market conditions are not ready; wait for momentum, volume, and structure to align`,
      cause: 'immature',
    }
  }

  // ATR-based setups are capped at 'average' — levels are volatility-derived, not
  // anchored to key market structure, so confidence in exact price reactions is lower.
  if (atrBased) {
    // The guard that used to sit here — `validation.criticalCount > 0 ||
    // confidence.score < 4.0` — was unreachable: both conditions return 'poor'
    // in step 4 above, before control can arrive here. Removed rather than
    // left as reassuring-looking dead code.
    return {
      setupQuality: 'average',
      setupQualityReason: `ATR-based levels (no key S/R structure) — RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}; use reduced size`,
      cause: 'atr_based',
    }
  }

  const mtfConflict = mtfAgreement?.agreement === 'strong_conflict'
  const mtfNote = mtfConflict
    ? ` — MTF conflict: ${mtfAgreement!.conflictingCount} opposing timeframe(s) reduce quality`
    : ''
  const weakTrendNote = isWeakTrend ? ' — weak trend reduces setup reliability' : ''

  // 5. Excellent: RR ≥ 2.0, confidence ≥ 7.5, trust ≥ 70 — all conditions met
  if (riskRewardRatio >= 2.0 && confidence.score >= 7.5 && confidence.trust.score >= 70) {
    if (isWeakTrend) {
      return {
        setupQuality: 'good',
        setupQualityReason: `Setup downgraded: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${weakTrendNote}${mtfNote}`,
      cause: 'qualified',
      }
    }
    if (mtfConflict) {
      return {
        setupQuality: 'good',
        setupQualityReason: `Excellent setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
      cause: 'qualified',
      }
    }
    return {
      setupQuality: 'excellent',
      setupQualityReason: `Excellent setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}, trust ${confidence.trust.score}%`,
      cause: 'qualified',
    }
  }

  // 6. Good: RR ≥ 1.5 and confidence ≥ 5.0
  if (confidence.score >= 5.0) {
    if (isWeakTrend) {
      return {
        setupQuality: 'average',
        setupQualityReason: `Setup downgraded: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${weakTrendNote}${mtfNote}`,
      cause: 'qualified',
      }
    }
    if (mtfConflict) {
      return {
        setupQuality: 'average',
        setupQualityReason: `Good setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
      cause: 'qualified',
      }
    }
    return {
      setupQuality: 'good',
      setupQualityReason: `Good setup: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}`,
      cause: 'qualified',
    }
  }

  // 7. Average: RR meets threshold but confidence is below 5.0 — marginal
  if (mtfConflict) {
    return {
      setupQuality: 'poor',
      setupQualityReason: `Marginal setup degraded by multi-timeframe conflict: RR ${riskRewardRatio.toFixed(2)}, confidence ${confidence.score.toFixed(1)}${mtfNote}`,
      cause: 'mtf_conflict',
    }
  }
  return {
    setupQuality: 'average',
    setupQualityReason: `Marginal setup: RR ${riskRewardRatio.toFixed(2)} meets threshold but confidence ${confidence.score.toFixed(1)} is below optimal`,
      cause: 'qualified',
  }
}

function fmtPrice(price: number): string {
  if (price >= 10_000) return price.toFixed(0)
  if (price >= 100)    return price.toFixed(2)
  if (price >= 1)      return price.toFixed(4)
  return price.toFixed(6)
}

function buildPatienceMessage(
  setupQuality: TradeSetupQuality,
  cause: SetupQualityCause,
  setupQualityReason: string,
  trend: string,
  confidence: ConfidenceResult,
  srContext: MarketAnalysisResult['srContext'],
  riskRewardRatio: number | null,
  entryZone: TradePlan['entryZone'],
  invalidationLevel: number | null,
  targetLevel: number | null,
  maturity: TradeMaturityResult,
  atrBased?: boolean,
): string {
  // Every non-actionable tier is explained from the CAUSE the classifier
  // returned, never from a re-test of the classifier's inputs. Re-testing is
  // what allowed the explanation to describe a different condition from the
  // decision. `validation` is no longer a parameter here for exactly that
  // reason: this function must not be able to form its own opinion.
  switch (setupQuality) {
    case 'no_setup':
      if (cause === 'near_zero_atr') {
        return 'Market volatility is far below the tradeable minimum — this looks like a stablecoin or pegged asset; no technical level is meaningful at this ATR'
      }
      // 'no_levels' has two distinct causes and the message must not assert the
      // wrong one: a non-directional trend suppresses the ATR fallback entirely
      // (ATR is often present and healthy), whereas a directional trend reaching
      // here genuinely had neither structure nor a usable ATR.
      return trend === 'ranging' || (!trend.includes('bullish') && !trend.includes('bearish'))
        ? 'No directional bias — trend is ranging, so there is no side to plan a trade on; wait for a break of structure'
        : 'No trade setup available — no nearby S/R structure and no usable ATR fallback; wait for structure to form or a pullback to a key level'

    case 'avoid':
      if (cause === 'entry_too_distant') {
        return `${setupQualityReason} — no trade until price approaches the zone`
      }
      if (cause === 'rr_below_min' && riskRewardRatio !== null) {
        return confidence.score >= 6.0
          ? `Confidence is high but risk/reward is ${riskRewardRatio.toFixed(2)}:1 (minimum 1.5:1) — wait for a better entry zone`
          : `Risk/reward is ${riskRewardRatio.toFixed(2)}:1 — below minimum 1.5:1; wait for price to approach a higher-probability zone`
      }
      return 'Trade geometry is invalid — stop, entry, and target are not in the correct order; wait for structure to clarify'

    case 'poor':
      switch (cause) {
        case 'critical_validation':
          return 'Critical data quality issues are present — avoid trading until the analysis clears'
        case 'low_confidence':
          return `Signal confidence is ${confidence.score.toFixed(1)}/10 — too low for a reliable setup; wait for a clearer directional move`
        case 'low_trust':
          return `Data trust is ${confidence.trust.score}% — below the 50% reliability threshold; the inputs behind this setup are not dependable enough to act on`
        case 'immature': {
          const concern = maturity.primaryConcern ?? 'momentum, volume, and structure not yet aligned'
          return `Setup maturity ${maturity.score}/100 (Immature) — ${concern}; wait for conditions to mature before entering`
        }
        case 'rr_above_max':
          return riskRewardRatio !== null
            ? `Risk/reward of ${riskRewardRatio.toFixed(2)}:1 is implausibly high — the target sits beyond meaningful structure and price is unlikely to reach it before invalidating; take a closer target or skip`
            : 'The target sits beyond meaningful structure — take a closer target or skip'
        case 'mtf_conflict':
          return 'Higher timeframes disagree with this setup — wait for the conflicting timeframe to align before entering'
        default:
          // Any cause/tier pairing the classifier does not currently produce.
          // Echoing its own reason is the only fallback that cannot contradict
          // the decision; inventing prose here is what caused the defects above.
          return `${setupQualityReason} — no trade`
      }

    case 'excellent': {
      const earlyNote = maturity.score < 45 && maturity.primaryConcern
        ? `; caution: ${maturity.primaryConcern}` : ''
      if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
        const mid = fmtPrice((entryZone.lower + entryZone.upper) / 2)
        const stop = fmtPrice(invalidationLevel)
        const target = fmtPrice(targetLevel)
        const rrStr = riskRewardRatio !== null ? `, RR ${riskRewardRatio.toFixed(2)}:1` : ''
        return `High-quality setup — enter near ${mid}, stop at ${stop}, target ${target}${rrStr}${earlyNote}`
      }
      if (earlyNote) {
        return `High-quality setup${earlyNote} — enter at the zone boundary with a defined stop and target`
      }
      return trend.includes('strong')
        ? 'High-quality setup in a strong trend — enter at the zone boundary with a defined stop and target'
        : 'High-quality setup — enter on approach to the entry zone with disciplined risk management'
    }

    case 'good': {
      const isWeak = trend.includes('weak') || trend === 'ranging'
      const earlyNote = maturity.score < 45 && maturity.primaryConcern
        ? `; note: ${maturity.primaryConcern}` : ''
      if (entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
        const mid = fmtPrice((entryZone.lower + entryZone.upper) / 2)
        const stop = fmtPrice(invalidationLevel)
        const target = fmtPrice(targetLevel)
        const rrStr = riskRewardRatio !== null ? `, RR ${riskRewardRatio.toFixed(2)}:1` : ''
        if (isWeak) {
          return `Good setup in a weak trend — wait for a confirmation candle before entering; enter near ${mid}, stop at ${stop}, target ${target}${rrStr}${earlyNote}`
        }
        if (srContext.approachingSupport || srContext.approachingResistance) {
          return `Good setup near a key level — wait for a reaction, then enter near ${mid} with stop at ${stop}, target ${target}${rrStr}${earlyNote}`
        }
        return `Good setup — enter near ${mid}, stop at ${stop}, target ${target}${rrStr}${earlyNote}`
      }
      if (isWeak) {
        return 'Good setup but trend strength is weak — wait for trend confirmation before entering'
      }
      if (srContext.approachingSupport || srContext.approachingResistance) {
        return 'Good setup approaching a key level — wait for a reaction here before entering'
      }
      return trend.includes('moderate')
        ? 'Good setup in a moderate trend — wait for price to reach the entry zone before committing'
        : 'Good setup — enter at the entry zone with a clearly defined stop loss'
    }

    case 'average': {
      const isWeak = trend.includes('weak') || trend === 'ranging'
      const earlyNote = maturity.score < 45 && maturity.primaryConcern
        ? `; ${maturity.primaryConcern}` : ''
      if (atrBased && entryZone !== null && invalidationLevel !== null && targetLevel !== null) {
        const mid = fmtPrice((entryZone.lower + entryZone.upper) / 2)
        const stop = fmtPrice(invalidationLevel)
        const target = fmtPrice(targetLevel)
        const rrStr = riskRewardRatio !== null ? `, RR ${riskRewardRatio.toFixed(2)}:1` : ''
        return `No key S/R structure nearby — ATR-based levels: enter near ${mid}, stop ${stop}, target ${target}${rrStr}; reduce position size${earlyNote}`
      }
      if (isWeak) {
        return `Weak trend — if entering, wait for a strong confirmation candle, use reduced position size, and strict stop placement${earlyNote}`
      }
      return `Marginal setup — if entering, use reduced size and strict risk management; wait for confirmation if possible${earlyNote}`
    }
  }
}
