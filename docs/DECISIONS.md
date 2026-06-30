# Sentinel — Architecture Decision Records

This document is a permanent record of every significant engineering decision made
during the design and development of Sentinel.

## Purpose

Engineering decisions made under time pressure, incomplete information, or
competing constraints are easy to forget or misattribute. When a future engineer
encounters an unusual design choice, this document should explain why it exists,
what alternatives were rejected, and what consequences to expect.

**When to add a record:**

Add a new ADR whenever a decision:
- Affects more than one module.
- Involves a tradeoff (choosing one approach means giving something up).
- Would surprise a reasonable engineer reading the code for the first time.
- Has consequences that are not obvious from the code itself.

**Format:** Each record uses a consistent structure so that decisions can be
evaluated consistently.

---

## ADR-001 — Deterministic Analysis Engine

**Date:** 2026-06-29
**Status:** Accepted

### Decision

All analysis logic in Modules 1–8 is implemented as pure, deterministic functions.
Given identical inputs and identical configuration, a function always returns
identical outputs.

### Reason

A deterministic engine is verifiable. Every output can be independently reproduced
by any engineer or automated tool with access to the same candle data. This makes
the system auditable, testable, and trustworthy in a way that statistical or
AI-generated analysis cannot be.

### Alternatives Considered

- **Probabilistic outputs:** Return a distribution over possible states rather than
  a point estimate. Rejected because it is significantly harder to validate and
  communicate to users.
- **Machine-learning classification:** Train a model to label market structure.
  Rejected because ML models are non-deterministic across versions, platform-specific,
  and cannot be audited by citing a rule document.

### Tradeoffs

- Gain: outputs are verifiable, reproducible, and explainable.
- Loss: the engine cannot adapt to market regimes that its rules do not anticipate.
  Novel conditions produce the best available answer from the existing rule set,
  not a calibrated "I don't know."

### Consequences

- All functions in Modules 1–8 must be free of side effects, global state, and
  randomness.
- Tests can verify correctness exhaustively using known inputs.
- The rule set must be explicitly documented and updated when market conventions
  change.

**Review date:** When Module 8 is complete and the full analysis pipeline is running.

---

## ADR-002 — AI Is a Writer, Not an Analyst

**Date:** 2026-06-29
**Status:** Accepted

### Decision

AI (Claude or any LLM) is used exclusively in Module 9 (Writing Engine) to
transform pre-validated, structured JSON into professional prose. AI must never
perform calculations, make inferences from raw data, or generate numbers.

### Reason

LLMs hallucinate. When asked to calculate RSI or identify market structure, they
produce plausible-looking but frequently wrong numbers. In a market analysis product
where users may act on the output, a fabricated RSI value or a wrong trend label is
a serious reliability and trust failure.

The platform's value proposition is accuracy. Every sentence must be traceable to
a real computed value. AI cannot provide this guarantee when generating analysis.

### Alternatives Considered

- **AI-augmented analysis:** Use an LLM to interpret indicators and suggest likely
  explanations. Rejected because the LLM cannot guarantee accuracy, and any
  inaccuracy would undermine the entire product's credibility.
- **AI for both writing and analysis:** End-to-end LLM with tool calls for market
  data. Rejected for the same reason — tool-call results are passed back through
  the LLM's generation process, introducing hallucination risk.

### Tradeoffs

- Gain: every number in the generated content is real and verifiable.
- Loss: the system cannot reason about novel market conditions that the rule set
  does not cover. It can only describe what it observes.

### Consequences

- Modules 1–8 are zero-AI.
- Module 9 receives only fully validated, structured JSON. It is given no raw candle
  data and no intermediate computation results.
- The Validation Engine (Module 7) runs before Module 9 and rejects any unsupported
  claims before they reach the writer.

**Review date:** When Module 9 is implemented.

---

## ADR-003 — Canonical Confidence Scale: 0–10

**Date:** 2026-06-30 (revised during Foundation Stabilization)
**Status:** Accepted

### Decision

All confidence scores in this project use a 0–10 float scale. This applies to:

- Module 3 (`MarketStructureResult.confidence`) — structural evidence alignment.
- Module 8 (future) — full cross-module evidence-weighted score.
- All documentation, validation rules, and UI display.

The value `0.0` means no evidence alignment. The value `10.0` means maximum evidence
alignment. A score of `8.6` means strong but not perfect alignment.

### Reason

`ENGINE_RULES.md §11` and `ARCHITECTURE.md` both specified a 0–10 scale. The
original Module 3 implementation returned 0–100. This was identified as a Critical
inconsistency during audit v0.1 (2026-06-30). The 0–10 scale was chosen as
canonical because:

1. It matches the existing documentation.
2. A 0–10 scale is natural for scores presented to users ("8.6 out of 10").
3. It maintains consistency with Module 8's planned output.

### Alternatives Considered

- **0–100 scale:** More granular, familiar from percentage-based systems. Rejected
  because it conflates "confidence score" with "probability percentage," which the
  manifesto explicitly prohibits.
- **0.0–1.0 scale:** Common in ML systems. Rejected because fractions like `0.86`
  are less readable in a UI than `8.6`.

### Tradeoffs

- Gain: consistent terminology and display across all modules and documentation.
- Loss: the internal raw-point scoring in Module 3 (which can reach ~120 points)
  must be divided by 10 to reach the 0–10 scale, adding a normalization step.

### Consequences

- `computeConfidence` in `confidence.ts` divides by 10 and clamps to `[0, 10]`.
- `MarketStructureResult.confidence` is typed as `number` with a `0–10` comment.
- `VALIDATION_RULES.md §1` validates `0.0 ≤ confidence ≤ 10.0`.
- Any code reading this field must expect 0–10, not 0–100.

**Review date:** When Module 8 produces its own confidence score and the two must be reconciled.

---

## ADR-004 — Server-Side Proxy for Binance API

**Date:** 2026-06-30 (documented during Foundation Stabilization)
**Status:** Accepted

### Decision

Production browser clients must access Binance data through a server-side proxy.
Direct browser calls to `api.binance.com` are blocked by CORS policy. During
local development, a Vite `server.proxy` configuration is used as a workaround.
This workaround must not ship to production.

### Reason

The Binance REST API does not include `Access-Control-Allow-Origin` headers for
browser requests. This is a hard browser security restriction, not a configurable
option. The platform is designed as a PWA (Progressive Web App), which runs in a
browser. Without a proxy, Module 1 cannot function.

### Alternatives Considered

- **JSONP / alternative endpoints:** Some Binance endpoints return JSONP. Rejected
  because JSONP is legacy, not typed, and not supported by the existing fetch-based
  client.
- **Electron/desktop app:** CORS restrictions do not apply in Electron's main process.
  Rejected because the platform targets a PWA that can be installed on iOS, Android,
  and Windows without a native app distribution.
- **Reframe as server-side:** Run the entire analysis pipeline on a server and expose
  a computed-result API. Rejected for the initial architecture because client-side
  computation is a core design principle (offline support, no server costs for analysis).

### Tradeoffs

- Gain: the PWA stays client-side for all computation; only data fetching requires
  a server.
- Loss: a server-side proxy component is required for production deployment. This
  adds operational complexity.

### Consequences

- The Vite dev proxy is configured in `vite.config.ts` for local development.
- The production proxy spec is documented in `ARCHITECTURE.md` (CORS section).
- Module 1 tests use mocked `fetch` so tests pass without a real proxy.
- This is recorded as a known limitation in `KNOWN_LIMITATIONS.md`.

**Review date:** When the production PWA deployment environment is chosen.

---

## ADR-005 — Structural Bias vs. Full Trend

**Date:** 2026-06-30 (documented during Foundation Stabilization)
**Status:** Accepted

### Decision

`MarketStructureResult.trend` represents **structural bias** — the directional
lean of the market based on swing point patterns (HH/HL vs LH/LL) alone.

It does not represent the **full trend** as defined in `ENGINE_RULES.md §1`, which
requires EMA alignment, RSI above/below thresholds, and MACD confirmation in
addition to market structure.

The field is named `trend` for convenience, but it must be documented and treated
as a partial signal until the full synthesis is performed by Module 6.

### Reason

Module 3 operates on candle data only. It has no access to computed indicators
(EMAs, RSI, MACD) because those are produced by Module 2 and not passed into
`computeMarketStructure`. The full trend definition requires cross-module synthesis
that belongs in the Evidence Engine (Module 6), not in a single analysis module.

Renaming `trend` to `structuralBias` across all types, tests, and evidence strings
was evaluated but rejected during stabilization because:

1. The downstream modules (4–9) have not yet been built, so there are no callers
   that depend on the field name.
2. The distinction is adequately captured by the JSDoc comment and this record.
3. Renaming can be done cleanly when Module 6 is built and the synthesis field is
   introduced.

### Alternatives Considered

- **Rename to `structuralBias`:** Clean semantically but creates churn in all
  existing tests. Deferred to Module 6.
- **Remove from Module 3 result:** Don't expose a trend field until Module 6 can
  compute it correctly. Rejected because the structural bias is useful context even
  without the full synthesis.

### Tradeoffs

- Gain: Module 3 is self-contained; it can detect directional structure without
  depending on Module 2.
- Loss: the field name `trend` slightly overstates what the value represents.

### Consequences

- The `MarketStructureResult.trend` JSDoc documents the limitation explicitly.
- `ENGINE_RULES.md §1` notes the distinction.
- Module 6 will introduce a synthesized `trend` field that combines Module 2 and
  Module 3 output; at that point the naming should be revisited.

**Review date:** When Module 6 (Evidence Engine) is designed.

---

## ADR-006 — Modular Pipeline Architecture

**Date:** 2026-06-29
**Status:** Accepted

### Decision

The analysis system is organized as a linear pipeline of independent modules.
Each module:

1. Accepts typed inputs.
2. Produces typed outputs.
3. Has no awareness of what comes before or after it in the pipeline.
4. Is independently testable with mock inputs.

No module imports from the internals of another module. All inter-module
communication goes through public `index.ts` APIs.

### Reason

A modular pipeline makes the system:

- **Testable in isolation:** Each module can be verified without running the full
  pipeline.
- **Replaceable:** A better RSI algorithm can replace the existing one without
  affecting Market Structure or Validation.
- **Debuggable:** When an output is wrong, the pipeline can be inspected at each
  stage to find where the error originates.
- **Explainable:** Each stage has a documented input, output, and algorithm.

### Tradeoffs

- Gain: high cohesion within modules; low coupling between modules.
- Loss: data must be re-serialized at each module boundary. In a high-frequency
  trading context this would be a performance concern. At the scale of this project
  (one analysis at a time, browser-based), it is not.

### Consequences

- Each module has its own `types.ts`, `config.ts`, and `index.ts`.
- The `Candle` type from Module 1 is the single canonical input type for all modules.
- Modules do not share internal utilities. Shared computation goes into the module
  that owns the concept.

**Review date:** When Module 8 is complete and the pipeline runs end-to-end.

---

## ADR-007 — Configuration Over Hardcoding

**Date:** 2026-06-29
**Status:** Accepted

### Decision

Every numeric threshold in every analysis algorithm is a named field in a typed
configuration object. No raw number appears inside algorithm logic (with the
exception of mathematically universal constants like `2` in EMA multiplier
formulas or `100` in percentage conversions).

Each module exports a `DEFAULT_CONFIG` object with the values specified in
`ENGINE_RULES.md`.

### Reason

Hardcoded thresholds cannot be tuned without modifying source code. In market
analysis, the optimal threshold for swing detection (`swingLookback`),
consolidation detection (`consolidationThreshold`), or breakout confirmation
(`breakoutVolumeMultiplier`) depends on the timeframe and asset class. Making
these configurable allows callers to adapt the engine without forking it.

### Tradeoffs

- Gain: callers can tune detection without code changes.
- Loss: the function signatures become more complex; callers must understand what
  the config parameters do.

### Consequences

- Every analysis module defines a `<Module>Config` interface in `types.ts`.
- The `DEFAULT_CONFIG` object is exported from `index.ts`.
- Functions accept `Partial<Config>` and merge with `DEFAULT_CONFIG` internally.
- All config fields are documented with JSDoc that references the corresponding
  rule in `ENGINE_RULES.md`.

**Review date:** When a second consumer (not the default config) is in use.

---

## ADR-008 — Evidence-First Analysis

**Date:** 2026-06-29
**Status:** Accepted

### Decision

No conclusion may appear in the final output without an explicit evidence list
that supports it. Every module that produces qualitative conclusions (Market
Structure, Evidence Engine, Confidence Engine) must also produce a `string[]`
evidence array explaining each conclusion in human-readable terms.

### Reason

The `ANALYSIS_MANIFESTO.md` Principle 4 states: "Every market conclusion should
be explainable." Without attached evidence, users cannot verify whether a
"bullish" label is based on strong structural data or marginally above the threshold.
Investors, educators, and content creators using this platform need to understand
and communicate the reasoning, not just the label.

### Tradeoffs

- Gain: every output is auditable; the AI writer has explicit evidence strings to
  transform into prose.
- Loss: additional computation is required to build the evidence strings.

### Consequences

- `MarketStructureResult.evidence` is a non-negotiable output field.
- `buildEvidence(...)` in `evidence.ts` produces one string per conclusion.
- The Validation Engine (Module 7) uses the evidence array as the source of
  claims to validate.

**Review date:** When Module 7 is implemented and the validation loop is tested.

---

## ADR-009 — Validation Before Publishing

**Date:** 2026-06-29
**Status:** Accepted

### Decision

No AI-generated content is published without passing through the Validation Engine
(Module 7). The Validation Engine checks every factual claim in the AI output
against the computed source values. Claims that fail validation are regenerated
(up to three attempts) or omitted.

### Reason

LLMs produce confident-sounding text that frequently contradicts the data they
were given. An RSI of 38 might be described as "healthy bullish momentum." A
bearish trend might be called bullish. Without a validation pass, the published
content would be unreliable.

The platform's core promise is accuracy. A single published error — a wrong RSI
value, a fabricated support level — would undermine user trust permanently.

### Tradeoffs

- Gain: every published sentence is backed by verified data.
- Loss: generation latency increases because of the validation + regeneration loop.

### Consequences

- Module 7 must be built before Module 9 can go to production.
- The regeneration protocol (max 3 attempts; abort if > 30% rejected) is defined
  in `VALIDATION_RULES.md`.
- The validation audit log is stored alongside each analysis in Module 12.

**Review date:** When Module 7 is implemented.

---

## ADR-010 — Wilder's Smoothing for RSI and ATR

**Date:** 2026-06-29
**Status:** Accepted

### Decision

RSI and ATR use Wilder's smoothing (also called Wilder's Moving Average), not
standard exponential moving averages. The smoothing factor is `1/period` rather
than the EMA formula's `2/(period+1)`.

### Reason

Wilder's original RSI (1978) and ATR specifications use this smoothing method.
TradingView, MetaTrader, and most professional charting platforms implement RSI and
ATR with Wilder's smoothing. Using standard EMA would produce different values than
these reference implementations, making cross-platform comparison unreliable.

### Tradeoffs

- Gain: output matches TradingView and industry-standard platforms.
- Loss: the codebase uses two different smoothing methods (EMA vs Wilder's) for
  different indicators, which can be confusing.

### Consequences

- `rsiSeries` in `utils.ts` uses the `1/period` smoothing factor.
- `computeAtr` in `atr.ts` uses Wilder's smoothing for the ATR series.
- The `emaSeries` function uses standard `2/(N+1)` EMA multiplier and must not be
  used for RSI or ATR calculations.
- TradingView comparison tests (when implemented) should pass for RSI and ATR.

**Review date:** When TradingView comparison tests are implemented.

---

## ADR-011 — Testing-First Development

**Date:** 2026-06-29
**Status:** Accepted

### Decision

Every module ships with its full test suite. Tests are written as part of the
implementation work, not as a separate after-the-fact activity. A module without
tests is not considered complete regardless of how correct the implementation looks.

### Reason

For a mathematical analysis engine, tests are the primary mechanism for catching
algorithm bugs. Visual inspection of code cannot catch sign errors, off-by-one
boundaries, or degenerate edge cases the same way a targeted test can. Tests also
prevent regressions when the implementation is later refined.

The project has followed this principle since Module 1 (34 tests), Module 2
(97 tests), and Module 3 (88 initial + 8 stabilization tests).

### Tradeoffs

- Gain: algorithm correctness is continuously verified; regressions are caught
  immediately.
- Loss: initial development takes longer because both implementation and tests
  must be produced before the milestone is complete.

### Consequences

- The Definition of Done in `QUALITY_GATE.md` requires all test categories.
- CI runs `npm test` on every commit.
- Total tests as of v0.7.1: 318 across 30 test files.

**Review date:** Evergreen — this decision is permanent.

---

## ADR-012 — Documentation as Source of Truth

**Date:** 2026-06-29
**Status:** Accepted

### Decision

`ENGINE_RULES.md`, `INDICATOR_RULES.md`, and `VALIDATION_RULES.md` are the
authoritative source of truth for what the system computes and why. Code must
implement the documented rules. When the code and the documentation disagree,
the documentation is wrong only if a deliberate decision was made to deviate — in
which case the documentation must be updated and the decision recorded here.

No logic may exist in the engine without a corresponding rule in the documentation.

### Reason

In a financial analysis system, "what does this number mean?" is a question that
users, auditors, and future engineers will ask. If the answer is "check the code,"
the system fails its transparency requirement. The documentation must be
sufficient to explain every output without reading the implementation.

This standard was reinforced during the Foundation Stabilization audit (v0.1),
which found mismatches between `ARCHITECTURE.md`'s JSON schema and the actual
`MarketStructureResult` type. Both were updated to align.

### Consequences

- Before implementing a new rule, it must first be documented.
- After fixing a bug that changes algorithm behavior, the documentation must be
  updated in the same commit.
- The audit process (see v0.1) checks documentation–implementation alignment
  and flags mismatches as High-severity findings.

**Review date:** Evergreen — this decision is permanent.

---

## ADR-013 — Support & Resistance as Price Zones, Not Price Lines

**Date:** 2026-06-30
**Status:** Accepted

### Decision

All support and resistance levels in Sentinel are represented as **Price Zones** —
bounded rectangular regions of the price axis defined by a center price, an ATR-derived
width, and a lifecycle state. A single representative price (`zone.center`) may be used
by consumers that need a scalar, but the zone boundary is the primary object.

Zone width is always computed as `2 × ATR × atrMultiplier` (configurable). It is never
a fixed percentage or a hardcoded value.

Nearby zones of the same type are merged into a single zone to prevent redundant
overlapping signals representing the same market area.

### Reason

Markets do not reverse at exact prices to the tick. A support "level" at 104,800 means
that somewhere in the range 104,500–105,100 buyers are likely to be active. Representing
this as a single line produces brittle comparisons: price at 104,810 is "at support"
but price at 104,790 is "below support" — a distinction that does not reflect how
markets actually work.

The zone model:

1. **More accurately represents market behavior.** S/R is an area, not a line.
2. **Adapts to volatility.** ATR-based width means zones are wider during volatile periods
   (when exact prices matter less) and tighter during calm markets (when precision
   increases). A fixed-percentage width would be too wide during consolidation and too
   tight during a volatile breakout.
3. **Eliminates redundant micro-zones.** Multiple swing points within a fraction of ATR
   of each other represent the same demand/supply area. Merging them produces a single,
   well-characterized zone rather than a cluster of barely-distinct lines.
4. **Supports future complexity without redesign.** Order Blocks, Fair Value Gaps,
   Fibonacci levels, and Volume Profile nodes all represent price areas. They can all
   be modeled as `PriceZone` instances with a different `origin` value, without changing
   the consuming code in Modules 6–9.
5. **Carries its own evidence.** Each zone has a `touchCount`, `successfulReactions`,
   `failedReactions`, `state`, and `evidence[]`. The AI writer can reference these
   fields directly: "This resistance zone at 109,200 has been tested 3 times, with 2
   successful rejections." No extra computation required.

### Alternatives Considered

**Static price lines (±0.3% tolerance):**
The original `ENGINE_RULES.md §12` defined S/R as price levels with a fixed ±0.3%
tolerance. This was simple to implement but:
- 0.3% is too tight for volatile assets (BTC ATR on 4h is often 1–2%).
- 0.3% is too loose for stable assets trading in tight ranges.
- No notion of lifecycle (active, broken, flipped) — a broken level looks identical
  to an active one.
- No merge logic — every swing creates its own independent level.

This approach was **rejected** in favour of ATR-based zones.

**Classical Pivot Points (R1, R2, S1, S2):**
The original §12 also included classical pivot levels. These are purely mathematical
(derived from the previous session's High, Low, Close) and have no relationship to
where price actually reacted in the current structure. They were well-known in
traditional equity markets but are less reliable in 24/7 crypto markets with no
session reset.

Classical pivots may be **added in the future** as a separate zone origin type
(`'classical-pivot'`), but they are not the primary S/R mechanism.

**EMA-based dynamic S/R:**
Using EMA20/EMA50/EMA200 as dynamic S/R proxies is already covered in Module 2's
output. These are not zones — they are moving lines. The S/R Engine does not need
to duplicate this concept; EMA levels are referenced directly from Module 2's
`IndicatorResult`.

### Tradeoffs

| Gain | Cost |
|------|------|
| More accurate representation of market behavior | More complex than a simple array of prices |
| Adapts to volatility via ATR | Requires ATR to be computed (Module 2 dependency in practice) |
| Zone merging eliminates noise | Merge logic adds one extra algorithmic pass |
| Lifecycle tracking (state machine) | State transitions must be carefully maintained |
| Ready for future S/R concepts without redesign | `PriceZone` type will grow as features are added |

### Future Benefits

Every planned future S/R concept maps naturally to `PriceZone`:

| Concept | `origin` value | Additional fields |
|---------|----------------|-------------------|
| Swing-based S/R (Module 4) | `'swing-high'` / `'swing-low'` | — (baseline) |
| Merged zones | `'merged'` | — |
| Order Blocks | `'order-block'` | `orderBlockType: 'bullish' \| 'bearish'` |
| Fair Value Gaps | `'fair-value-gap'` | `gapSize: number` |
| Fibonacci levels | `'fibonacci'` | `fibLevel: '0.5' \| '0.618' \| '0.786'` |
| Volume Profile nodes | `'volume-node'` | `volumeAtNode: number` |
| Anchored VWAP | `'anchored-vwap'` | `vwapAnchorIndex: number` |

No redesign of Module 4's output type or the Module 6–9 consuming code is required
when any of these are added.

### Consequences

- `ENGINE_RULES.md §12` has been rewritten to define zone creation, width, merging,
  interaction detection, state transitions, strength scoring, and proximity classification.
- `ARCHITECTURE.md` has been updated with the canonical `PriceZone`, `SupportResistanceConfig`,
  and `SupportResistanceResult` type definitions and state transition diagram.
- The shared data structure JSON in `ARCHITECTURE.md` now shows `"supportResistance"` with
  zone objects instead of `"levels"` with flat price arrays.
- When Module 4 is implemented, it will produce `SupportResistanceResult` as described.
- The Validation Engine (Module 7) must validate S/R claims against `zone.center` and
  zone boundaries, not against scalar level arrays.

**Review date:** When Module 4 implementation is complete and the output has been tested
against real historical data.

---

## ADR-014 — Pipeline Order: Merge Before Interactions

**Date:** 2026-06-30 (Module 4 Stabilization, post-audit v0.2)
**Status:** Accepted

### Decision

Module 4's internal pipeline processes zones in this order:
**Create → Merge → Interactions → Filter → Finalize → Classify**

Specifically: zones are merged into their final shapes before `applyInteractions`
scans the candle history. The previous order was Create → Interactions → Filter →
Merge (interactions before merge).

### Reason

With the old order (interactions before merge), each zone's interaction history
was scanned against its narrow pre-merge boundary. After merging, the merged zone
covered a wider area, but its inherited interaction counts were computed against
a smaller range — systematically underestimating how many candles actually entered
the combined zone area.

With the new order (merge before interactions), `applyInteractions` runs against
the correct final merged boundary, capturing all candles that interacted with the
merged zone area.

### Alternatives Considered

- **Merge after interactions (old order):** Simpler to reason about — each zone's
  history is independent. Rejected because it produces incorrect interaction counts
  for merged zones, which affects strength scoring and state classification.
- **Apply interactions twice (pre-merge and post-merge):** Theoretically precise but
  double-counts interactions detected in both passes. Rejected for complexity.

### Tradeoffs

- Gain: merged zones have correct interaction history (touches, bounces, breaks)
  computed against their actual boundaries.
- Loss: constituent swing candles may register as extra touches after merge (see
  KNOWN_LIMITATIONS.md LIM-017). The overcounting is bounded and minor.

### Consequences

- `computeSupportResistance` in `index.ts` runs `mergeZones` before `applyInteractions`.
- `ENGINE_RULES.md §12` documents the pipeline order explicitly.
- LIM-017 in `KNOWN_LIMITATIONS.md` documents the accepted overcounting tradeoff.

**Review date:** When streaming analysis is introduced (order has implications for
incremental computation — see LIM-018).

---

## ADR-015 — computeAtr Exported from Module 2, Not Duplicated in Module 4

**Date:** 2026-06-30 (Module 4 Stabilization, post-audit v0.2)
**Status:** Accepted

### Decision

Module 4 (Support & Resistance) uses Module 2's (Indicator Engine) `computeAtr`
function — exported from `src/modules/indicators` — for all ATR computations.
Module 4 does not contain its own ATR implementation.

The original Module 4 implementation duplicated `computeAtr` with a different
signature (`computeAtr(candles: Candle[])` vs Module 2's
`computeAtr(highs[], lows[], closes[], period)`). The duplicate has been removed.

### Reason

Two ATR implementations in the same codebase create a risk of divergence: one
may be updated while the other is not, causing different modules to compute
different ATR values for the same candle data. ATR is a Module 2 concept. The
canonical implementation belongs there and must be shared.

### Alternatives Considered

- **Keep Module 4's internal ATR:** Simpler in the short term — no cross-module
  dependency. Rejected because divergence risk grows as the codebase evolves.
- **Move ATR to a shared `utils` module:** Would work but introduces a new
  shared utility module for a single function. The cleaner approach is to export
  it from the module that owns the concept (Module 2).

### Tradeoffs

- Gain: single canonical ATR implementation; any fix or improvement to Module 2's
  ATR automatically benefits Module 4.
- Loss: Module 4's `index.ts` must import from `../indicators`, creating a
  cross-module dependency. This is an intentional, documented dependency.

### Consequences

- `computeAtr` is exported from `src/modules/indicators/index.ts`.
- `src/modules/support-resistance/index.ts` imports `computeAtr` from `../indicators`.
- Module 4's `zones.ts` no longer contains an ATR function.
- `ENGINE_RULES.md §12.2` documents that ATR comes from Module 2.

**Review date:** When the full platform pipeline is assembled and tested end-to-end.

---

*Last updated: Module 4 Stabilization (post-audit v0.2)*
