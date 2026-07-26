/**
 * Monotone, continuous ceiling penalty.
 *
 * Replaces the pattern `if (score > threshold) score -= penalty`, which is
 * discontinuous and NON-MONOTONIC: with threshold 8.0 and penalty 1.6, a raw
 * score of 8.00 passed through untouched while 8.01 collapsed to 6.41 — more
 * confirming evidence producing lower confidence. That is indefensible in any
 * scoring system and was a genuine defect in the confidence engine.
 *
 * The repair is piecewise, using only the existing calibrated constants
 * (ceiling ≡ threshold − penalty):
 *
 *     score ≤ ceiling        →  score            untouched. Preserves the
 *                                                original design intent that
 *                                                already-low scores signal
 *                                                uncertainty and must not be
 *                                                double-penalised.
 *     ceiling < score < T    →  ceiling          flat band — precisely the
 *                                                region where the old rule
 *                                                was discontinuous.
 *     score ≥ threshold      →  score − penalty  identical to the old
 *                                                behaviour, so every
 *                                                previously-calibrated
 *                                                high-score outcome is
 *                                                preserved exactly.
 *
 * CONTINUITY: at score = ceiling both branches yield ceiling; at
 * score = threshold the flat band yields ceiling and the subtraction yields
 * threshold − penalty = ceiling. No jumps.
 *
 * MONOTONICITY: the three segment slopes are 1, 0, 1 — never negative, so the
 * output is non-decreasing in the input everywhere.
 *
 * No new constants are introduced; the ceiling is derived from the two values
 * the caller already supplies.
 */
export function applyCeilingPenalty(
  score: number,
  threshold: number,
  penalty: number,
): number {
  const ceiling = Math.max(0, threshold - penalty)
  if (score <= ceiling)   return score
  if (score >= threshold) return score - penalty
  return ceiling
}
