# Evaluation harness

Answers one question: **does Sentinel's output carry information about what happens next?**

It records what the engine said and what the market then did. It does not
interpret. Turning records into verdicts belongs to the metrics layer, where
the assumptions can be stated and varied.

Nothing in `src/harness/` is imported by the application. It is measurement
infrastructure; it does not run in production.

---

## The leak argument

Every claim the harness will ever make rests on the engine not seeing the
future. The argument is short by design, because a long one cannot be checked.

At decision bar `i`, `engine.ts` computes exactly two things:

| | expression | range read |
|---|---|---|
| **past** | `analyseWindow(candles.slice(i - L + 1, i + 1))` | `[i-L+1, i]` |
| **future** | `computeOutcomes(candles, i, horizons, atr)` | `(i, i+h]` |

The ranges are disjoint. Three supporting facts close the remaining routes:

1. **The window is a slice.** `analyseWindow` receives a copied array with no
   reference to the parent series, so it cannot index past its end even by
   mistake.
2. **The ATR that scales outcomes comes from the window's own snapshot.**
   Recomputing it over the future would put future volatility into the
   denominator of every outcome.
3. **Nothing is aggregated across bars.** No running state exists that could
   carry a future value backwards into an earlier observation.

There is one non-obvious input: `MarketData.ticker`. Sentinel's confidence
module reads `analysis.price.change24hPercent`, which comes from the ticker, so
a ticker built from the whole series would be a direct look-ahead into the
engine's own score. `snapshot.ts` reconstructs it from the trailing 24 hours
**of the window**.

### How the argument is enforced

`__tests__/no-lookahead.test.ts` does not check prefix stability, which is the
usual formulation and is too weak — it would pass even if a shared buffer
carried a future value backwards, because the value would be absent from both
runs. Instead it **replaces every candle after bar `i` with unrelated random
data** and asserts the recorded features and categoricals at bar `i` are
byte-identical. It also asserts the outcomes *do* change, so the test is known
to be capable of detecting change at all.

Both leak mutations tried against it were caught:

| mutation | result |
|---|---|
| window shifted one bar into the future | 4 tests failed |
| window grown from bar 0 instead of a fixed lookback | 1 test failed |

Three mutations of `outcomes.ts` were also caught (decision bar included in the
excursion window; shortened horizon allowed at the boundary; entry taken from
the next bar's open).

---

## Null calibration

A backtest that finds edge everywhere is worthless. The only way to distinguish
*"Sentinel has edge"* from *"the measurement manufactures edge"* is to run it on
data whose true answer is known.

Geometric Brownian motion with zero drift is that data. For a driftless GBM,

```
log(P_{t+h} / P_t) = Σ σ·z_k ,  z_k ~ iid N(0,1)
```

is zero-mean, symmetric and continuous, so `P(forwardReturn > 0) = 1/2`
**exactly** — and conditioning on any function of bars up to `t` leaves it at
1/2, by independence. So for every engine output `g` and every horizon `h`:

```
P(up_h = 1 | g(past) = v) = 1/2
```

`__tests__/null-calibration.test.ts` measures 60 independently seeded series at
`stride = 48 = max(horizons)`, so forward windows are disjoint and a plain
binomial standard error is valid. Overlapping windows would inflate the
effective sample size — the same false-precision trap that produced a spurious
`z = 8.9` in an earlier coverage experiment.

Measured over the full sweep — every horizon × every category value with
n ≥ 100:

| conditioning | cells | max abs z |
|---|---|---|
| unconditional base rate | 4 | 1.20 |
| `direction` (long / short / null) | 12 | 2.61 |
| `trend` | 18 | 2.61 |
| `grade` | 16 | 1.89 |
| `setup_quality` | 12 | 2.61 |
| confidence, split at the median | 8 | 2.07 |

**On the 2.61.** About 58 cells are tested. The expected maximum of 58 draws
from N(0,1) is ≈ 2.7, so a max |z| of 2.61 is what pure noise looks like at
this multiplicity, not a trace of signal. (The cells are not independent —
horizons and partitions reuse the same observations — so 58 is an upper bound
on the effective multiplicity, which makes 2.61 if anything less surprising.)
The 4σ bound is set above this on purpose: it is a defect detector, not a
significance test.

The test also runs the counter-experiment: the same statistic on a series with
`drift = 0.002` **breaches** the same 4σ bound. Without it, the null result
would be consistent with a harness that always reports 1/2.

---

## What is measured, and what is not

**Included.** Indicators, market structure, S/R context, volume, trend
conditions, and the engine's own aggregate outputs (confidence, trust,
validation counts, evidence count, risk/reward, maturity, actionable). The
aggregates are recorded as features specifically so Phase 3 can test whether
the engine's aggregation adds anything beyond its raw inputs.

**Excluded, deliberately.**

- The writer, the AI provider and the narrative composers. They produce prose,
  and prose cannot be scored.
- Multi-timeframe agreement. It needs a second series aligned in time, and
  supplying it per-decision without look-ahead is a separate problem. Its
  absence is recorded, not faked.

**Two rules on the feature matrix** (`features.ts`):

- **No raw prices.** Every price-derived feature is a ratio to the decision-bar
  close or a multiple of ATR. A price level would let a model separate 2019 BTC
  from 2024 BTC and "predict" the era rather than the market. Enforced by a
  test that rescales every price by 1000× and requires every feature to be
  unchanged. This test found a real defect during authoring: Sentinel's
  `BollingerResult.bandwidth` is the raw width `upper − lower` in price units,
  not the conventional normalised bandwidth, and recording it as-is smuggled
  price level into the matrix.
- **No silent defaults.** An unavailable indicator is omitted, not zero-filled.
  Zero-filling would place "EMA200 unavailable" and "price exactly at EMA200"
  at the same coordinate. The CSV writes an empty field, never `0`.

---

## Constants

| constant | value | provenance |
|---|---|---|
| `lookbackBars` | 200 | `DEFAULT_CANDLE_LIMIT` in `modules/binance/constants.ts` — exactly what the deployed engine ever sees. A longer window would measure an engine that does not exist. |
| `horizons` | 4, 12, 24, 48 bars | specified by the measurement brief |
| `embargoBars` | `max(horizons)` | derived: a label at train bar `t` reads through `t + max(h)`, so a gap of `max(h)` is the smallest that no training label can cross. Not tunable; `validateSplit` refuses anything smaller. |
| null-calibration `stride` | 48 | `= max(horizons)`, the smallest stride giving disjoint forward windows |
| null-calibration threshold | \|z\| ≤ 4 | two-sided p ≈ 6.3e-5. Seeds are fixed, so the assertion is deterministic. |

---

## Data

This environment has no route to `api.binance.com` — the proxy returns 403 on
CONNECT — so the harness is data-source-agnostic by construction:

- `syntheticSource` — seeded GBM. The null calibration.
- `jsonFileSource` — reads `{ symbol, timeframe, candles }` files from a
  directory. **Rejects rather than repairs**: malformed JSON, an unknown
  timeframe, a malformed candle, or non-increasing timestamps all fail at load
  with the filename in the message. Silent repair is how a corpus acquires bars
  no exchange ever printed.
- `inMemorySource` — anything already in hand.

A Binance-backed source would be ten lines and would require no change to the
runner.

---

## Reproducibility

A run is a pure function of `(source, config)`.

- Synthetic data is generated from a seeded LCG.
- `analyseWindow` timestamps the analysis from the data (`closeTime` of the
  decision bar), never from a clock.
- `buildManifest` takes `generatedAt` as a parameter for the same reason —
  determinism ends where a clock begins.
- `writeRun` emits `observations.csv`, `observations.jsonl` and `manifest.json`
  side by side, so any number in a later report resolves back to a source, a
  config and a sample size.

Runtime: ~2,300 pipeline invocations/second at `lookbackBars = 200` on this
machine (997 observations over a 1,200-bar series in 423 ms, warm).

## Input validation

`validate.ts` is the single definition of a well-formed series, checked by both
`parseSeriesFile` and `runSeries`. It was originally enforced only at file
load, so a series arriving by any other route bypassed it — and a misordered
series does not fail downstream, it produces plausible numbers. Swapping two
candles 100 bars apart yielded 237 entirely ordinary-looking observations.

Rejected: non-finite or non-positive prices, `high < low`, negative volume,
non-increasing `openTime`. Deliberately *not* rejected, with reasons stated in
the file: `high >= max(open, close)` (real feeds violate it on auction prints),
uniform bar spacing (halts are real, and VWAP already detects gaps), and
`takerBuy + takerSell === volume` (not every source populates the split). An
empty series is well-formed — "nothing to measure" is not "corrupt".
