# Metrics

Measures Phase 1 observations. Computes; does not tune, filter or select.
Cannot change engine output by construction — it only reads recorded rows.

---

## The one assumption everything rests on

**Sentinel does not emit probabilities.** `confidence.score` is a 0–10 measure
of how internally consistent the evidence is. Nothing in the engine claims it is
P(correct).

Scoring it as a probability therefore tests an *interpretation*, not a claim the
engine made — and it is the interpretation every reader applies, because a 0–10
"confidence" invites exactly that reading. So the mapping lives alone in
`predictions.ts`, is named on every report, and is swappable:

```ts
scoreToProbability: (score) => score / 10   // the unaided reading
```

If it turns out miscalibrated, the finding is *"the natural reading of the score
is wrong"*, not *"the engine lied"*.

---

## Four scoreboards, because one would mislead

| scoreboard | question | scored over |
|---|---|---|
| `binaryUpDown` | forced up/down call, comparable to a coin | every bar |
| `threeWay` | buy/sell/neutral vs a realised label with a dead-band | every bar |
| `directional` | of the calls it made, how many were right | bars with a direction |
| `trading` | the same calls, in units of the plan's own risk | bars with a direction and a stop |

`binaryUpDown` penalises the engine for abstaining, so it is never the headline.
`threeWay` uses a ±1 ATR dead-band on the realised move so that *staying out* can
be the correct answer — without it, "neutral" could never be right and the matrix
would be structurally unable to reward a real skill.

The `directional` scoreboard has **no true negatives by construction**: every
directional observation is a predicted positive. The structural zeros are
asserted in a test so they are never misread as a failure to measure.

---

## R uses the engine's own stop

```
R = (forward return in ATR) · direction / (stop distance in ATR)
```

Not a fixed 1-ATR risk unit. With an assumed risk unit, every trading metric
measures the assumption rather than the plan. Trades whose plan carries no stop
are excluded and counted in `excludedNoStop`; the accounting identity
`n + excludedNoStop + excludedNoOutcome + excludedNoDirection = observations`
is asserted in a test.

---

## Three limitations that change how every figure reads

**1. Time exit, not bracket exit.** Trades exit at the horizon, not at the
plan's stop or target. A bracket simulation needs to know which was touched
*first*, and MFE/MAE record the extremes but not their order. Rather than assume
an order — the usual silent choice, and the one that flatters the strategy — the
harness reports the unambiguous time-exit result plus `stopTouchedRate` and
`targetTouchedRate` as *bounds*. They can sum above 1. That is the measurement,
not an error.

**2. No costs.** Every figure is gross: no fee, no funding, no slippage. A crypto
perp round trip costs several basis points plus slippage, so an edge under ~0.1%
per trade is not distinguishable from noise at this resolution.

**3. Overlapping windows.** At stride < horizon, consecutive trades share bars.
The equity curve is then not one any account could have traded, and Sharpe,
Sortino and max drawdown are computed on dependent samples. `overlapping` is set
on every such result and **annualisation is refused** — scaling a per-trade
Sharpe by √(trades per year) on dependent samples inflates it by roughly
√(horizon/stride), which is the single most common way a backtest reports a
Sharpe of 4.

---

## Null, not zero

Every metric that can be undefined is `number | null`, and null means *"not
measurable from this sample"* — never *zero*. A slice where the engine never
predicted a class has no precision for it; printing `0.00` asserts a measurement
that was not made. CSV writes an empty field; Markdown writes a dash.

Undefined by design: precision with no predicted positives, recall with no actual
positives, MCC with a constant predictor or constant labels, profit factor with
no losses, payoff ratio with no losses, recovery factor with no drawdown,
correlation against a constant, `monotonic` with fewer than two eligible buckets.

---

## Reference values

Every formula is checked against a value derived independently of the
implementation — a published worked example, or arithmetic evaluated by hand in
the comment. No test asserts "whatever the code returns".

| metric | reference |
|---|---|
| confusion matrix | scikit-learn `confusion_matrix` docstring example |
| log loss | scikit-learn `log_loss` docstring example (0.21616…) |
| Brier score | scikit-learn `brier_score_loss` docstring example (0.0375) |
| multiclass MCC | Gorodkin's R_K; asserted to reduce to binary MCC at K = 2 |
| quantile | numpy / R type-7 (`percentile([1,2,3,4], 25) = 1.75`) |
| uninformative log loss | log 2 |
| ROC AUC | Mann–Whitney U with ties counted as half |
| Sortino downside deviation | Sortino & Price 1994 — divides by **N**, not by the count of negatives |

Property tests cover determinism, order invariance, bin-sum identities,
confusion totals, probability ranges, monotone-transform invariance of Spearman
and AUC, and the identity
`expectancy = winRate·avgWin + lossRate·avgLoss`.

---

## Choices with provenance

| choice | value | why |
|---|---|---|
| confidence buckets | 0–3 / 3–5 / 5–7 / 7–8.5 / 8.5–10 | the engine's own `gradeThresholds`. A break at one of these is a break in a distinction the product shows the user; inventing other boundaries would measure a partition nobody sees. |
| neutral dead-band | 1 ATR | half the engine's own modal stop distance (2 ATR) — the smallest move that could reach a 1:1 target |
| ADX regime split | 25 | Wilder's original threshold, and the engine's `adxWeakThreshold` |
| `minBucketCount` | 30 | below this a bucket's hit rate decides monotonicity on a coin flip |
| `minBinCount` (MCE) | 10 | without a floor, MCE is always the noisiest bin |
| log-loss `eps` | 1e-15 | scikit-learn's historical default; reported, because it caps the penalty for exactly the errors that matter most |
| proportion CI | logit-scale Wald, 95% | the plain interval leaves [0,1] and has poor coverage near the boundaries — exactly where an 85%-on-40-trades hit rate lands |

Two regime splits (volatility, ADX) cut at the **corpus median**, which uses the
whole sample to draw the boundary. That would be look-ahead if the boundary were
part of a trading rule. It is not: these are descriptive partitions answering
"where does it work", computed after the fact on data already recorded without
look-ahead. The distinction is stated in `slices.ts` because conflating the two
is how a "regime filter" ends up with a backtest it can never reproduce live.

---

## Selection effects are printed, not hidden

The "best" and "worst" sections rank slices by measured performance and report
the extremes. With S slices searched, the top slice is high partly because it is
better and partly because it was lucky, and the expected gap grows with S. The
report always prints how many slices were searched and the standard error of
each mean, and says in the body that the extremes are hypotheses to test out of
sample rather than findings.

---

## Reproducing the study

```
npx tsx src/harness/scripts/synthetic-study.ts <outputDir>
```

Writes per-regime `REPORT.md`, `metrics.json`, `metrics.csv`,
`calibration.csv`, `buckets.csv`, plus the raw observation corpus.
Deterministic: fixed seeds, no clock (`generatedAt` is a parameter).

See `docs/PHASE2-FINDINGS.md` for what it measured.
