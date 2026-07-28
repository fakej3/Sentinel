# Sentinel Rebuild — Plan (Phases 1–8 evidence)

Governing constraint, from Phase 8: **on real daily equities the engine's inputs
carry no detectable predictive information** (best feature IC −0.038, 95% CI
[−0.121, +0.062]; engine −0.028 [−0.097, +0.049]; study powered to detect
|IC| ≥ 0.105).

The rebuild therefore fixes **statistical soundness**, not performance. A
component is replaced because it is *incapable of expressing uncertainty*, not
because a replacement is expected to make money. **No feature is added on the
expectation that it predicts.** Where the evidence is weak, the new code says so
in its output rather than in a comment.

---

## Step 1 — Removal plan (nothing deleted yet)

Ordered by strength of evidence. Nothing here is removed until its replacement
exists and is tested.

| # | component | evidence | action |
|---|---|---|---|
| R1 | `ms_bos_detected` as an evidence factor | Real: fires on **100.00%** of bars — constant, zero information. Synthetic IC 0.0087 (q = 0.165) | REMOVE from evidence/vote after replacement |
| R2 | `ms_breakout_confirmed` as an evidence factor | Real: fires on **0.00%** of bars — never | REMOVE from evidence/vote |
| R3 | `ms_choch_detected` as an evidence factor | Real: 98.13% — near-constant | REMOVE from evidence/vote |
| R4 | `ms_consolidating` as an evidence factor | Real: 0.01% | REMOVE from evidence/vote |
| R5 | Vote counting in `synthesizeFullTrend` (L125–139) | 5 conditions, pairwise ρ up to 0.719; counted as independent. Synthetic: fixing this is worth 0.045 IC | REPLACE with a weighted continuous score |
| R6 | Boolean thresholding of continuous inputs (L36–98) | Costs 0.0327 IC synthetic; the D1–D10 decile table shows information rises monotonically with magnitude | REPLACE with scaled continuous features |
| R7 | Winner-takes-all label assignment (L151–167) | Destroys disagreement: (5,3) and (5,0) map to one label | REPLACE with a probability + interval |
| R8 | 68 unfitted evidence weights | `provenance.ts`: zero backtested. Total ablation: 1,316/1,316 directions unchanged on real data | REPLACE with a fitted, calibrated model |
| R9 | `confidence.score` as a pseudo-probability | Negative Brier skill in all 20 synthetic cells; real AUC 0.4843 | REPLACE with a calibrated probability |
| R10 | `maturity` as a distinct signal | ρ = 0.942 with `confidence_directional` — a near-copy | REPLACE (fold into one score) |
| R11 | `macd_hist_atr` / `macd_sep_atr` duplication | ρ = **1.000** — exactly identical | REMOVE one |

**Not removed, and why:** the MACD ATR-scaled deadband (`full-trend.ts:67–69`)
is the only rule in the engine that lets a signal abstain. Its *information* is
nil, but its *pattern* is the one the new layer generalises.

---

## Step 2 — Keep (unchanged)

| component | why |
|---|---|
| `modules/indicators/` | Correct, tested (127 tests), continuous. The loss is downstream, not here |
| ATR + `atrSeries` causality contract | Load-bearing for every scale-free unit |
| Session-anchored VWAP | Correct; simply undefined at ≥ 1d by design |
| `modules/support-resistance/` | The only subsystem whose magnitudes survive to output; drives entry/stop/target geometry |
| `modules/market-structure/` swing detection | The *swings* are used by S/R and Fibonacci. Only the four event booleans are degenerate |
| Stop / target / RR geometry in `compute/trade-plan.ts` | Continuous, and the only place plan magnitudes are preserved |
| `modules/binance/`, `modules/market/` | Data loading, exchange-neutral types |
| **`src/harness/` + `src/harness/metrics/` + `src/harness/research/`** | The measurement apparatus that produced every finding above. Untouched |
| `modules/validation/` | Gatekeeper; inert on clean data but correct |
| `modules/writer/`, UI, API, CLI | Presentation; unaffected by the signal layer |

---

## Step 3 — Replacement architecture (interfaces only, no ML)

New subtree `src/modules/signal/`, built **beside** the existing engine. Nothing
in `modules/analysis` or `modules/pipeline` changes until Step 5 wiring, and the
old path keeps working throughout.

```
FeatureSpec[]  ──►  FeatureExtractor  ──►  RawFeatures (continuous, may be null)
                                              │
                                    CausalScaler (rolling z / rank)
                                              │
                                    ScaledFeatures  ─────┐
                                              │          │
                                    RegimeEstimator       │
                                              │          │
                                        RegimeState ──────┤
                                                          ▼
                                                    SignalModel
                                                          │
                                                     RawScore
                                                          │
                                                    Calibrator
                                                          ▼
                                          Prediction { probability, interval,
                                                       basis, regime, features }
```

**Requirements and how each is met:**

| requirement | mechanism |
|---|---|
| continuous features | `FeatureSpec.extract` returns `number \| null`; no thresholds anywhere in the layer |
| probability outputs | `Prediction.probability` is the only directional output; there is no label |
| feature importance | `Prediction.features` retains the scaled vector, so permutation importance runs on shipped output |
| calibration | `Calibrator` is a required stage. A raw score is never exposed as a probability |
| future ML | `SignalModel` is an interface; the shipped `LinearModel` is one implementation |
| regime detection | `RegimeEstimator` computes variance ratio, return autocorrelation and realised-vol ratio — the rate statistics Phase 6 showed the engine lacks entirely |
| multi-timeframe | `FeatureSpec.timeframe` tags each feature; `MultiTimeframeInput` carries aligned windows |
| real feature scaling | `CausalScaler` uses a trailing window only — no look-ahead, enforced by test |
| statistical confidence | `Prediction.interval` is a Wilson interval from the calibrator's bin support, not a vote count |

**Honesty requirements, enforced in types:**

- `Prediction.probability` is `number | null`. `null` when the model is
  uncalibrated or the regime is unrecognised — the engine must be able to say
  *"I don't know"*, which the current one structurally cannot.
- `Prediction.basis` records `n` behind the estimate. A probability without a
  sample size is not shipped.
- `Calibrator` refuses to extrapolate outside its fitted support.

---

## Step 4 — Migration map

| module | action | depends on | order |
|---|---|---|---|
| `modules/signal/types` | NEW | — | 1 |
| `modules/signal/scaling` | NEW | types | 2 |
| `modules/signal/regime` | NEW | types, indicators | 3 |
| `modules/signal/features` | NEW | types, scaling, indicators, market-structure, S/R | 4 |
| `modules/signal/model` | NEW | types | 5 |
| `modules/signal/calibration` | NEW | types | 6 |
| `modules/signal/index` | NEW | all above | 7 |
| `harness/snapshot` | EXTEND (additive) | signal | 8 |
| `modules/analysis/compute/full-trend` | KEEP until 10 | — | — |
| `modules/analysis/compute/evidence` | REWRITE (drop R1–R4, R11) | signal fitted | 9 |
| `modules/confidence/` | REPLACE (score ← calibrated probability) | signal, calibration | 10 |
| `modules/pipeline/compute/trade-plan` | REWRITE direction (probability-driven) | signal | 11 |
| `modules/analysis/compute/full-trend` | REMOVE vote/label after 11 | — | 12 |
| writer / UI / API | ADAPT to `Prediction` | 10, 11 | 13 |

Steps 1–7 add code and break nothing. The old engine keeps running until 10.

---

## Status

Step 5 in progress: subsystems 1–7. See commit log.
