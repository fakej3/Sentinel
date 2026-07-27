# Phase 2 — what the metrics measured

Reproduce with:

```
npx tsx src/harness/scripts/synthetic-study.ts <outputDir>
```

Deterministic: fixed seeds, no clock. Every number below comes from that run.

---

## Scope — read this first

**There is no real market data in this environment.** The network policy answers
403 to CONNECT for every exchange host tried — `api.binance.com`,
`data-api.binance.vision`, `api.coingecko.com`, `api.kraken.com`. The proxy's own
status endpoint lists the rejections.

So nothing here measures Sentinel's edge on real markets. What it measures is
the engine's behaviour under **generating processes whose correct answer is
known**, which answers three questions real data would answer worse:

| | question |
|---|---|
| **NULL** | On a martingale there is nothing to find. Does every metric say so? |
| **DETECTION** | On a path that trends by construction, direction *is* predictable. Can the engine beat the unconditional base rate where the answer exists and is simple? |
| **REGIME** | Trend and mean-reverting range are the two regimes the engine claims to distinguish. Where does it work, and where does it lose? |

A failure under a known process is a real failure — it does not need real data to
be believed. A *success* under a known process would not transfer, and none is
claimed below.

### Corpus

5 regimes × 3 timeframes (15m, 1h, 4h) × 12 independently seeded paths, 1,200
bars each. **3,780 observations**, at stride 48 = the longest horizon, so
**forward windows do not overlap** and every standard error quoted is honest.

Regimes: `walk` (driftless GBM), `up` / `down` (GBM drifting 3σ over 400 bars),
`range` (Ornstein–Uhlenbeck in log price, deviation half-life 24 bars), `switch`
(up-trend → range → down-trend). Generator properties — actual drift, negative
lag-1 autocorrelation in the range, boundedness — are asserted in
`__tests__/regimes.test.ts`, because a "range" that did not mean-revert would
make every conclusion about it meaningless.

All figures are **gross** (no fees, funding or slippage) and trades exit at the
horizon, not at a bracket.

---

## 1. The null holds

On the driftless random walk, across all four horizons:

| horizon | directional hit rate | best trivial strategy | gap | McNemar z |
|---|---|---|---|---|
| 4 | 53.4% | 53.0% | +0.3pp | 0.12 |
| 12 | 48.6% | 52.1% | −3.5pp | −1.27 |
| 24 | 51.6% | 51.6% | 0.0pp | 0.00 |
| 48 | 53.3% | 50.6% | +2.7pp | 0.94 |

Spearman(confidence, correct) ranges −0.074 to +0.035, all |z| < 1.8.

**The framework does not manufacture edge.** Every result below is measured on
the same code path.

---

## 2. In a trend, Sentinel is *worse* than the unconditional direction

This is the central negative result, and it is not close.

`up` regime, benchmarks computed on the identical directional subsample:

| horizon | n | Sentinel | always-long | gap | McNemar z |
|---|---|---|---|---|---|
| 4 | 677 | 61.6% | 62.2% | −0.6pp | −0.55 |
| 12 | 677 | 65.3% | 68.5% | −3.2pp | **−3.05** |
| 24 | 677 | 72.4% | 78.0% | −5.6pp | **−5.27** |
| 48 | 646 | 79.1% | 86.1% | −7.0pp | **−6.30** |

`down` regime, against always-short: −1.9pp (z = −2.03), −2.1pp (z = −2.34),
−3.9pp (z = −4.11) at 12, 24, 48 bars.

A 79% hit rate looks excellent until you notice the market went up 86% of the
time. **Sentinel's conditional call is less accurate than the marginal**, and the
gap widens with horizon. Its counter-trend calls in a trend cost more than its
with-trend calls gain.

The one place this reverses is the `switch` regime, where no fixed direction
works:

| horizon | n | Sentinel | best trivial | gap | McNemar z |
|---|---|---|---|---|---|
| 12 | 654 | 58.0% | 50.5% | **+7.5pp** | 2.74 |
| 24 | 654 | 61.8% | 54.6% | **+7.2pp** | 2.63 |
| 48 | 619 | 62.4% | 57.7% | +4.7pp | 1.63 |

This is the study's only positive finding, and it should be held loosely: 20
regime × horizon cells were examined, and a Bonferroni threshold for 20 tests at
α = 0.05 sits at z ≈ 2.81 — above the largest of these. The three horizons are
also nested windows on the same observations, so they are not three pieces of
evidence. Read it as: **adaptivity appears to pay when the trend reverses**, at
roughly 2σ, worth testing out of sample.

---

## 3. In a mean-reverting range, Sentinel loses money systematically

| horizon | trades | expectancy R | sd R | t | win rate | profit factor |
|---|---|---|---|---|---|---|
| 4 | 603 | −0.071 | 0.615 | **−2.85** | 44.1% | 0.73 |
| 12 | 603 | −0.230 | 1.009 | **−5.59** | 38.3% | 0.54 |
| 24 | 603 | −0.383 | 1.281 | **−7.33** | 36.0% | 0.44 |
| 48 | 576 | −0.587 | 1.636 | **−8.61** | 33.3% | 0.36 |

Non-overlapping trades, so those t-statistics are not inflated by dependence.
The loss deepens monotonically with holding period.

**This is not an artefact of the trade construction.** The same trades, same
stops, same time exit, with the direction fixed:

| strategy | expectancy R, h = 24 |
|---|---|
| Sentinel | **−0.383** |
| always long | −0.002 |
| always short | +0.002 |

The market is a fair coin by construction. Fixing the direction breaks even. It
is **the direction selection specifically** that loses the money.

The mechanism is not mysterious: this is a momentum engine, and in mean reversion
the strongest momentum evidence occurs at the extremes — precisely where price is
about to revert.

---

## 4. The engine cannot detect the regime it loses in

| regime | labelled `ranging` | mean ADX | abstains |
|---|---|---|---|
| `walk` (random walk) | 17.5% | 26.1 | 17.5% |
| `range` (mean-reverting) | **20.2%** | 23.5 | 20.2% |
| `up` | 10.4% | 32.6 | 10.4% |
| `down` | 7.7% | 30.8 | 7.7% |
| `switch` | 13.5% | 27.7 | 13.5% |

A genuinely mean-reverting market is labelled `ranging` 20.2% of the time,
against 17.5% for a pure random walk. **That 2.7-point separation is the whole
of the engine's range detection.** Mean ADX differs by 2.6 points.

And the abstain decision is a *pure function* of that one label — in all five
regimes, bars labelled `ranging` take a direction 0.0% of the time and every
other bar takes one 100.0% of the time. There is no second gate. So the engine
enters directional trades on ~80% of the bars of a market that is structurally
hostile to directional trades.

---

## 5. Confidence is not a probability, and in a range it is actively inverted

### It never means what the number says

Observed hit rate in the top calibration bin (mapped probability ≈ 0.96), by
regime, h = 24:

| regime | mapped | observed | n |
|---|---|---|---|
| `walk` | 0.96 | 0.47 | 242 |
| `up` | 0.97 | 0.75 | 364 |
| `down` | 0.96 | 0.77 | 406 |
| `range` | 0.96 | **0.23** | 160 |
| `switch` | 0.96 | 0.66 | 312 |

**"96% confidence" delivers between 23% and 77%, and never 96%.**

Brier skill score is **negative in all 20 regime × horizon cells** (−0.97 to
−0.00). Read as a probability, the confidence score is worse than forecasting
the base rate — everywhere, without exception. ECE ranges 0.11 to 0.42.

**Answering the three questions directly:**

- *Does 80% confidence mean ~80% success?* No. Nowhere, in any regime, at any
  horizon.
- *Does 60% outperform 50%?* Not reliably. Monotonicity across the engine's own
  grade buckets fails in **17 of 20** cells.
- *Does confidence increase monotonically with accuracy?* No — and in the range
  regime it decreases monotonically.

### In a range it identifies the worst trades

`range` regime, h = 24, by the engine's own grade buckets:

| bucket | n | hit rate | expectancy R |
|---|---|---|---|
| weak | 14 | 42.9% | −0.043 |
| mixed | 62 | 41.9% | −0.178 |
| moderate | 222 | 41.0% | −0.203 |
| strong | 103 | 40.8% | −0.332 |
| **very_strong** | **202** | **25.7%** | **−0.692** |

Perfectly monotone in the wrong direction. A `very_strong` trade in a range loses
**16× more per trade** than a `weak` one. Spearman(score, correct) = −0.153
(z = −3.77).

This is the worst possible combination: the engine is most confident exactly
where it is most wrong, and it says so to the user in the strongest language it
has.

### Where it does rank, it ranks weakly

Spearman(score, correct) is positive and significant only at the longest
horizons in strong trends: `up` h=48 gives 0.172 (z = 4.38), `down` h=48 gives
0.130 (z = 3.35). ROC AUC 0.622 and 0.601. Real, but small.

---

## 6. Structural facts about the engine (data-independent)

Across all 3,780 observations:

| | |
|---|---|
| `stop_distance_atr` exactly 2.00 | **57.1%** of plans |
| `rr` median | exactly 2.00 |
| grade = `very_strong` | **45.1%** of all bars |
| confidence score median / p75 | 7.70 / 9.60 |
| direction long / short / none | 42.9% / 43.3% / 13.9% |
| setup marked actionable | 61.3% |
| `evidence_count` p05–p95 | 14–20 |

Two of these matter:

**The stop is a fixed fallback more than half the time.** A 2.00-ATR stop in 57%
of plans is not structure-derived; it is a default. Every R multiple in this
report is therefore, more often than not, measured against a constant rather than
against a level the engine chose.

**The confidence score is saturated.** 45% of all bars are graded `very_strong`,
and the median score is 7.70 on a 0–10 scale. A score whose modal value is its
top grade has little room left to discriminate — which is consistent with the
near-zero Spearman correlations above. The engine is nearly always very
confident.

**Evidence count barely varies** (p05 14, p95 20). Whatever the market is doing,
roughly the same number of evidence items fires.

---

## 7. Three-way classification

Balanced accuracy against a ±1 ATR dead-band label, h = 24:

| regime | balanced accuracy | MCC | neutral recall |
|---|---|---|---|
| `walk` | 0.328 | −0.008 | 0.167 |
| `up` | 0.303 | −0.065 | 0.078 |
| `down` | 0.348 | 0.013 | 0.061 |
| `range` | 0.244 | **−0.113** | 0.214 |
| `switch` | 0.419 | **0.133** | 0.144 |

Chance is 0.333. Only `switch` is meaningfully above it. `range` is below chance
with a negative MCC — the three-way call there is worse than guessing.

Neutral recall is low everywhere (6–21%): when the right answer was "no move
worth trading", the engine said so at most a fifth of the time.

---

## 8. Timeframe makes no difference

Expectancy R at h = 24:

| regime | 15m | 1h | 4h |
|---|---|---|---|
| `up` | 1.212 | 1.034 | 1.417 |
| `range` | −0.268 | −0.450 | −0.431 |
| `switch` | 0.467 | 0.357 | 0.452 |

No timeframe effect beyond noise. Expected: every feature is scale-free and the
synthetic σ scales as √time, so there is nothing for the engine to respond to
differently. This is a **null result about the study design**, not evidence that
real timeframes behave alike.

---

## What this does and does not establish

**Established, and not contingent on real data:**

1. The evaluation framework reports no edge where there is none.
2. Sentinel's directional call is less accurate than the unconditional direction
   in a sustained trend, by up to 7 points, at z = −6.3.
3. Sentinel loses money systematically in a mean-reverting range — −0.587 R at
   48 bars, t = −8.6 — while a fixed direction on the same trades breaks even.
4. It cannot distinguish a mean-reverting range from a random walk (20.2% vs
   17.5% `ranging` labels).
5. The confidence score, read as a probability, has negative Brier skill in
   every one of 20 cells, and in a range it ranks trades in reverse.
6. The abstain decision is a pure function of one label, with no second gate.
7. The stop is a fixed 2-ATR fallback in 57% of plans; the score is graded
   `very_strong` on 45% of all bars.

**Not established:**

- Anything about real markets. Real price series have fat tails, volatility
  clustering, microstructure and non-stationary regime mixtures that none of
  these five processes reproduce.
- Whether the `switch`-regime advantage (+7pp, z ≈ 2.7 before multiplicity
  correction) is real. It is the study's one positive result and the one most
  exposed to selection.
- Whether costs would erase what edge exists. Every figure is gross.

**Insufficient evidence to justify architectural change.** Findings 2–7 are
about calibration, regime detection and gating, all of which are measurable
properties of the current engine — not evidence that the architecture is wrong.
Phase 3 (feature importance) and Phase 4 (calibration) address 5 and 7 directly.
The correct next measurement is on real data, which this environment cannot
reach; the file source in `sources.ts` accepts it without any change to the
runner.
