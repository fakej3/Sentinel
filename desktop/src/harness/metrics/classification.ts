/**
 * Classification metrics.
 *
 * Standard definitions throughout — the multiclass forms are scikit-learn's,
 * which are in turn the published ones, and each is tested against a worked
 * example with a hand-computed value.
 *
 * The recurring decision in this file is what to return when a metric is
 * undefined: precision with no predicted positives, recall with no actual
 * positives, MCC with an empty confusion row. scikit-learn returns 0 with a
 * warning. This module returns `null`, because a report that prints
 * "precision 0.00" for a slice where the engine never predicted the class is
 * making a claim it did not measure.
 */
import type { ConfusionMatrix, BinaryClassificationMetrics, MulticlassMetrics, PerClassMetrics } from './types'

// ── Binary ────────────────────────────────────────────────────────────────────

/**
 * Binary metrics from raw counts.
 *
 * Convention: the POSITIVE class is the one the caller is asking about. For
 * Sentinel that is "the market went up" when scoring an up/down call, and
 * "this trade won" when scoring a directional call.
 */
export function binaryMetrics(tp: number, fp: number, fn: number, tn: number): BinaryClassificationMetrics {
  for (const [name, v] of [['tp', tp], ['fp', fp], ['fn', fn], ['tn', tn]] as const) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`binaryMetrics: ${name} must be a non-negative integer, got ${v}`)
  }
  const n = tp + fp + fn + tn

  const precision = tp + fp > 0 ? tp / (tp + fp) : null
  const recall = tp + fn > 0 ? tp / (tp + fn) : null
  const specificity = tn + fp > 0 ? tn / (tn + fp) : null

  // F1 = harmonic mean of precision and recall = 2·TP / (2·TP + FP + FN).
  // Undefined when both are undefined, and zero (not undefined) when they are
  // defined but both zero — that is a measured failure, not a missing measurement.
  let f1: number | null = null
  if (precision !== null && recall !== null) {
    f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  }

  const balancedAccuracy = recall !== null && specificity !== null ? (recall + specificity) / 2 : null

  // Matthews correlation coefficient.
  //   MCC = (TP·TN − FP·FN) / sqrt((TP+FP)(TP+FN)(TN+FP)(TN+FN))
  // Undefined when any factor of the denominator is zero: the predictor or the
  // labels are constant, and no correlation exists.
  const d1 = tp + fp, d2 = tp + fn, d3 = tn + fp, d4 = tn + fn
  const mcc = d1 > 0 && d2 > 0 && d3 > 0 && d4 > 0
    ? (tp * tn - fp * fn) / Math.sqrt(d1 * d2 * d3 * d4)
    : null

  return {
    n, tp, fp, fn, tn,
    accuracy: n > 0 ? (tp + tn) / n : null,
    precision, recall, specificity, f1, balancedAccuracy, mcc,
    // Share of samples whose true label is positive. Every conditional claim
    // has to beat this, and it is meaningless to read a 60% hit rate without it.
    baseRate: n > 0 ? (tp + fn) / n : null,
    predictedPositiveRate: n > 0 ? (tp + fp) / n : null,
  }
}

/** Binary metrics from aligned label arrays. */
export function binaryFromLabels(
  yTrue: readonly boolean[],
  yPred: readonly boolean[],
): BinaryClassificationMetrics {
  if (yTrue.length !== yPred.length) {
    throw new Error(`binaryFromLabels: length mismatch ${yTrue.length} vs ${yPred.length}`)
  }
  let tp = 0, fp = 0, fn = 0, tn = 0
  for (let i = 0; i < yTrue.length; i++) {
    if (yPred[i]) { if (yTrue[i]) tp++; else fp++ }
    else { if (yTrue[i]) fn++; else tn++ }
  }
  return binaryMetrics(tp, fp, fn, tn)
}

// ── Multiclass ────────────────────────────────────────────────────────────────

/**
 * K×K confusion matrix. `counts[i][j]` = samples whose TRUE class is
 * `labels[i]` and whose PREDICTED class is `labels[j]`.
 *
 * Row index is truth, column index is prediction. The orientation is stated
 * because it is the single most common source of silently transposed
 * precision and recall.
 *
 * `labels` fixes the ordering, so two matrices from different slices are
 * comparable even when one slice never saw a class. A predicted or true label
 * outside `labels` is an error rather than a silently dropped row: it means
 * the caller's class vocabulary is wrong.
 */
export function confusionMatrix(
  yTrue: readonly string[],
  yPred: readonly string[],
  labels: readonly string[],
): ConfusionMatrix {
  if (yTrue.length !== yPred.length) {
    throw new Error(`confusionMatrix: length mismatch ${yTrue.length} vs ${yPred.length}`)
  }
  if (new Set(labels).size !== labels.length) throw new Error('confusionMatrix: labels must be unique')

  const index = new Map(labels.map((l, i) => [l, i]))
  const counts = labels.map(() => labels.map(() => 0))
  for (let i = 0; i < yTrue.length; i++) {
    const r = index.get(yTrue[i])
    const c = index.get(yPred[i])
    if (r === undefined) throw new Error(`confusionMatrix: unknown true label "${yTrue[i]}"`)
    if (c === undefined) throw new Error(`confusionMatrix: unknown predicted label "${yPred[i]}"`)
    counts[r][c]++
  }
  return { labels: [...labels], counts, n: yTrue.length }
}

/** One-vs-rest metrics for class `k`, read off the matrix. */
function perClass(cm: ConfusionMatrix, k: number): PerClassMetrics {
  const { counts, n } = cm
  const tp = counts[k][k]
  let fn = 0, fp = 0
  for (let j = 0; j < counts.length; j++) if (j !== k) fn += counts[k][j]
  for (let i = 0; i < counts.length; i++) if (i !== k) fp += counts[i][k]
  const tn = n - tp - fn - fp
  const m = binaryMetrics(tp, fp, fn, tn)
  return {
    label: cm.labels[k],
    support: tp + fn,
    predicted: tp + fp,
    precision: m.precision,
    recall: m.recall,
    f1: m.f1,
  }
}

/**
 * Multiclass metrics.
 *
 * MACRO averages weight every class equally; WEIGHTED averages weight by
 * support. Both are reported because they answer different questions, and
 * quoting only one is how a model that ignores a rare class gets called good.
 * Classes with no support are excluded from the macro average rather than
 * counted as zero — averaging in a class that never occurred measures the
 * label set, not the predictor.
 *
 * BALANCED ACCURACY is the macro-averaged recall, which is the standard
 * definition and is the right headline for imbalanced slices.
 *
 * MULTICLASS MCC is Gorodkin's R_K, as implemented by scikit-learn:
 *
 *     MCC = (c·s − Σₖ pₖ·tₖ) / sqrt((s² − Σₖ pₖ²)·(s² − Σₖ tₖ²))
 *
 * with s = total samples, c = total correct, tₖ = true count of class k,
 * pₖ = predicted count of class k. It reduces to the binary MCC for K = 2.
 */
export function multiclassMetrics(cm: ConfusionMatrix): MulticlassMetrics {
  const K = cm.labels.length
  const s = cm.n
  const classes = Array.from({ length: K }, (_, k) => perClass(cm, k))

  let c = 0
  const t = new Array<number>(K).fill(0)
  const p = new Array<number>(K).fill(0)
  for (let i = 0; i < K; i++) {
    c += cm.counts[i][i]
    for (let j = 0; j < K; j++) { t[i] += cm.counts[i][j]; p[j] += cm.counts[i][j] }
  }

  const supported = classes.filter(x => x.support > 0)
  const macro = (pick: (x: PerClassMetrics) => number | null): number | null => {
    const vs = supported.map(pick).filter((v): v is number => v !== null)
    return vs.length > 0 ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  const weighted = (pick: (x: PerClassMetrics) => number | null): number | null => {
    let num = 0, den = 0
    for (const x of supported) {
      const v = pick(x)
      if (v === null) continue
      num += v * x.support
      den += x.support
    }
    return den > 0 ? num / den : null
  }

  let sumP2 = 0, sumT2 = 0, sumPT = 0
  for (let k = 0; k < K; k++) { sumP2 += p[k] * p[k]; sumT2 += t[k] * t[k]; sumPT += p[k] * t[k] }
  const denom = Math.sqrt((s * s - sumP2) * (s * s - sumT2))
  const mcc = s > 0 && denom > 0 ? (c * s - sumPT) / denom : null

  return {
    matrix: cm,
    n: s,
    accuracy: s > 0 ? c / s : null,
    balancedAccuracy: macro(x => x.recall),
    macroPrecision: macro(x => x.precision),
    macroRecall: macro(x => x.recall),
    macroF1: macro(x => x.f1),
    weightedPrecision: weighted(x => x.precision),
    weightedRecall: weighted(x => x.recall),
    weightedF1: weighted(x => x.f1),
    mcc,
    classes,
  }
}
