# Signal Layer Rebuild — Development Changelog

This document records the major research and implementation phases of the
signal layer rebuild. It is developer-facing; product-release changes live in
[`desktop/docs/CHANGELOG.md`](desktop/docs/CHANGELOG.md).

---

## Milestone 3 — Walk-forward fitting and evaluation (2026-07-28)

**commit `632666e`**

Applied the continuous signal layer to 619,040 S&P 500 daily bars (2013–2018)
using a fully nested walk-forward study.

### Study design

- 8 outer folds, rolling, 252-bar train / 63-bar test / 20-bar embargo
- Hyperparameter grid: 3 scaling windows × 4 ridge penalties × 3 calibration
  methods = 36 combinations, selected on 2 inner validation folds per outer fold
- Primary metric: market-neutral rank IC (cross-sectional, block-bootstrapped)

### Finding

**No out-of-sample edge detected.** Market-neutral rank IC: −0.0062
[−0.0237, 0.0115]; Brier skill: −0.0235. Zero of 15 individual features
distinguished from noise. Forward selection stopped after one feature. Ten of
fifteen features improved the model when removed in ablation. Nine of fifteen
features flip sign across folds.

The null result is interpretable because the same pipeline recovers a planted
synthetic signal (seed 12, β = 1.5) with rank IC > 0.1 and CI strictly above
zero.

### Infrastructure delivered

- `harness/fitting/dataset.ts` — CSV → per-symbol `Series` with strict
  validation; no interpolation, no fabricated order-flow
- `harness/fitting/corpus.ts` — feature extraction in one causal pass;
  columnar `Float64Array` storage; versioned cache
- `harness/fitting/scaling.ts` — ring-buffer corpus scaler, bit-identical to
  `modules/signal/scaling.RollingScaler` (verified by 9 tests)
- `harness/fitting/pipeline.ts` — nested walk-forward; embargo enforcement
  (throws, not advisory); three-block train/calibration/test split; fixed-hyper
  mode for ablation
- `harness/fitting/evaluate.ts` — cross-sectional per-date statistics;
  block-bootstrapped CI; long/short spread by value threshold (bug fixed:
  positional slicing manufactured signal from row order)
- `harness/fitting/baselines.ts` — all comparators scored on identical rows
- `harness/fitting/analysis.ts` — coefficient stability, ablation (15 full
  refits), forward selection on inner-only blocks; shared NaN-column cache
  (bug fixed: per-call allocation made forward selection intractable)
- `harness/fitting/report.ts`, `run.ts`, `extract-run.ts` — study driver with
  `--smoke` / `--no-ablation` flags
- 16 new pipeline tests; 23 new evaluate tests

### Bugs caught and fixed

- Long/short quintile spread computed by positional slicing under ties: `always_long`
  (constant score) reported spread −0.00081 with CI excluding zero. Fixed to value-threshold
  assignment; spread is undefined when thresholds coincide.
- `maskWindows` allocated a fresh 4 MB NaN array per excluded feature per
  forward-selection call (~120 calls × 15 features). Fixed with a shared cached
  column per length.

---

## Milestone 2 — Continuous feature engine and signal pipeline (2026-07-28)

**commits `1bea197`, `5900837`, `6b77cb3`, `6e52ebe`**

### `modules/signal/features.ts` — Fifteen continuous features

All ATR-normalised or ratio-based; no boolean anywhere in the feature layer.

| Feature | Family | Scaling |
|---|---|---|
| `ema_distance` | trend | rank |
| `ema_slope` | trend | rank |
| `ema_separation` | trend | rank |
| `rsi_normalized` | oscillator | none |
| `macd_histogram_normalized` | momentum | rank |
| `adx_normalized` | trend | none |
| `atr_percentile` | volatility | none |
| `bollinger_position` | volatility | none |
| `bollinger_width` | volatility | rank |
| `sr_distance` | structure | rank |
| `swing_strength` | structure | none |
| `volume_anomaly` | participation | rank |
| `volatility_regime` | regime | none |
| `trend_persistence` | regime | none |
| `market_efficiency_ratio` | regime | none |

**Bug fixed:** `atr_percentile` ranked the Wilder-smoothed ATR% against a
distribution of unsmoothed per-bar true ranges — different distributions. SD
was 0.069 against the 0.289 expected of a percentile; the feature could never
approach its own bounds. Fixed to use `atrSeries()` on both sides (like vs
like). Four regression tests added.

**Bug fixed:** Six features that read only `ctx.indicators` (never candles)
returned stale indicator values on an empty window. Fixed by early-return guard
in `extractFeatures`.

### `modules/signal/model.ts` — Ridge logistic regression via IRLS

- Cholesky factorisation with covariance sandwich estimator
- Imputes missing features to standardised 0 (= training mean) with Var(η)
  widened proportionally
- Abstains when observed information < MIN_OBSERVED_INFORMATION
- `LinearSignalModel.predict()` returns full traced output; the engine calls it
  once and reads `linearPredictor` from the result

### `modules/signal/calibration.ts` — Isotonic and Platt calibrators

- Both refuse outside fitted support (never extrapolate)
- `fitIsotonic`: PAVA with pooled exact ties; between-block interpolation disabled
- `fitPlatt`: Newton + Levenberg backtracking; Lin–Lin–Weng target smoothing

**Bug fixed:** `fitPlatt` with all-equal scores produced 10 bins with identical
lower bounds; `binAtOrBelow` always landed on bin 0. Fixed: when `width <= 0`,
emit one bin covering the full range.

### `modules/signal/scaling.ts` — Causal trailing scaler

- `MIN_SCALING_WINDOW = 30` (derived: SE of sample SD = 13% at n = 30)
- `RollingScaler`: immutable array rebuilt on every push (correct for live use)
- `pushValue` does not append null or non-finite values (preserves effective window)

### `modules/signal/index.ts` — Assembly

- `SignalEngine.observe` enforces strictly chronological input
- Calibration refusal distinguishes `outside-calibration-support` (model saw
  an unusual score) from `insufficient-support` (score is ordinary but sparse)
- `DEFAULT_SCALING_WINDOW = 252` (industry convention, labelled as such)

### `modules/signal/regime.ts` — Regime statistics

- Variance ratio (Lo–MacKinlay), lag-1 return autocorrelation, volatility ratio
- `MIN_REGIME_BARS = 120`

---

## Milestone 1 — Signal layer foundation (commit `9024ea2`)

Core types and contracts:

- `FeatureValidity` — `ok | insufficient-history | degenerate-input |
  not-applicable | undefined-at-timeframe`
- `FeatureValue` — value + confidence + validity + explanation; never a raw null
- `available()` / `unavailable()` constructors
- `RawFeatures`, `ScaledFeatures`, `RegimeState`, `RawScore`, `SignalModel`,
  `Calibrator`, `Prediction` — types that make "a probability is never a raw
  score" enforceable by the type system

---

## Phase 4 — Quantitative validation instruments (commit `6504fed`)

Research infrastructure in `harness/research/`:

- `inference.ts` — block bootstrap, Mann–Whitney U, Neumaier compensated sums
- `correlation.ts` — Pearson, Spearman, partial correlation
- `regression.ts` — OLS, ridge, coefficient intervals
- `information.ts` — mutual information estimator
- Walk-forward splits with embargo enforcement (`harness/splits.ts`)
- Probability metrics: Brier score, Brier skill, ECE/MCE, ROC-AUC, log-loss
- Ablation framework for measuring individual feature contributions
- Null calibration test: GBM corpus → no feature should show edge

**Finding:** The existing engine's confidence score has negative Brier skill in
all 20 evaluation cells. Its `direction` and `confidence` channels are
independent (direction carries no information beyond EMA crossover). Booleanising
continuous inputs costs ~34% of available information on synthetic data.

---

## Phase 1–3 — Harness foundation

- `harness/engine.ts` — deterministic runner; `analyseWindow` + `computeOutcomes`
  on disjoint windows
- `harness/metrics/` — probability, IC, rank IC, AUC, Brier metrics
- `harness/sources.ts` — synthetic GBM, JSON file, in-memory sources
- `harness/validate.ts` — series well-formedness (enforced at parse and at run)
- `harness/snapshot.ts` — ticker reconstruction from trailing window (no
  look-ahead)
- No-look-ahead test: replaces every candle after bar `i` with random data;
  all features at bar `i` must be byte-identical

---

## Invariants maintained throughout

- Determinism: same input → same output to the bit
- No look-ahead: trailing windows only; embargo >= max(horizon)
- No authored weights: all model coefficients fitted from outcomes
- No thresholds in the feature layer: everything stays continuous
- No silent defaults: unavailable = null, never zero-filled
- All constants documented: mathematically derived, industry convention, or
  empirically measured

---

*Study output: `desktop/docs/milestone3/REPORT.md`*
