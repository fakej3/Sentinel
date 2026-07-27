/**
 * Sentinel V6 — Phase 1 entry point.
 *
 * V6 runs BESIDE V5. Nothing here is wired to the UI, nothing here is imported
 * by `modules/`, and nothing in V5 is modified. The only shared code is two
 * neutral primitives: the `Candle` type and the `Unavailable` vocabulary.
 *
 * Phase 1 produces a description and a refusal. That is the whole intended
 * output: the representation is the deliverable, and prediction is deliberately
 * absent until a corpus exists to ground it.
 */
import type { Unavailable } from '../modules/common/availability'
import type { TimeframeInput } from './context/multi-timeframe'
import { buildContext } from './context/multi-timeframe'
import { encodeSituation } from './situation/encoder'
import { tail } from './trajectory/encoder'
import { baseView } from './context/multi-timeframe'
import { retrieve, EMPTY_CORPUS } from './analog/engine'
import type { AnalogCorpus } from './analog/engine'
import { judge } from './salience/engine'
import { renderVerdict } from './narrative/renderer'
import type { MultiTimeframeContext } from './context/types'
import type { Situation } from './situation/types'
import type { Verdict } from './salience/engine'

export interface V6Analysis {
  readonly context: MultiTimeframeContext
  readonly situation: Situation
  readonly verdict: Verdict
  /** Rendered by the pure renderer; contains no computation. */
  readonly narrative: string
}

export type V6Result =
  | { readonly ok: true; readonly analysis: V6Analysis; readonly unavailable: null }
  | { readonly ok: false; readonly analysis: null; readonly unavailable: Unavailable }

/**
 * Horizons at which forward outcomes will be measured in Phase 2.
 *
 * PROVENANCE: heuristic. Chosen to span "immediate", "session-scale" and
 * "multi-session" on any timeframe, in bars rather than clock time so they are
 * timeframe-independent. Calibration target for Phase 3.
 */
const HORIZONS: readonly number[] = [4, 12, 48]

/**
 * Run the V6 pipeline.
 *
 * `inputs[0]` is the timeframe under analysis; later entries are higher
 * horizons that locate it. Any stage that cannot proceed honestly returns a
 * structured reason rather than a degraded result.
 */
export function analyseV6(
  inputs: readonly TimeframeInput[],
  corpus: AnalogCorpus = EMPTY_CORPUS,
): V6Result {
  const context = buildContext(inputs)
  if (!context.ok) return { ok: false, analysis: null, unavailable: context.unavailable }

  const situation = encodeSituation(context.context)
  if (!situation.ok) return { ok: false, analysis: null, unavailable: situation.unavailable }

  const shape = tail(baseView(context.context).trajectory, situation.situation.measurements.window)
  const analogs = retrieve(
    { situation: situation.situation, shape, horizons: HORIZONS },
    corpus,
  )
  const verdict = judge(analogs, situation.situation)

  return {
    ok: true,
    analysis: {
      context: context.context,
      situation: situation.situation,
      verdict,
      narrative: renderVerdict(context.context, situation.situation, verdict),
    },
    unavailable: null,
  }
}

export { encodeTrajectory, tail } from './trajectory/encoder'
export { buildContext, baseView, higherViews } from './context/multi-timeframe'
export { encodeSituation, allSignatureKeys } from './situation/encoder'
export { retrieve, EMPTY_CORPUS, MIN_SAMPLE_SIZE } from './analog/engine'
export { judge } from './salience/engine'
export { renderSituation, renderVerdict, renderSignatureKey } from './narrative/renderer'
export type { Trajectory, TrajectoryPoint, TrajectoryResult } from './trajectory/types'
export type { MultiTimeframeContext, TimeframeView, RangePosition, VolatilityContext } from './context/types'
export type { Situation, SituationSignature, SituationMeasurements } from './situation/types'
export type { AnalogQuery, AnalogMatch, ForwardEstimate, AnalogResult, AnalogCorpus } from './analog/engine'
export type { Verdict, SilenceReason } from './salience/engine'
export type { TimeframeInput } from './context/multi-timeframe'
