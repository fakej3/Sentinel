/**
 * Weight provenance registry — the epistemic status of every tunable value in
 * the confidence engine.
 *
 * WHY THIS EXISTS
 *
 * The engine has ~65 evidence weights and ~14 scalar constants. Reading
 * config.ts it is impossible to tell which of those are backed by historical
 * validation and which are engineering judgment, because they are formatted
 * identically. A number like `15` carries the same visual authority whether
 * it was fitted on 132 resolved trades or chosen to sit in a documented
 * "high impact" band. That is precision theatre, and it is exactly what makes
 * a scoring engine untrustworthy to a professional.
 *
 * This module attaches an explicit, compiler-enforced provenance to every
 * value. It deliberately does NOT change any weight: relabelling what we know
 * is a separate act from re-fitting, and mixing the two would destroy the
 * audit trail.
 *
 * THE HONEST HEADLINE: at the time of writing, ZERO confidence weights are
 * backtested. Every one is `heuristic` or `placeholder`. The engine elsewhere
 * demonstrates what backtested calibration looks like — trade-maturity.ts
 * cites per-component lift figures (OBV confirming = 1.175) and win-rate
 * evidence (score < 30 -> 0% WR across 132 resolved trades) from the Module
 * 38/39 historical validation. The confidence weights do not meet that
 * standard and are now labelled accordingly rather than implying they do.
 *
 * CALIBRATION SEAM
 *
 * The mechanism for data-driven weights already exists and needs no code
 * change to use: `ConfidenceConfig.factorWeights` is fully overridable and
 * exhaustiveness is compiler-enforced. What was missing is a machine-readable
 * inventory of what may be fitted and what must not be. `buildCalibrationInventory()`
 * emits exactly that, so a future harness can enumerate the free parameters,
 * fit them against resolved-trade outcomes, and emit a config override —
 * without editing engine source.
 */
import type { EvidenceFactor } from '../analysis/evidence-factors'
import {
  F_PRICE_ABOVE_EMA200, F_PRICE_ABOVE_EMA100, F_PRICE_ABOVE_EMA50, F_PRICE_ABOVE_EMA20,
  F_PRICE_BELOW_EMA200, F_PRICE_BELOW_EMA100, F_PRICE_BELOW_EMA50, F_PRICE_BELOW_EMA20,
  F_EMA_BULLISH_ALIGNMENT, F_EMA_BEARISH_ALIGNMENT, F_EMA_CONFLUENCE_ZONE,
  F_HIGHER_HIGH, F_HIGHER_LOW, F_LOWER_HIGH, F_LOWER_LOW,
  F_BULLISH_BOS, F_BEARISH_BOS, F_BULLISH_CHOCH, F_BEARISH_CHOCH,
  F_BULLISH_BREAKOUT, F_BEARISH_BREAKOUT, F_MARKET_CONSOLIDATION, F_FAILED_BREAKOUT, F_ACTIVE_PULLBACK,
  F_RSI_SUPPORTS_BULLISH, F_RSI_SUPPORTS_BEARISH,
  F_RSI_55_70, F_RSI_30_45,
  F_RSI_OVERBOUGHT, F_RSI_OVERSOLD,
  F_RSI_BULLISH_DIVERGENCE, F_RSI_BEARISH_DIVERGENCE,
  F_RSI_NEUTRAL, F_RSI_NEUTRAL_OVERLAP,
  F_MACD_BULLISH, F_MACD_BEARISH,
  F_ADX_ABOVE_25, F_ADX_TREND_WEAK,
  F_BOLLINGER_SQUEEZE, F_BOLLINGER_EXPANSION, F_PRICE_AT_BOLLINGER_LOWER, F_PRICE_AT_BOLLINGER_UPPER,
  F_STOCHRSI_OVERSOLD, F_STOCHRSI_OVERBOUGHT,
  F_PRICE_AT_SUPPORT, F_PRICE_AT_RESISTANCE, F_STRONG_SUPPORT_BELOW, F_STRONG_RESISTANCE_ABOVE,
  F_ACTIVE_SUPPORT_ZONE, F_STRONG_RESISTANCE_OVERHEAD,
  F_STRONG_VOLUME, F_STRONG_BULLISH_VOLUME, F_STRONG_BEARISH_VOLUME, F_BELOW_AVERAGE_VOLUME,
  F_ACCUMULATION, F_DISTRIBUTION,
  F_BULLISH_OBV, F_BEARISH_OBV, F_OBV_DIVERGING, F_OBV_DIVERGING_BULLISH,
  F_VOLUME_CLIMAX_SELLING, F_VOLUME_CLIMAX_BUYING, F_VOLUME_EXHAUSTION,
  F_PRICE_ABOVE_VWAP, F_PRICE_BELOW_VWAP, F_HIGH_RELATIVE_VOLUME, F_LOW_RELATIVE_VOLUME,
  F_WEAK_VOLUME_ON_BREAKOUT,
} from '../analysis/evidence-factors'
import type { ConfidenceConfig } from './types'

// ── Provenance vocabulary ─────────────────────────────────────────────────────

export type WeightProvenance =
  /** Fitted against resolved historical outcomes; the rationale cites the evidence. */
  | 'backtested'
  /** Follows mathematically from another calibrated quantity; not independently free. */
  | 'derived'
  /** Engineering judgment against a documented rubric. Defensible, NOT measured. */
  | 'heuristic'
  /** Pre-wired for a factor the engine does not yet emit. The value is untested. */
  | 'placeholder'

export interface ProvenanceEntry {
  provenance: WeightProvenance
  /** One line: why this value. Every entry must carry one — no silent numbers. */
  rationale: string
}

/** True when a value may be freely re-fitted by a calibration harness. */
export function isCalibratable(p: WeightProvenance): boolean {
  // 'derived' values are excluded: they are functions of other values and must
  // be recomputed, not independently fitted, or internal consistency breaks.
  return p === 'heuristic' || p === 'placeholder' || p === 'backtested'
}

// ── Rubric bands (quoted from config.ts, which is the source of these values) ──

const RUBRIC = 'Rubric band in config.ts (high |10-15|, medium |5-10|, low |2-5|); ordinal design judgment, not measured.'
const DEFERRED = 'Pre-wired for a factor the analysis engine does not yet emit; value never exercised in production.'

const h = (rationale = RUBRIC): ProvenanceEntry => ({ provenance: 'heuristic', rationale })
const p = (rationale = DEFERRED): ProvenanceEntry => ({ provenance: 'placeholder', rationale })

/**
 * Provenance for every evidence weight.
 *
 * `satisfies Record<EvidenceFactor, ProvenanceEntry>` is the architectural
 * guarantee: a new evidence factor cannot be added to the union without
 * declaring its provenance here, so undeclared magic numbers cannot re-enter
 * the engine silently.
 */
export const FACTOR_PROVENANCE = {
  // EMA position — magnitude ordered by timeframe significance (200 > 100 > 50 > 20).
  [F_PRICE_ABOVE_EMA200]: h('Long-horizon bias is the strongest single EMA signal; ranked top of the rubric band.'),
  [F_PRICE_ABOVE_EMA100]: h(), [F_PRICE_ABOVE_EMA50]: h(), [F_PRICE_ABOVE_EMA20]: h(),
  [F_PRICE_BELOW_EMA200]: h('Bearish mirror of F_PRICE_ABOVE_EMA200; symmetry is intentional.'),
  [F_PRICE_BELOW_EMA100]: h(), [F_PRICE_BELOW_EMA50]: h(), [F_PRICE_BELOW_EMA20]: h(),

  [F_EMA_BULLISH_ALIGNMENT]: h('Full stack is a compound condition, weighted above any single EMA.'),
  [F_EMA_BEARISH_ALIGNMENT]: h('Bearish mirror; symmetry intentional.'),
  [F_EMA_CONFLUENCE_ZONE]:   h('Direction-neutral context marker; deliberately low.'),

  // Market structure — HH/HL/LH/LL carry the engine's highest weights.
  [F_HIGHER_HIGH]: h('Swing structure is the primary trend definition; top of the rubric band.'),
  [F_HIGHER_LOW]:  h('Paired with F_HIGHER_HIGH; equal weight so neither dominates.'),
  [F_LOWER_HIGH]:  h('Bearish mirror of F_HIGHER_HIGH.'),
  [F_LOWER_LOW]:   h('Bearish mirror of F_HIGHER_LOW.'),
  [F_BULLISH_BOS]: h('Confirmed structural break; below swing labels because it is a single event.'),
  [F_BEARISH_BOS]: h('Bearish mirror.'),
  [F_BULLISH_CHOCH]: h('Reversal signal, not a confirmation — weighted below BOS by design.'),
  [F_BEARISH_CHOCH]: h('Bearish mirror.'),
  [F_BULLISH_BREAKOUT]: h(), [F_BEARISH_BREAKOUT]: h(),
  [F_MARKET_CONSOLIDATION]: h('Mild negative: range-bound conditions weaken any directional thesis.'),
  [F_FAILED_BREAKOUT]:      h('Negative: a failed break is evidence against the attempted direction.'),
  [F_ACTIVE_PULLBACK]:      h('Mild negative: pullbacks are normal but reduce immediate conviction.'),

  // Momentum
  [F_RSI_SUPPORTS_BULLISH]: h(), [F_RSI_SUPPORTS_BEARISH]: h(),
  [F_RSI_55_70]: p('Pre-wired band factor; evidence.ts currently emits F_RSI_SUPPORTS_BULLISH instead.'),
  [F_RSI_30_45]: p('Pre-wired band factor; evidence.ts currently emits F_RSI_SUPPORTS_BEARISH instead.'),
  [F_RSI_OVERBOUGHT]: h('Negative in bullish context — exhaustion risk outweighs momentum confirmation.'),
  [F_RSI_OVERSOLD]:   h('Positive as a mean-reversion signal; smaller magnitude than overbought by design.'),
  [F_RSI_BULLISH_DIVERGENCE]: p(), [F_RSI_BEARISH_DIVERGENCE]: p(),
  [F_RSI_NEUTRAL]: h('Near-zero: neutral RSI is information, but barely.'),
  [F_RSI_NEUTRAL_OVERLAP]: h('Near-zero, as above.'),
  [F_MACD_BULLISH]: h(), [F_MACD_BEARISH]: h(),
  [F_ADX_ABOVE_25]:   h('Direction-neutral trend-strength confirmation; enters the score at half weight.'),
  [F_ADX_TREND_WEAK]: h('Direction-neutral negative for weak trend strength.'),
  [F_BOLLINGER_SQUEEZE]: h(), [F_BOLLINGER_EXPANSION]: h(),
  [F_PRICE_AT_BOLLINGER_LOWER]: h(), [F_PRICE_AT_BOLLINGER_UPPER]: h(),
  [F_STOCHRSI_OVERSOLD]: h(), [F_STOCHRSI_OVERBOUGHT]: h(),

  // Support / resistance
  [F_PRICE_AT_SUPPORT]:    h('Positioning at a level is high-value context for entry timing.'),
  [F_PRICE_AT_RESISTANCE]: h('Bearish mirror.'),
  [F_STRONG_SUPPORT_BELOW]: h(), [F_STRONG_RESISTANCE_ABOVE]: h(),
  [F_ACTIVE_SUPPORT_ZONE]: h(), [F_STRONG_RESISTANCE_OVERHEAD]: h(),

  // Volume
  [F_STRONG_VOLUME]:         h('Participation is the strongest volume confirmation; top of the band.'),
  [F_STRONG_BULLISH_VOLUME]: h(), [F_STRONG_BEARISH_VOLUME]: h(),
  [F_BELOW_AVERAGE_VOLUME]:  h('Negative: moves on thin participation are less reliable.'),
  [F_ACCUMULATION]: h(), [F_DISTRIBUTION]: h(),
  [F_BULLISH_OBV]: h(), [F_BEARISH_OBV]: h(),
  [F_OBV_DIVERGING]: h(), [F_OBV_DIVERGING_BULLISH]: h(),
  [F_VOLUME_CLIMAX_SELLING]: h(), [F_VOLUME_CLIMAX_BUYING]: h(),
  [F_VOLUME_EXHAUSTION]: h(),
  [F_PRICE_ABOVE_VWAP]: h('NOTE: the underlying VWAP is window-anchored, not session-anchored — see the VWAP finding in the Phase 2 audit. Weight is low, which limits the blast radius.'),
  [F_PRICE_BELOW_VWAP]: h('Bearish mirror; same VWAP caveat applies.'),
  [F_HIGH_RELATIVE_VOLUME]: h(), [F_LOW_RELATIVE_VOLUME]: h(),
  [F_WEAK_VOLUME_ON_BREAKOUT]: p(),
} satisfies Record<EvidenceFactor, ProvenanceEntry>

/** Provenance for the scalar tuning constants (everything in config that is not a factor weight). */
export const SCALAR_PROVENANCE: Readonly<Record<string, ProvenanceEntry>> = {
  normalizationDivisor: { provenance: 'heuristic', rationale: 'Maps raw points to the 0-10 display scale. Saturating: many evidence combinations reach 10, compressing the top of the range.' },
  warningScorePenalty:  { provenance: 'heuristic', rationale: 'Per-warning deduction; linear in warning count with no cap.' },
  criticalScoreCap:     { provenance: 'heuristic', rationale: 'Ceiling when data integrity is compromised. Monotone (min).' },
  'gradeThresholds.veryStrong': { provenance: 'heuristic', rationale: 'Grade band boundary; presentation only, no effect on the numeric score.' },
  'gradeThresholds.strong':     { provenance: 'heuristic', rationale: 'Grade band boundary.' },
  'gradeThresholds.moderate':   { provenance: 'heuristic', rationale: 'Grade band boundary.' },
  'gradeThresholds.mixed':      { provenance: 'heuristic', rationale: 'Grade band boundary.' },
  contradictionPenaltyFactor: { provenance: 'heuristic', rationale: 'Opposing evidence enters at 30% strength so contradictions reduce without inverting the score.' },
  neutralStrengthFactor:      { provenance: 'heuristic', rationale: 'Direction-neutral evidence enters at half strength: it confirms conviction without picking a side.' },
  overconfidenceThreshold:    { provenance: 'heuristic', rationale: 'Observed-failure justification in config.ts (3/7 trust factors still produced 10.0). Motivated by a real failure, not fitted.' },
  trustPenaltyLow:    { provenance: 'heuristic', rationale: 'Ceiling depth for low trust. With the monotone repair, defines the flat band ceiling = threshold - penalty.' },
  trustPenaltyMedium: { provenance: 'heuristic', rationale: 'As above, shallower for medium trust.' },
  weakTrendScoreCap:  { provenance: 'heuristic', rationale: 'Ceiling for ambiguous-direction trends. Monotone (min).' },
  sparseDataPenalty:  { provenance: 'heuristic', rationale: 'Ceiling depth when EMA100 is unavailable (<~100 candles).' },
  volatilityShockThreshold: { provenance: 'heuristic', rationale: '24h move classified as a shock regime. A step discontinuity in an INPUT (11.9% vs 12.1%); acceptable as a regime classifier, but a ramp would be smoother.' },
  volatilityShockPenalty:   { provenance: 'heuristic', rationale: 'Deduction after a shock session; applied unconditionally, so monotone in score.' },
  nearZeroAtrThreshold: { provenance: 'heuristic', rationale: 'Below 0.2% ATR the asset is treated as a stablecoin/peg. Domain rationale, not fitted.' },
  nearZeroAtrCap:       { provenance: 'heuristic', rationale: 'Ceiling for non-volatile assets, where no technical signal is meaningful. Monotone (min).' },
}

// ── Calibration inventory ─────────────────────────────────────────────────────

export interface CalibrationParameter {
  /** Dotted path within ConfidenceConfig, e.g. 'factorWeights.higher_high'. */
  path: string
  currentValue: number
  provenance: WeightProvenance
  rationale: string
  calibratable: boolean
}

/**
 * Emit the full machine-readable inventory of tunable parameters.
 *
 * This is the interface a future calibration harness consumes: enumerate the
 * free parameters, fit them against resolved-trade outcomes, and emit a
 * `Partial<ConfidenceConfig>` override. No engine source changes, because
 * every value is already injectable through the existing config merge.
 *
 * WHY CALIBRATION IS NOT YET AUTOMATED (stated plainly rather than implied):
 * fitting requires a labelled outcome per analysis — did the setup resolve
 * profitably within a defined horizon. The repository has the machinery to
 * PRODUCE such labels (modules/replay drives the pipeline candle-by-candle
 * with no look-ahead, and modules/benchmark scores runs), but no persisted
 * corpus of resolved outcomes is committed. Until that corpus exists, any
 * "fitted" weight would be fitted to a handful of hand-built fixtures, which
 * is worse than an honest heuristic because it would carry false authority.
 */
export function buildCalibrationInventory(cfg: ConfidenceConfig): CalibrationParameter[] {
  const out: CalibrationParameter[] = []

  for (const [factor, entry] of Object.entries(FACTOR_PROVENANCE) as Array<[EvidenceFactor, ProvenanceEntry]>) {
    out.push({
      path: `factorWeights.${factor}`,
      currentValue: cfg.factorWeights[factor],
      provenance: entry.provenance,
      rationale: entry.rationale,
      calibratable: isCalibratable(entry.provenance),
    })
  }

  const scalarValue = (path: string): number | undefined => {
    const [head, tail] = path.split('.')
    const root = (cfg as unknown as Record<string, unknown>)[head]
    if (tail === undefined) return typeof root === 'number' ? root : undefined
    const nested = (root as Record<string, unknown> | undefined)?.[tail]
    return typeof nested === 'number' ? nested : undefined
  }

  for (const [path, entry] of Object.entries(SCALAR_PROVENANCE)) {
    const value = scalarValue(path)
    if (value === undefined) continue
    out.push({
      path,
      currentValue: value,
      provenance: entry.provenance,
      rationale: entry.rationale,
      calibratable: isCalibratable(entry.provenance),
    })
  }

  return out
}

/** Counts by provenance — a one-glance honesty summary of the engine's calibration state. */
export function summariseProvenance(cfg: ConfidenceConfig): Record<WeightProvenance, number> {
  const summary: Record<WeightProvenance, number> = {
    backtested: 0, derived: 0, heuristic: 0, placeholder: 0,
  }
  for (const param of buildCalibrationInventory(cfg)) summary[param.provenance]++
  return summary
}
