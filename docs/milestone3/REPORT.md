# Milestone 3 — Model Fitting and Out-of-Sample Evaluation

Whether the rebuilt signal layer has any predictive power on real market data.
Every number below is out of sample. Nothing was selected on the data it is scored against.

## 1. Setup

| | |
|---|---|
| Corpus | S&P 500 daily bars, 505 symbols, 1259 trading dates |
| Decision rows | 518,381 |
| Lookback per decision | 200 bars |
| Horizon | 5 trading days |
| Label | forward return > 0 |
| Walk-forward | rolling, train 252 dates, test 63 dates |
| Embargo | 20 dates (= max horizon; derived, not chosen) |
| Outer folds | 8 |
| Inner folds per outer fold | 2 (test blocks of 50 dates) |
| Out-of-sample predictions | 249,573 |
| Hyperparameter grid | windows [63, 126, 252], ridges [0.1, 1, 10, 100], calibration [isotonic, platt, none] |

**Unit of independence is the DATE, not the row.** Five hundred S&P constituents on one
day share a market factor, so every headline statistic is computed cross-sectionally per
date and the resulting daily series is bootstrapped in non-overlapping blocks of
5 days (the horizon, to absorb the autocorrelation that overlapping forward
windows induce). Treating rows as independent would shrink every interval below by
roughly the square root of the average symbols-per-day.

## 2. Does the fitted model have an edge?

Two questions, and they are different. **Raw** asks whether the model predicts returns;
on a single-market corpus that is dominated by whether the market went up. **Market-neutral**
removes each date's cross-sectional mean return and asks the question the model can actually
be judged on: did it rank *these* stocks correctly against each other?

| Metric | Raw returns | Market-neutral | Interval excludes zero? |
|---|---|---|---|
| IC (Pearson) | -0.0042 [-0.0193, 0.0107] | -0.0042 [-0.0189, 0.0114] | no |
| Rank IC (Spearman) | -0.0062 [-0.0237, 0.0102] | -0.0062 [-0.0237, 0.0115] | no |
| AUC | 0.4956 [0.4866, 0.5043] | 0.4973 [0.4888, 0.5058] | — |
| Long/short quintile spread | -0.00036 [-0.00179, 0.00105] | -0.00036 [-0.00195, 0.00115] | no |

AUC has no zero-column because its null value is 0.5, not 0. Compare its interval against 0.5.

### Probability quality

| | |
|---|---|
| Brier score | 0.25329 |
| Brier skill vs base rate | -0.02352 |
| Log loss | 0.70003 |
| Expected calibration error | 0.05589 |
| Maximum calibration error | 0.34113 |
| Coverage | 100.0% of 249,573 rows |

Brier skill is the load-bearing one: it is `1 - BS / BS_baserate`, so **positive means the
model beats simply forecasting the base rate, and zero or negative means it does not**,
however small the raw Brier looks.

### Classification at p > 0.5

| | |
|---|---|
| Accuracy | 52.07% |
| Base rate | 55.02% |
| Precision | 55.59% |
| Recall | 64.10% |
| F1 | 0.5954 |
| Predicted-positive rate | 63.45% |

Accuracy must be read against the base rate, never alone. In a rising market a constant
"long" forecast scores the base rate by definition.

### Reliability curve

| Forecast bin | n | Mean forecast | Observed frequency | Gap |
|---|---|---|---|---|
| [0.2, 0.3) | 218 | 0.2873 | 0.6284 | 0.3411 |
| [0.3, 0.4) | 12180 | 0.3683 | 0.5255 | 0.1571 |
| [0.4, 0.5) | 78780 | 0.4575 | 0.5427 | 0.0852 |
| [0.5, 0.6) | 120525 | 0.5419 | 0.5586 | 0.0167 |
| [0.6, 0.7) | 37215 | 0.6316 | 0.5486 | -0.0830 |
| [0.7, 0.8) | 555 | 0.7227 | 0.4667 | -0.2560 |
| [0.8, 0.9) | 1 | 0.8014 | 1.0000 | 0.1986 |

## 3. Comparison against every baseline

All comparators are scored on the **identical** out-of-sample rows, so differences are
attributable to method rather than to coverage or era. Market-neutral returns.

| Comparator | IC | Rank IC | AUC | L/S spread | Days |
|---|---|---|---|---|---|
| fitted_model | -0.0042 [-0.0189, 0.0114] | -0.0062 [-0.0237, 0.0115] | 0.4973 [0.4888, 0.5058] | -0.00036 [-0.00195, 0.00115] | 504 |
| sentinel_engine | -0.0130 [-0.0375, 0.0128] | -0.0152 [-0.0428, 0.0130] | 0.4935 [0.4795, 0.5071] | -0.00105 [-0.00363, 0.00131] | 504 |
| sentinel_direction | -0.0152 [-0.0379, 0.0081] | -0.0168 [-0.0415, 0.0092] | 0.4935 [0.4823, 0.5045] | -0.00118 [-0.00309, 0.00066] | 504 |
| random | -0.0011 [-0.0052, 0.0030] | -0.0017 [-0.0056, 0.0020] | 0.4994 [0.4972, 0.5016] | -0.00011 [-0.00054, 0.00035] | 504 |
| always_long | — | — | 0.5000 [0.5000, 0.5000] | — | 504 |
| ema_cross | -0.0026 [-0.0249, 0.0205] | -0.0047 [-0.0286, 0.0199] | 0.4991 [0.4890, 0.5088] | 0.00011 [-0.00156, 0.00176] | 504 |
| ema_cross_continuous | -0.0148 [-0.0430, 0.0148] | -0.0128 [-0.0407, 0.0154] | 0.4945 [0.4800, 0.5086] | -0.00051 [-0.00332, 0.00217] | 504 |

### Individual feature baselines

Each of the fifteen features used alone as a score, on the same rows.

| Feature | IC | Rank IC | AUC | L/S spread | Days |
|---|---|---|---|---|---|
| adx_normalized | -0.0198 [-0.0411, 0.0007] | -0.0215 [-0.0466, 0.0031] | 0.4904 [0.4775, 0.5031] | -0.00166 [-0.00393, 0.00046] | 504 |
| ema_slope | -0.0141 [-0.0366, 0.0069] | -0.0168 [-0.0412, 0.0076] | 0.4918 [0.4784, 0.5048] | -0.00092 [-0.00314, 0.00131] | 504 |
| rsi_normalized | -0.0161 [-0.0387, 0.0061] | -0.0163 [-0.0425, 0.0094] | 0.4930 [0.4802, 0.5058] | -0.00156 [-0.00398, 0.00069] | 504 |
| bollinger_position | -0.0156 [-0.0360, 0.0039] | -0.0157 [-0.0390, 0.0058] | 0.4928 [0.4811, 0.5041] | -0.00191 [-0.00395, -0.00007] | 504 |
| market_efficiency_ratio | -0.0072 [-0.0198, 0.0045] | -0.0112 [-0.0247, 0.0018] | 0.4940 [0.4870, 0.5010] | -0.00084 [-0.00203, 0.00038] | 504 |
| ema_separation | -0.0041 [-0.0262, 0.0186] | -0.0097 [-0.0353, 0.0165] | 0.4949 [0.4812, 0.5085] | -0.00038 [-0.00260, 0.00191] | 504 |
| bollinger_width | -0.0064 [-0.0207, 0.0078] | -0.0095 [-0.0250, 0.0062] | 0.4944 [0.4873, 0.5021] | -0.00058 [-0.00204, 0.00076] | 504 |
| macd_histogram_normalized | -0.0103 [-0.0316, 0.0109] | -0.0079 [-0.0309, 0.0143] | 0.4967 [0.4846, 0.5086] | -0.00073 [-0.00274, 0.00120] | 504 |
| volatility_regime | -0.0081 [-0.0230, 0.0068] | -0.0067 [-0.0238, 0.0112] | 0.4979 [0.4894, 0.5065] | -0.00112 [-0.00290, 0.00055] | 504 |
| swing_strength | -0.0045 [-0.0245, 0.0170] | -0.0059 [-0.0282, 0.0175] | 0.4972 [0.4866, 0.5084] | -0.00062 [-0.00259, 0.00123] | 504 |
| volume_anomaly | -0.0037 [-0.0132, 0.0056] | -0.0048 [-0.0141, 0.0049] | 0.4975 [0.4924, 0.5025] | -0.00024 [-0.00114, 0.00067] | 504 |
| atr_percentile | 0.0021 [-0.0160, 0.0199] | 0.0039 [-0.0162, 0.0249] | 0.5021 [0.4921, 0.5122] | 0.00020 [-0.00169, 0.00200] | 504 |
| ema_distance | 0.0010 [-0.0227, 0.0259] | -0.0011 [-0.0293, 0.0280] | 0.4998 [0.4859, 0.5137] | 0.00075 [-0.00173, 0.00328] | 504 |
| trend_persistence | -0.0028 [-0.0131, 0.0080] | -0.0005 [-0.0113, 0.0107] | 0.5007 [0.4947, 0.5067] | -0.00019 [-0.00127, 0.00090] | 504 |
| sr_distance | 0.0005 [-0.0143, 0.0159] | 0.0003 [-0.0149, 0.0151] | 0.4969 [0.4888, 0.5050] | -0.00071 [-0.00227, 0.00083] | 504 |

Sorted by |rank IC| descending. An interval containing zero means the feature is
indistinguishable from noise on this corpus at this horizon.

**0 of 15 individual features have a rank-IC interval excluding zero.**

## 4. Hyperparameter selection, per fold

Selected inside each train block on inner validation. No fold ever saw its own test data.

| Fold | Train dates | Test dates | Window | Ridge | Calibration | Inner Brier | Train rows | Calib rows | Test rows |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 451–703 | 723–786 | 126 | 1 | platt | 0.24981 | 81,992 | 30,770 | 30,805 |
| 1 | 514–766 | 786–849 | 126 | 100 | none | 0.25133 | 82,266 | 0 | 30,950 |
| 2 | 577–829 | 849–912 | 63 | 100 | none | 0.25446 | 82,504 | 0 | 31,081 |
| 3 | 640–892 | 912–975 | 126 | 100 | platt | 0.27335 | 82,625 | 31,026 | 31,230 |
| 4 | 703–955 | 975–1038 | 252 | 100 | isotonic | 0.26167 | 82,851 | 31,205 | 31,291 |
| 5 | 766–1018 | 1038–1101 | 63 | 100 | none | 0.26847 | 83,201 | 0 | 31,357 |
| 6 | 829–1081 | 1101–1164 | 63 | 100 | none | 0.25021 | 83,562 | 0 | 31,377 |
| 7 | 892–1144 | 1164–1227 | 63 | 0.1 | platt | 0.24952 | 83,853 | 31,374 | 31,482 |

**Calibration method chosen:** platt 3x, none 4x, isotonic 1x.
`none` winning means the model's own logistic output calibrated better out of sample than
either isotonic or Platt could — which is a real result, not a failure to calibrate.

## 5. Fitted coefficients and stability

Coefficients are in **standardised space**: log-odds per trailing standard deviation of the
feature. Positive means bullish, without exception, because the feature layer enforces that
sign convention at extraction.

| Feature | Mean coefficient | SD | 95% CI (across folds) | Sign agreement | Flips? | Mean importance | Folds dropped |
|---|---|---|---|---|---|---|---|
| atr_percentile | 0.2289 | 0.1013 | [0.1587, 0.2990] | 100% | no | 32.7% | 0 |
| ema_distance | 0.0029 | 0.1603 | [-0.1082, 0.1140] | 50% | **yes** | 13.3% | 0 |
| bollinger_position | -0.1091 | 0.0641 | [-0.1535, -0.0647] | 100% | no | 13.1% | 0 |
| rsi_normalized | 0.1263 | 0.0626 | [0.0830, 0.1697] | 100% | no | 11.7% | 0 |
| macd_histogram_normalized | -0.0743 | 0.0767 | [-0.1274, -0.0212] | 75% | **yes** | 8.3% | 0 |
| volatility_regime | -0.0695 | 0.1057 | [-0.1427, 0.0038] | 63% | **yes** | 7.2% | 0 |
| ema_separation | -0.0315 | 0.0861 | [-0.0911, 0.0282] | 63% | **yes** | 3.7% | 0 |
| bollinger_width | 0.0033 | 0.0632 | [-0.0405, 0.0471] | 75% | **yes** | 2.2% | 0 |
| ema_slope | 0.0478 | 0.0580 | [0.0075, 0.0880] | 63% | **yes** | 2.0% | 0 |
| volume_anomaly | -0.0029 | 0.0521 | [-0.0390, 0.0333] | 63% | **yes** | 1.4% | 0 |
| adx_normalized | -0.0321 | 0.0116 | [-0.0402, -0.0241] | 100% | no | 1.2% | 0 |
| sr_distance | -0.0282 | 0.0152 | [-0.0387, -0.0176] | 100% | no | 1.2% | 0 |
| swing_strength | -0.0274 | 0.0202 | [-0.0414, -0.0134] | 100% | no | 1.0% | 0 |
| market_efficiency_ratio | -0.0045 | 0.0229 | [-0.0203, 0.0114] | 63% | **yes** | 0.5% | 0 |
| trend_persistence | 0.0019 | 0.0266 | [-0.0165, 0.0203] | 50% | **yes** | 0.4% | 0 |

**9 of 15 features change sign across folds.**

A coefficient that is positive in one fold and negative in the next has not been measured
as bidirectional — it has been measured as noise. Both estimates are consistent with a true
coefficient of zero, and the magnitude in any single fold is describing that train block
rather than the market.

- `ema_distance`: -0.097, -0.187, -0.181, 0.025, 0.237, 0.194, 0.079, -0.046
- `ema_slope`: 0.045, 0.037, 0.080, 0.167, 0.064, -0.008, -0.000, -0.002
- `ema_separation`: -0.026, 0.052, 0.035, -0.125, -0.181, -0.029, -0.042, 0.064
- `macd_histogram_normalized`: -0.194, -0.155, -0.096, -0.084, -0.009, 0.018, 0.008, -0.082
- `bollinger_width`: -0.064, 0.089, 0.023, 0.008, -0.107, 0.001, 0.061, 0.014
- `volume_anomaly`: 0.052, 0.045, 0.049, -0.058, -0.062, -0.067, 0.015, 0.003
- `volatility_regime`: -0.048, -0.213, -0.154, -0.205, 0.048, 0.009, 0.025, -0.017
- `trend_persistence`: -0.038, -0.028, -0.008, 0.003, 0.037, 0.029, 0.021, -0.002
- `market_efficiency_ratio`: 0.008, -0.043, 0.003, -0.011, -0.002, -0.013, -0.015, 0.037

The across-fold interval **understates** the true width: under a rolling scheme consecutive
folds share most of their training data, so the fold estimates are not independent draws.
It is a stability diagnostic, not inference.

## 6. Forward selection

Greedy, starting from nothing, adding whichever remaining feature most improves the
**inner-validation** Brier score. Every block scored lies strictly inside an outer train
block, so no candidate was ever ranked against data the headline evaluation uses.

Hyperparameters held fixed at window 63, ridge 100, calibration none — the main run's modal selection — so the comparison
isolates which features help.

| Step | Added | Inner Brier | Improvement |
|---|---|---|---|
| 1 | sr_distance | 0.25364 | — |

Stopped at step 2: no remaining feature improved the score.
Selected 1 of 15 features: `sr_distance`.

Improvement is the change in Brier, so **negative is better**. A first step with a large
improvement and subsequent steps near zero means one feature carries whatever signal
exists and the rest are redundant with it.

## 7. Ablation

Each row refits the **entire** walk-forward with that feature removed. Re-scoring the
existing fit would measure the feature's contribution to one fit rather than to the method.

Full-model market-neutral rank IC: **-0.0062**

| Removed | Rank IC without it | 95% CI | Δ vs full | Interpretation |
|---|---|---|---|---|
| atr_percentile | -0.0124 | [-0.0323, 0.0085] | -0.0062 | removing it hurt |
| volatility_regime | -0.0092 | [-0.0286, 0.0091] | -0.0031 | removing it hurt |
| adx_normalized | -0.0067 | [-0.0242, 0.0110] | -0.0005 | removing it hurt |
| swing_strength | -0.0064 | [-0.0235, 0.0111] | -0.0002 | removing it hurt |
| sr_distance | -0.0062 | [-0.0241, 0.0114] | -0.0001 | removing it hurt |
| market_efficiency_ratio | -0.0059 | [-0.0235, 0.0118] | 0.0003 | removing it helped |
| bollinger_position | -0.0059 | [-0.0234, 0.0118] | 0.0003 | removing it helped |
| rsi_normalized | -0.0054 | [-0.0234, 0.0124] | 0.0008 | removing it helped |
| trend_persistence | -0.0053 | [-0.0233, 0.0125] | 0.0009 | removing it helped |
| ema_slope | -0.0053 | [-0.0224, 0.0120] | 0.0009 | removing it helped |
| bollinger_width | -0.0051 | [-0.0227, 0.0127] | 0.0010 | removing it helped |
| volume_anomaly | -0.0050 | [-0.0229, 0.0129] | 0.0012 | removing it helped |
| ema_separation | -0.0049 | [-0.0222, 0.0123] | 0.0013 | removing it helped |
| ema_distance | -0.0027 | [-0.0204, 0.0158] | 0.0035 | removing it helped |
| macd_histogram_normalized | -0.0009 | [-0.0181, 0.0167] | 0.0053 | removing it helped |

Δ is the ablated rank IC minus the full model's. **Negative means removing the feature made
the model worse**, i.e. the feature was contributing. Positive means the model was better
without it.

10 of 15 features improved the model when removed.

## 8. What this measures

Stated as arithmetic rather than as a judgement:

1. Market-neutral rank IC is -0.0062 [-0.0237, 0.0115]. The interval **contains zero**, so this corpus does not distinguish the model from no cross-sectional skill.
2. Market-neutral long/short quintile spread is -0.00036 [-0.00195, 0.00115] per 5 days. The interval **contains zero**.
3. Brier skill against the base rate is -0.02352. Zero or negative: the calibrated probabilities do **not** beat forecasting the base rate.
4. 9 of 15 coefficients change sign across folds.
5. 0 of 15 individual features have a rank-IC interval excluding zero.

Two caveats that bound every claim above, and are properties of the corpus rather than of
the method:

- **One market, one regime.** 2013–2018 US large-cap equities is a single sustained bull
  market. A result here — positive or negative — does not transfer to other asset classes,
  other eras, or the intraday timeframes Sentinel is actually pointed at.
- **No order-flow channel.** The corpus has no taker buy/sell split, so any engine feature
  depending on order-flow direction is unavailable. This weakens the existing-engine
  comparator specifically, and its numbers should be read as a floor rather than as its
  full capability.
