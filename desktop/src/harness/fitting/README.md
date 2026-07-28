# `harness/fitting` — walk-forward model fitting and evaluation

Answers one question: **does the rebuilt signal layer predict anything?**

The answer, on the corpus measured, is no. See `docs/milestone3/REPORT.md`.

## Running it

```bash
# 1. Fetch the corpus (S&P 500 daily bars, 2013-2018, ~30 MB)
curl -o all_stocks_5yr.csv \
  https://raw.githubusercontent.com/plotly/datasets/master/all_stocks_5yr.csv

# 2. Extract raw features once (~2.5 min, ~130 MB cache)
npx tsx src/harness/fitting/extract-run.ts all_stocks_5yr.csv ./corpus-cache

# 3. Run the study (~4 min)
npx tsx src/harness/fitting/run.ts ./corpus-cache ./out
```

`--smoke` shrinks the grid for a fast end-to-end check. `--no-ablation` skips
the fifteen refits.

## Why it is split this way

Extraction costs ~0.5 ms per bar and everything downstream costs milliseconds,
so raw features are computed once and cached. **Scaling is deliberately NOT
cached**: the trailing window is a hyperparameter, and baking one choice into
the cache would make the hyperparameter search a lie.

| File | Does |
|---|---|
| `dataset.ts` | CSV → per-symbol `Series` plus the shared date axis |
| `corpus.ts` | One expensive pass: raw signal features, old-engine outputs, outcomes. Cached |
| `scaling.ts` | Causal per-symbol trailing scaling. Bit-identical to the live engine's scaler |
| `pipeline.ts` | Nested walk-forward: hyperparameter search inside train, fit, calibrate, predict |
| `evaluate.ts` | Per-date cross-sectional statistics, bootstrapped in blocks |
| `baselines.ts` | Comparators, scored on identical rows |
| `analysis.ts` | Coefficient stability, ablation, forward selection |
| `report.ts` | Markdown rendering |
| `run.ts` | Sequences the above |

## The three properties everything depends on

**1. The unit of independence is the DATE, not the row.**

Five hundred S&P constituents on one day share a market factor. Pooling them
and computing one correlation over 400,000 rows reports a standard error that
assumes 400,000 independent observations when there are closer to 1,200. Every
headline statistic is therefore computed cross-sectionally per date, and the
resulting daily series is bootstrapped in non-overlapping blocks of `horizon`
days (to absorb the autocorrelation that overlapping forward windows induce).

**2. Nothing is selected on the data it is scored against.**

Scaling window, ridge penalty, calibration method and feature subset are all
chosen on inner validation blocks lying strictly inside an outer train block.
`__tests__/pipeline.test.ts` asserts this empirically: corrupt every row after
date 400 and every prediction before 400 must be byte-identical.

**3. The pipeline can find an edge when one exists.**

Without this, a null result would be uninterpretable — "no edge exists" and
"this pipeline cannot detect edges" would produce identical output. The tests
plant a known signal in a synthetic corpus and require the pipeline to recover
it, attribute it to the right feature, and give that feature a stable sign
while leaving the noise features unstable.

## Two bugs this code caught in itself

Recorded because both produced *plausible* numbers rather than errors.

**The long/short spread read row ordering.** Slicing a sorted array positionally
to form quintiles is wrong under ties: with every score equal the sort is
stable, so the "top quintile" became whichever names arrived last. The constant
`always_long` baseline — which has no cross-sectional information at all — was
assigned a spread of −0.00081 with an interval *excluding zero*. Tails are now
assigned by value threshold, and the spread is undefined when they would
overlap. This is exactly what the constant baseline exists to catch.

**`atr_percentile` was not a percentile.** It ranked a Wilder-smoothed ATR%
against a distribution of *unsmoothed* per-bar true ranges — different
distributions, so the statistic was crushed toward its middle: standard
deviation 0.069 against the 0.289 a percentile should have, never reaching
within 0.29 of either bound. Fixed in `modules/signal/features.ts`.
