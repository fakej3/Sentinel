/**
 * NarrativeRenderer — turns V6 state into words. It may not compute anything.
 *
 * This is a hard architectural constraint, not a style preference. In V5 the
 * writer re-derived the trade plan's reasoning from a PARTIAL copy of the
 * classifier's chain, and the two drifted: setups downgraded for excessive
 * risk/reward or low data trust were explained to the trader as "wait for more
 * price history" — a condition that was not the reason and, for the risk/reward
 * case, was not true. The same class of drift made a validator contradict its
 * producer on 31.7% of analyses.
 *
 * The structural fix is that a renderer receives finished values and has no
 * access to the inputs that produced them. This module takes no candles, no
 * trajectory maths, and no thresholds. It cannot form an opinion because it
 * cannot see anything to form one about.
 *
 * Consequently every sentence here is a restatement of a measured value. There
 * is no adjective that is not directly backed by a field.
 */
import type { Situation } from '../situation/types'
import type { Verdict } from '../salience/engine'
import type { MultiTimeframeContext } from '../context/types'

function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}

/** One clause per signature dimension, each a literal restatement. */
function describeSignature(s: Situation): string {
  const { signature: g, measurements: m } = s
  // The share reported must be the share of the direction being NAMED.
  // An earlier version printed upShare regardless, so a downward drift read
  // "drifting down (0% of the last 20 bars closed down)" — self-contradictory,
  // and exactly the renderer-fabrication class this module exists to prevent.
  // Caught by running the pipeline, not by a unit test.
  const shareOfNamedDirection = g.drift === 'down' ? 1 - m.upShare : m.upShare
  const drift = g.drift === 'mixed'
    ? `no consistent direction (${pct(m.upShare)} of the last ${m.window} bars closed up)`
    : `drifting ${g.drift} (${pct(shareOfNamedDirection)} of the last ${m.window} bars closed ${g.drift})`

  const location = g.location === 'mid'
    ? `mid-range (${pct(m.rangePosition)} of a range ${m.rangeWidthInAtr.toFixed(1)} ATR wide)`
    : `in the ${g.location === 'high' ? 'upper' : 'lower'} third of its range `
      + `(${pct(m.rangePosition)} of ${m.rangeWidthInAtr.toFixed(1)} ATR)`

  const vol = g.volatility === 'stable'
    ? `volatility at its own norm (${m.volatilityRatio.toFixed(2)}x)`
    : `volatility ${g.volatility} (${m.volatilityRatio.toFixed(2)}x its recent norm)`

  const part = m.participationZ === null
    ? 'participation unmeasurable'
    : `participation ${g.participation} (${m.participationZ >= 0 ? '+' : ''}${m.participationZ.toFixed(1)}σ)`

  return `${drift}, ${location}, ${vol}, ${part}`
}

/**
 * The situation, as a sentence. Describes only what was measured.
 *
 * Note what is absent: no direction call, no quality rating, no suggestion.
 * Phase 1 has no evidence about outcomes, so it makes no statement about them.
 */
export function renderSituation(context: MultiTimeframeContext, situation: Situation): string {
  return `${context.base}: ${describeSignature(situation)}.`
}

/**
 * The full Phase 1 output: what is true, and why nothing is being claimed.
 *
 * A refusal is a first-class output and is written to be genuinely useful —
 * it states the market's condition and names the missing evidence, rather than
 * going blank or padding with a generic setup.
 */
export function renderVerdict(
  context: MultiTimeframeContext,
  situation: Situation,
  verdict: Verdict,
): string {
  const head = renderSituation(context, situation)
  if (verdict.speak) return `${head} ${verdict.because}`
  return `${head} No call: ${verdict.silence.detail}`
}

/** Reference-class key, for diagnostics and corpus inspection. */
export function renderSignatureKey(situation: Situation): string {
  return situation.signature.key
}
