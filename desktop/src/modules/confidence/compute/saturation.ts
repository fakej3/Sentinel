/**
 * Score saturation: mapping an unbounded evidence sum onto the 0–10 scale.
 *
 * ── THE MEASURED PROBLEM ─────────────────────────────────────────────────────
 *
 * `normalize` was `min(10, max(0, rawPoints / 10))` — a hard linear clamp.
 * The engine's 34 positive factor weights sum to 260, so the reachable
 * pre-clamp score is 0–26 on a 0–10 scale, and saturation needs only the 8
 * largest positive factors to fire (24% of them). Those 8 are precisely the
 * ones that co-fire in a trending market: the EMA stack, price above each EMA,
 * and the HH/HL structure count are all measuring "there is an uptrend".
 *
 * Measured over 252 synthetic markets spanning seven drifts × three volatility
 * regimes, driven through the real indicator → structure → S/R → volume →
 * analysis chain:
 *
 *     pre-clamp score:  p25 5.71   median 8.26   p75 10.75   p95 12.90   max 15.05
 *     SATURATED (>=10): 82 / 252 = 32.5%
 *
 * One third of all setups collapsed onto the single value 10.0. A setup with
 * 10.1 points of directed evidence and one with 15.0 — a 50% difference in
 * evidence strength — were reported as identical, and both graded veryStrong.
 * That is the single largest information loss in the confidence engine.
 *
 * ── THE OPTIONS, AND WHY THIS ONE ────────────────────────────────────────────
 *
 * LINEAR CLAMP (status quo). Monotone only weakly — flat above the knee — so
 *   it is not injective and destroys all ordering in the top third. Perfect
 *   below the knee. Rejected for the measured reason above.
 *
 * LOGISTIC, 10/(1+e^(-k(x-x0))). Strictly monotone and bounded, so ordering is
 *   preserved everywhere. But it is non-zero at x = 0: a market with no
 *   evidence at all would receive positive confidence. That is a fabrication,
 *   and a worse failure than saturation — the engine's whole thesis is that
 *   absence of evidence must not read as evidence. Re-anchoring it to pass
 *   through the origin costs its main advantage and still perturbs the entire
 *   calibrated range. Rejected.
 *
 * TANH, 10·tanh(x/s). Strictly monotone, bounded, and correctly maps 0 → 0.
 *   Genuinely viable. Rejected only because it perturbs EVERY score, including
 *   the low and middle range where the current linear behaviour is not broken
 *   and where all four grade thresholds were calibrated. Fixing the top third
 *   should not silently move the bottom two thirds.
 *
 * BAYESIAN posterior over factor likelihoods. The principled answer, and the
 *   only option that would also address the real underlying issue — that the
 *   co-firing factors are strongly correlated and are being summed as though
 *   independent. Rejected because it requires ~68 likelihood ratios
 *   P(factor | outcome), and the calibration inventory records that 0 of 86
 *   parameters in this engine are backtested. Inventing those ratios would
 *   manufacture precision the data does not support. This is a data problem,
 *   not a mathematical preference; see the technical-debt note in
 *   provenance.ts.
 *
 * PIECEWISE SOFT KNEE (chosen). Identity below a knee K, then a strictly
 *   increasing bounded extension above it. Preserves the calibrated regime
 *   exactly and restores injectivity where it was lost, and nowhere else.
 *
 * ── THE FUNCTION ─────────────────────────────────────────────────────────────
 *
 *     f(x) = x                                        for x <= K
 *     f(x) = 10 − (10−K)·exp(−(x−K)/(10−K))           for x >  K
 *
 * This is the unique exponential extension that is C¹ at the knee:
 *
 *     f(K)  = 10 − (10−K)          = K        (continuous)
 *     f'(x) = exp(−(x−K)/(10−K))
 *     f'(K) = 1                                (no kink — slope matches identity)
 *     f'(x) > 0 for all x                      (strictly increasing → injective)
 *     f(x) → 10 as x → ∞                       (bounded, never reached)
 *
 * Strict monotonicity is the property that matters: it makes the map injective,
 * so no two distinct evidence sums are reported as the same confidence. That
 * the supremum 10 is never attained is a feature, not a defect — no finite
 * evidence set justifies certainty.
 *
 * FLOAT64 CAVEAT, stated rather than glossed. "Never attains 10" holds in ℝ but
 * not in binary64: once (10−K)·exp(−(x−K)/(10−K)) drops below the ulp of 10
 * (≈1.8e−15), the subtraction rounds to exactly 10. With K = 8.5 that happens
 * around x ≈ 59.5. The weight table's 34 positive weights sum to 260, so the
 * largest score the engine can produce is 26.0 — where the function returns
 * 9.9999871, comfortably below the ceiling. Strict monotonicity therefore holds
 * across the entire REACHABLE domain, and the tests assert it over [0, 26]
 * rather than over an unbounded range the engine cannot reach. If the weight
 * table ever grows past ~595 total positive points, this note becomes a bug
 * and the knee (or the divisor) has to move.
 *
 * ── WHY K = gradeThresholds.veryStrong ───────────────────────────────────────
 *
 * K is DERIVED, not tuned. It is the largest calibrated grade threshold (8.5),
 * which makes it the smallest knee for which no grade boundary lies in the
 * compressed region. That yields a provable property:
 *
 *     for x <= K:  f(x) = x           — every score below veryStrong is bit-identical
 *     for x >  K:  f(x) > K           — every score above stays above
 *
 * so { x : f(x) >= K } = { x : x >= K }. THE TRANSFORM CHANGES NO GRADE, FOR
 * ANY INPUT. It only adds resolution inside veryStrong, which is exactly where
 * the resolution was lost.
 *
 *   Why not LOWER (e.g. K = 7, the 'strong' threshold)? It gives more range to
 *     spread the top mass across (f(10) = 8.90 rather than 9.45), but scores in
 *     [7, 8.5] would move, demoting some setups from veryStrong to strong. That
 *     is a recalibration, and there is no backtest to justify which way it
 *     should go. Changing classifications must be evidence-driven.
 *   Why not HIGHER (e.g. K = 9.5)? The compressed band [9.5, 10) is too narrow
 *     to separate a pre-clamp range running to 15 and theoretically to 26: at
 *     two-decimal display precision the top third would re-collapse into a
 *     handful of distinct values, reintroducing the defect in miniature.
 *   At K = 8.5 the measured saturating mass spreads across roughly
 *     [9.45, 9.98] — about 53 distinct values at display precision, with
 *     ordering fully preserved.
 *
 * SCALING. K is read from the grade thresholds rather than written as 8.5, so
 * retuning a threshold cannot silently move the knee out from under it. The
 * function is defined on the normalised 0–10 scale and is therefore independent
 * of volatility regime and timeframe; those affect how much evidence fires, not
 * how evidence maps to a score.
 */

/** Upper bound of the confidence scale. */
const SCALE_MAX = 10

/**
 * Maps an unbounded non-negative score onto [0, SCALE_MAX) with an identity
 * region below `knee`.
 *
 * @param x    Normalised score (rawPoints / divisor). May exceed SCALE_MAX.
 * @param knee Boundary of the identity region; must satisfy 0 < knee < SCALE_MAX.
 */
export function softClamp(x: number, knee: number): number {
  // NaN cannot be ordered against anything, so it is floored rather than
  // propagated — a NaN confidence would poison every comparison downstream,
  // including the grade switch. +Infinity maps to the function's limit rather
  // than to 0, so the map stays monotone on the extended reals.
  if (Number.isNaN(x)) return 0
  if (x === Infinity) return SCALE_MAX
  if (x <= 0) return 0

  // Degenerate knee: fall back to the hard clamp rather than dividing by zero
  // or inverting the curve. Reachable only via a malformed config.
  if (!(knee > 0 && knee < SCALE_MAX)) return Math.min(SCALE_MAX, x)

  if (x <= knee) return x

  const headroom = SCALE_MAX - knee
  return SCALE_MAX - headroom * Math.exp(-(x - knee) / headroom)
}
