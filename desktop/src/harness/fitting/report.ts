/**
 * Report rendering.
 *
 * Renders measurements. It does not decide whether they are good — every
 * verdict line states the arithmetic comparison that produced it (does the
 * interval contain zero, is this Brier below the base rate's) so a reader can
 * disagree with the threshold without having to re-derive the number.
 *
 * Confidence intervals accompany every headline figure, and where an interval
 * contains zero the report says so in words. The previous engine's central
 * defect was a number that looked like a likelihood and was never checked
 * against one; a report that printed point estimates alone would repeat it one
 * layer up.
 */
import type { Corpus } from './corpus'
import type { FoldConfig, HyperGrid, WalkForwardResult } from './pipeline'
import type { Aggregate, EvaluationResult } from './evaluate'
import type { AblationReport, FeatureStability, ForwardSelectionReport } from './analysis'
import type { Estimate } from '../research/inference'

export interface ReportInput {
  readonly corpus: Corpus
  readonly result: WalkForwardResult
  readonly evaluations: readonly EvaluationResult[]
  readonly stability: readonly FeatureStability[]
  readonly ablation: AblationReport | null
  readonly selection: ForwardSelectionReport
  readonly fixedHyper: { readonly window: number; readonly ridge: number; readonly calibration: string }
  readonly comparatorDescriptions: Readonly<Record<string, string>>
  readonly grid: HyperGrid
  readonly config: FoldConfig
}

const f = (v: number | null | undefined, d = 4): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d)

const pct = (v: number | null | undefined, d = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(d)}%`

/** "0.0123 [-0.0040, 0.0287]" — the point estimate is never shown without its interval. */
const est = (e: Estimate | null, d = 4): string =>
  e === null ? '—' : `${f(e.point, d)} [${f(e.lower, d)}, ${f(e.upper, d)}]`

/** True when the interval excludes zero — the only sense in which anything here is "significant". */
const excludesZero = (e: Estimate | null): boolean =>
  e !== null && ((e.lower > 0 && e.upper > 0) || (e.lower < 0 && e.upper < 0))

const sig = (e: Estimate | null): string => (e === null ? '—' : excludesZero(e) ? 'yes' : 'no')

function aggregateRow(name: string, a: Aggregate): string {
  return `| ${name} | ${est(a.ic)} | ${est(a.rankIc)} | ${est(a.auc, 4)} | ${est(a.longShort, 5)} | ${a.days} |`
}

export function renderReport(input: ReportInput): string {
  const { corpus, result, evaluations, stability, ablation, selection, fixedHyper, grid, config } = input
  const model = evaluations.find(e => e.name === 'fitted_model')
  const lines: string[] = []
  const P = (s = ''): void => { lines.push(s) }

  P('# Milestone 3 — Model Fitting and Out-of-Sample Evaluation')
  P()
  P('Whether the rebuilt signal layer has any predictive power on real market data.')
  P('Every number below is out of sample. Nothing was selected on the data it is scored against.')
  P()

  // ── Setup ───────────────────────────────────────────────────────────────────
  P('## 1. Setup')
  P()
  P('| | |')
  P('|---|---|')
  P(`| Corpus | S&P 500 daily bars, ${corpus.symbols.length} symbols, ${corpus.dates.length} trading dates |`)
  P(`| Decision rows | ${corpus.rows.toLocaleString()} |`)
  P(`| Lookback per decision | ${corpus.lookbackBars} bars |`)
  P(`| Horizon | ${result.horizon} trading days |`)
  P(`| Label | forward return > 0 |`)
  P(`| Walk-forward | ${config.mode}, train ${config.trainDates} dates, test ${config.testDates} dates |`)
  P(`| Embargo | ${config.embargoDates} dates (= max horizon; derived, not chosen) |`)
  P(`| Outer folds | ${result.folds.length} |`)
  P(`| Inner folds per outer fold | ${config.innerFolds} (test blocks of ${config.innerTestDates} dates) |`)
  P(`| Out-of-sample predictions | ${result.predictions.length.toLocaleString()} |`)
  P(`| Hyperparameter grid | windows [${grid.windows.join(', ')}], ridges [${grid.ridges.join(', ')}], calibration [${grid.calibrations.join(', ')}] |`)
  P()
  P('**Unit of independence is the DATE, not the row.** Five hundred S&P constituents on one')
  P('day share a market factor, so every headline statistic is computed cross-sectionally per')
  P('date and the resulting daily series is bootstrapped in non-overlapping blocks of')
  P(`${result.horizon} days (the horizon, to absorb the autocorrelation that overlapping forward`)
  P('windows induce). Treating rows as independent would shrink every interval below by')
  P('roughly the square root of the average symbols-per-day.')
  P()

  // ── Headline ────────────────────────────────────────────────────────────────
  P('## 2. Does the fitted model have an edge?')
  P()
  if (model === undefined) {
    P('The model produced no evaluation. Nothing can be concluded.')
    P()
  } else {
    P('Two questions, and they are different. **Raw** asks whether the model predicts returns;')
    P('on a single-market corpus that is dominated by whether the market went up. **Market-neutral**')
    P("removes each date's cross-sectional mean return and asks the question the model can actually")
    P('be judged on: did it rank *these* stocks correctly against each other?')
    P()
    P('| Metric | Raw returns | Market-neutral | Interval excludes zero? |')
    P('|---|---|---|---|')
    P(`| IC (Pearson) | ${est(model.raw.ic)} | ${est(model.marketNeutral.ic)} | ${sig(model.marketNeutral.ic)} |`)
    P(`| Rank IC (Spearman) | ${est(model.raw.rankIc)} | ${est(model.marketNeutral.rankIc)} | ${sig(model.marketNeutral.rankIc)} |`)
    P(`| AUC | ${est(model.raw.auc)} | ${est(model.marketNeutral.auc)} | — |`)
    P(`| Long/short quintile spread | ${est(model.raw.longShort, 5)} | ${est(model.marketNeutral.longShort, 5)} | ${sig(model.marketNeutral.longShort)} |`)
    P()
    P('AUC has no zero-column because its null value is 0.5, not 0. Compare its interval against 0.5.')
    P()
    P('### Probability quality')
    P()
    P('| | |')
    P('|---|---|')
    P(`| Brier score | ${f(model.pooledBrier, 5)} |`)
    P(`| Brier skill vs base rate | ${f(model.pooledBrierSkill, 5)} |`)
    P(`| Log loss | ${f(model.pooledLogLoss, 5)} |`)
    P(`| Expected calibration error | ${f(model.reliability?.ece ?? null, 5)} |`)
    P(`| Maximum calibration error | ${f(model.reliability?.mce ?? null, 5)} |`)
    P(`| Coverage | ${pct(model.coverage)} of ${model.available.toLocaleString()} rows |`)
    P()
    P('Brier skill is the load-bearing one: it is `1 - BS / BS_baserate`, so **positive means the')
    P('model beats simply forecasting the base rate, and zero or negative means it does not**,')
    P('however small the raw Brier looks.')
    P()
    P('### Classification at p > 0.5')
    P()
    P('| | |')
    P('|---|---|')
    P(`| Accuracy | ${pct(model.classification.accuracy, 2)} |`)
    P(`| Base rate | ${pct(model.classification.baseRate, 2)} |`)
    P(`| Precision | ${pct(model.classification.precision, 2)} |`)
    P(`| Recall | ${pct(model.classification.recall, 2)} |`)
    P(`| F1 | ${f(model.classification.f1, 4)} |`)
    P(`| Predicted-positive rate | ${pct(model.classification.predictedPositiveRate, 2)} |`)
    P()
    P('Accuracy must be read against the base rate, never alone. In a rising market a constant')
    P('"long" forecast scores the base rate by definition.')
    P()

    if (model.reliability !== null) {
      P('### Reliability curve')
      P()
      P('| Forecast bin | n | Mean forecast | Observed frequency | Gap |')
      P('|---|---|---|---|---|')
      for (const b of model.reliability.bins) {
        if (b.n === 0) continue
        const gap = b.observed !== null && b.meanPredicted !== null ? b.observed - b.meanPredicted : null
        P(`| [${b.lower.toFixed(1)}, ${b.upper.toFixed(1)}) | ${b.n} | ${f(b.meanPredicted, 4)} | ${f(b.observed, 4)} | ${f(gap, 4)} |`)
      }
      P()
    }
  }

  // ── Comparison ──────────────────────────────────────────────────────────────
  P('## 3. Comparison against every baseline')
  P()
  P('All comparators are scored on the **identical** out-of-sample rows, so differences are')
  P('attributable to method rather than to coverage or era. Market-neutral returns.')
  P()
  P('| Comparator | IC | Rank IC | AUC | L/S spread | Days |')
  P('|---|---|---|---|---|---|')
  const primary = ['fitted_model', 'sentinel_engine', 'sentinel_direction', 'random', 'always_long', 'ema_cross', 'ema_cross_continuous']
  for (const name of primary) {
    const e = evaluations.find(x => x.name === name)
    if (e !== undefined) P(aggregateRow(name, e.marketNeutral))
  }
  P()
  P('### Individual feature baselines')
  P()
  P('Each of the fifteen features used alone as a score, on the same rows.')
  P()
  P('| Feature | IC | Rank IC | AUC | L/S spread | Days |')
  P('|---|---|---|---|---|---|')
  const features = evaluations
    .filter(e => e.name.startsWith('feature:'))
    .sort((a, b) => Math.abs(b.marketNeutral.rankIc?.point ?? 0) - Math.abs(a.marketNeutral.rankIc?.point ?? 0))
  for (const e of features) P(aggregateRow(e.name.replace('feature:', ''), e.marketNeutral))
  P()
  P('Sorted by |rank IC| descending. An interval containing zero means the feature is')
  P('indistinguishable from noise on this corpus at this horizon.')
  P()
  const sigFeatures = features.filter(e => excludesZero(e.marketNeutral.rankIc))
  P(`**${sigFeatures.length} of ${features.length} individual features have a rank-IC interval excluding zero.**`)
  if (sigFeatures.length > 0) {
    P()
    for (const e of sigFeatures) {
      P(`- \`${e.name.replace('feature:', '')}\`: rank IC ${est(e.marketNeutral.rankIc)}`)
    }
  }
  P()

  // ── Hyperparameter selection ────────────────────────────────────────────────
  P('## 4. Hyperparameter selection, per fold')
  P()
  P('Selected inside each train block on inner validation. No fold ever saw its own test data.')
  P()
  P('| Fold | Train dates | Test dates | Window | Ridge | Calibration | Inner Brier | Train rows | Calib rows | Test rows |')
  P('|---|---|---|---|---|---|---|---|---|---|')
  for (const fold of result.folds) {
    P(`| ${fold.fold} | ${fold.trainStart}–${fold.trainEnd} | ${fold.testStart}–${fold.testEnd} `
      + `| ${fold.chosen.window} | ${fold.chosen.ridge} | ${fold.chosen.calibration} `
      + `| ${f(fold.chosen.innerBrier, 5)} | ${fold.trainRows.toLocaleString()} | ${fold.calibrationRows.toLocaleString()} | ${fold.testRows.toLocaleString()} |`)
  }
  P()
  const chosenCal = new Map<string, number>()
  for (const fold of result.folds) chosenCal.set(fold.chosen.calibration, (chosenCal.get(fold.chosen.calibration) ?? 0) + 1)
  P('**Calibration method chosen:** '
    + [...chosenCal.entries()].map(([k, v]) => `${k} ${v}x`).join(', ') + '.')
  P('`none` winning means the model\'s own logistic output calibrated better out of sample than')
  P('either isotonic or Platt could — which is a real result, not a failure to calibrate.')
  P()

  // ── Coefficients ────────────────────────────────────────────────────────────
  P('## 5. Fitted coefficients and stability')
  P()
  P('Coefficients are in **standardised space**: log-odds per trailing standard deviation of the')
  P('feature. Positive means bullish, without exception, because the feature layer enforces that')
  P('sign convention at extraction.')
  P()
  P('| Feature | Mean coefficient | SD | 95% CI (across folds) | Sign agreement | Flips? | Mean importance | Folds dropped |')
  P('|---|---|---|---|---|---|---|---|')
  const ordered = [...stability].sort((a, b) => (b.meanImportance ?? 0) - (a.meanImportance ?? 0))
  for (const s of ordered) {
    P(`| ${s.name} | ${f(s.meanCoefficient, 4)} | ${f(s.sdCoefficient, 4)} `
      + `| [${f(s.ciLower, 4)}, ${f(s.ciUpper, 4)}] | ${pct(s.signAgreement, 0)} `
      + `| ${s.signFlips ? '**yes**' : 'no'} | ${pct(s.meanImportance, 1)} | ${s.droppedFolds} |`)
  }
  P()
  const flipped = stability.filter(s => s.signFlips)
  P(`**${flipped.length} of ${stability.length} features change sign across folds.**`)
  if (flipped.length > 0) {
    P()
    P('A coefficient that is positive in one fold and negative in the next has not been measured')
    P('as bidirectional — it has been measured as noise. Both estimates are consistent with a true')
    P('coefficient of zero, and the magnitude in any single fold is describing that train block')
    P('rather than the market.')
    P()
    for (const s of flipped) {
      P(`- \`${s.name}\`: ${s.coefficients.map(c => c.toFixed(3)).join(', ')}`)
    }
  }
  P()
  P('The across-fold interval **understates** the true width: under a rolling scheme consecutive')
  P('folds share most of their training data, so the fold estimates are not independent draws.')
  P('It is a stability diagnostic, not inference.')
  P()

  // ── Forward selection ───────────────────────────────────────────────────────
  P('## 6. Forward selection')
  P()
  P('Greedy, starting from nothing, adding whichever remaining feature most improves the')
  P('**inner-validation** Brier score. Every block scored lies strictly inside an outer train')
  P('block, so no candidate was ever ranked against data the headline evaluation uses.')
  P()
  P(`Hyperparameters held fixed at window ${fixedHyper.window}, ridge ${fixedHyper.ridge}, `
    + `calibration ${fixedHyper.calibration} — the main run's modal selection — so the comparison`)
  P('isolates which features help.')
  P()
  if (selection.steps.length === 0) {
    P('**No feature improved inner-validation Brier at the first step.** Selection stopped')
    P('immediately: starting from the empty set, not one of the fifteen features made the')
    P('validation score better than it was without any of them.')
  } else {
    P('| Step | Added | Inner Brier | Improvement |')
    P('|---|---|---|---|')
    for (const s of selection.steps) {
      P(`| ${s.step} | ${s.added} | ${f(s.innerBrier, 5)} | ${f(s.improvement, 6)} |`)
    }
    P()
    P(`Stopped at step ${selection.stoppedAt}: no remaining feature improved the score.`)
    P(`Selected ${selection.selected.length} of ${stability.length} features: `
      + selection.selected.map(n => `\`${n}\``).join(', ') + '.')
    P()
    P('Improvement is the change in Brier, so **negative is better**. A first step with a large')
    P('improvement and subsequent steps near zero means one feature carries whatever signal')
    P('exists and the rest are redundant with it.')
  }
  P()

  // ── Ablation ────────────────────────────────────────────────────────────────
  P('## 7. Ablation')
  P()
  if (ablation === null) {
    P('Not run.')
  } else {
    P('Each row refits the **entire** walk-forward with that feature removed. Re-scoring the')
    P('existing fit would measure the feature\'s contribution to one fit rather than to the method.')
    P()
    P(`Full-model market-neutral rank IC: **${f(ablation.baselineRankIc)}**`)
    P()
    P('| Removed | Rank IC without it | 95% CI | Δ vs full | Interpretation |')
    P('|---|---|---|---|---|')
    const rows = [...ablation.rows].sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
    for (const r of rows) {
      const interp = r.delta === null ? '—'
        : r.delta < 0 ? 'removing it hurt'
        : r.delta > 0 ? 'removing it helped'
        : 'no change'
      P(`| ${r.removed} | ${f(r.rankIc)} | [${f(r.rankIcLower)}, ${f(r.rankIcUpper)}] | ${f(r.delta)} | ${interp} |`)
    }
    P()
    P('Δ is the ablated rank IC minus the full model\'s. **Negative means removing the feature made')
    P('the model worse**, i.e. the feature was contributing. Positive means the model was better')
    P('without it.')
    P()
    const helped = ablation.rows.filter(r => r.delta !== null && r.delta > 0).length
    P(`${helped} of ${ablation.rows.length} features improved the model when removed.`)
    P()
  }

  // ── Verdict ─────────────────────────────────────────────────────────────────
  P('## 8. What this measures')
  P()
  if (model === undefined) {
    P('No model evaluation was produced.')
  } else {
    const mnRank = model.marketNeutral.rankIc
    const mnLS = model.marketNeutral.longShort
    const skill = model.pooledBrierSkill

    P('Stated as arithmetic rather than as a judgement:')
    P()
    P(`1. Market-neutral rank IC is ${est(mnRank)}. `
      + (excludesZero(mnRank)
        ? 'The interval excludes zero.'
        : 'The interval **contains zero**, so this corpus does not distinguish the model from no cross-sectional skill.'))
    P(`2. Market-neutral long/short quintile spread is ${est(mnLS, 5)} per ${result.horizon} days. `
      + (excludesZero(mnLS)
        ? 'The interval excludes zero.'
        : 'The interval **contains zero**.'))
    P(`3. Brier skill against the base rate is ${f(skill, 5)}. `
      + (skill !== null && skill > 0
        ? 'Positive: the calibrated probabilities beat forecasting the base rate.'
        : 'Zero or negative: the calibrated probabilities do **not** beat forecasting the base rate.'))
    P(`4. ${flipped.length} of ${stability.length} coefficients change sign across folds.`)
    P(`5. ${sigFeatures.length} of ${features.length} individual features have a rank-IC interval excluding zero.`)
    P()
    P('Two caveats that bound every claim above, and are properties of the corpus rather than of')
    P('the method:')
    P()
    P('- **One market, one regime.** 2013–2018 US large-cap equities is a single sustained bull')
    P('  market. A result here — positive or negative — does not transfer to other asset classes,')
    P('  other eras, or the intraday timeframes Sentinel is actually pointed at.')
    P('- **No order-flow channel.** The corpus has no taker buy/sell split, so any engine feature')
    P('  depending on order-flow direction is unavailable. This weakens the existing-engine')
    P('  comparator specifically, and its numbers should be read as a floor rather than as its')
    P('  full capability.')
  }
  P()

  return lines.join('\n')
}
