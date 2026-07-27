# Sentinel V6 — Core Architecture (Phase 1)

V6 lives beside V5. It shares nothing with `modules/` except two neutral
primitives: the `Candle` type and the `Unavailable` vocabulary. V5 is untouched,
still shipping, and still the only thing wired to the UI.

## The defect V6 exists to fix

V5 reduces ~500 candles to 18 indicator scalars, then to 68 context-free
booleans, then to one number. Measured consequences:

- **0 of 42** files in `analysis`, `fibonacci`, `confidence`, `validation` and
  `writer` read raw candles. Everything after the indicator layer is a lossy
  transform of a summary.
- The whole pipeline emits **4.95 bits — 75 distinct output states** across
  6,000 simulated markets. Two structurally different charts that fire the same
  booleans are, to V5, the same chart.
- **34.4%** of the 68-parameter confidence score's variance is explained by the
  *count* of evidence items, not by which ones fired.

The root cause is **premature scalarisation followed by context-free
binarisation**. A boolean has nowhere to put a condition, so "RSI 32 on the
third bar of a shallow pullback in a strong uptrend" is inexpressible; only
"RSI oversold: true" is. No downstream sophistication recovers what layer one
discarded.

## The V6 rule

> Preserve the shape. Do not scalarise before reasoning.
> Ground every claim in measured history, or say nothing.

## Phase 1 scope — representation only

Phase 1 builds the representation and the pipeline skeleton. It makes **no
predictions and no claims**. There is deliberately no scoring, no voting, no
confidence, and no aggregation anywhere in this directory.

```
Candle[]  ─▶ TrajectoryEncoder ─▶ Trajectory        (a SEQUENCE, never a scalar)
             │
Candle[]×N ─▶ MultiTimeframeContext ─▶ Context      (coordinates, never votes)
             │
             ▶ SituationEncoder ─▶ Signature        (a retrieval KEY, never a conclusion)
                                        │
                                        ▶ AnalogEngine    (skeleton — Phase 2)
                                        ▶ SalienceEngine  (skeleton — silence by default)
                                        ▶ NarrativeRenderer (pure; may not compute)
```

## Invariants every V6 module must hold

These are enforced by tests, not convention:

| Invariant | Meaning |
|---|---|
| **Causal** | A value at bar *i* uses only candles `0..i`. No look-ahead, ever. |
| **Prefix-stable** | Encoding `candles[0..m]` gives byte-identical output to the first *m* entries of the full run. |
| **Scale-invariant** | Multiplying every price by *k* leaves the encoding unchanged *to floating-point precision*. BTC at \$9k and \$90k encode identically. See the caveat below. |
| **Deterministic** | Same input, same output. No clock, no randomness, no hidden state. |
| **Finite** | No NaN, no Infinity, anywhere in any output. |
| **Honest** | Insufficient data produces a structured `Unavailable`, never a filled-in default. |

### Scale invariance is exact in ℝ, not in binary64

Measured worst deviation over 120 bars × scale factors 1e-6 … 1e6:
**3.6e-14 absolute**, 2.3e-11 relative. The relative figure is large only where
the value itself is near zero — `close − prevClose` loses precision to
cancellation when consecutive closes are nearly equal, and `(k·a − k·b)/(k·c)`
is not bitwise equal to `(a − b)/c`.

This is stated rather than glossed because an earlier draft of this document
claimed byte-identical output, and that claim was false. The consequences are
bounded and acceptable: the *signature* — being categorical — is exactly
invariant except for a measure-zero set where a measurement sits within ~1e-11
of a bucket boundary, and analog distance is computed over quantities whose
scale is O(1), so 1e-14 noise cannot reorder neighbours.

## What V6 refuses to contain

Stated explicitly because these are the failure modes V5 fell into:

- No weighted sums. No factor registry. No 0–10 scores. No confidence engine.
- No module may hold a private opinion about direction. In V5, **55 modules
  independently classified bullish/bearish**; V6 has exactly one place where a
  market claim can be made (the AnalogEngine, from history), and it is not built yet.
- No downstream module may re-derive an upstream module's rule. Values travel
  with their meaning attached.

## Constant provenance

Carried forward from V5's provenance discipline: every constant is labelled
`derived` (forced by mathematics or by the definition of the quantity) or
`heuristic` (a defensible choice that is not forced). Heuristic constants are
calibration targets for Phase 3 and are marked as such at their definition site.
No constant in V6 is fitted against outcomes yet, and none pretends to be.

## How this replaces V5

Not by rewriting V5 in place. V6 grows beside it until the AnalogEngine can be
measured against V5 on a shared backtest harness. Only components that
demonstrably win get promoted, and V5 deletions happen with evidence rather
than argument. Phase 1 deletes nothing.
