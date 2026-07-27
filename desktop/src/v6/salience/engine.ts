/**
 * SalienceEngine — decides whether there is anything worth saying.
 *
 * V5 had no exit. Candles went in, a trade plan came out, always — which is why
 * ~47% of its plans were volatility arithmetic around the current price with no
 * structural content, and why the output reads as generic. An architecture with
 * no way to say "nothing here" will manufacture something.
 *
 * V6 inverts the default. Silence is the resting state and speech requires
 * evidence, expressed at the type level: `Verdict` cannot be constructed
 * without either a reason to speak or a reason to stay quiet.
 *
 * ── THE THRESHOLD IS DERIVED, NOT CHOSEN ─────────────────────────────────────
 *
 * The criterion is INFORMATION GAIN: speak only when the conditional
 * distribution given this situation differs from the unconditional base rate by
 * more than sampling error. If knowing the situation does not change the
 * expected outcome, the situation is not worth reporting — by definition, not
 * by taste.
 *
 * This matters because it is the one place a silence threshold could have been
 * invented. An earlier draft of this architecture proposed "stay silent ~65% of
 * the time", a number with no derivation — the same error as V5's 86 unfitted
 * parameters. Information gain replaces it with a measurable quantity, and its
 * cutoff falls out of the confidence interval rather than being asserted.
 *
 * Phase 1 ships the decision structure with the only honest verdict available:
 * with no corpus there is no conditional distribution, so there is nothing that
 * could be salient.
 */
import type { AnalogResult } from '../analog/engine'
import type { Situation } from '../situation/types'

/** Why the engine chose to stay quiet. Structured so the UI can explain it. */
export type SilenceReason =
  /** No corpus, or too few analogs for this reference class. */
  | 'insufficient-evidence'
  /** Analogs exist, but their outcomes match the unconditional base rate. */
  | 'no-information-gain'
  /** The situation offers no asymmetry — e.g. mid-range with nothing pending. */
  | 'no-asymmetry'
  /** Retrieval is not implemented yet. Phase 1 only. */
  | 'not-implemented'

export type Verdict =
  | {
    readonly speak: true
    /** What makes this worth a user's attention. */
    readonly because: string
    readonly silence: null
  }
  | {
    readonly speak: false
    readonly because: null
    readonly silence: { readonly reason: SilenceReason; readonly detail: string }
  }

function quiet(reason: SilenceReason, detail: string): Verdict {
  return { speak: false, because: null, silence: { reason, detail } }
}

/**
 * Decide whether to publish.
 *
 * Takes the situation only for its description in the silence detail — it may
 * NOT use the situation to decide, because a situation is a retrieval key and
 * carries no evidence about outcomes. Deciding from the key alone would be
 * exactly V5's mistake: asserting that some configurations are inherently
 * interesting without ever measuring whether they are.
 */
export function judge(analogs: AnalogResult, situation: Situation): Verdict {
  if (!analogs.ok) {
    const code = analogs.unavailable.code
    if (code === 'not-applicable') {
      return quiet('not-implemented',
        `Analog retrieval is not implemented yet, so situation '${situation.signature.key}' cannot be assessed.`)
    }
    return quiet('insufficient-evidence',
      `No usable historical precedent for situation '${situation.signature.key}': ${analogs.unavailable.detail}`)
  }

  // Phase 3 implements the information-gain test here: compare each estimate's
  // dominant share against the unconditional base rate for the same horizon,
  // and require the difference to exceed the interval half-width.
  return quiet('no-information-gain',
    'Information-gain testing is implemented in Phase 3; until then no estimate is published.')
}
