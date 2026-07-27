/**
 * Reference validation.
 *
 * Every formula in the metrics module is checked against a value computed
 * independently of the implementation — either a published worked example or
 * an arithmetic identity evaluated by hand in the comment. No test here asserts
 * "whatever the code returns"; that would validate nothing.
 *
 * Sources are named inline. Where a source is scikit-learn, the expected value
 * is the one its documented formula produces, worked through in the comment,
 * not a number copied from a run of this code.
 */
import { describe, it, expect } from 'vitest'
import { binaryMetrics, binaryFromLabels, confusionMatrix, multiclassMetrics } from '../classification'
import { brierScore, brierSkillScore, logLoss, calibration, rocAuc, binEdges } from '../probability'
import { mean, variance, stdev, quantile, median, rank, pearson, spearman, proportionCI } from '../stats'
import { downsideDeviation, maxDrawdown } from '../trading'

const CLOSE = 12

describe('stats — textbook values', () => {
  it('mean and sample variance of [2,4,4,4,5,5,7,9]', () => {
    // Classic worked example. Mean 5. Population variance 4, SAMPLE variance
    // 32/7 = 4.571428..., since Σ(x−5)² = 9+1+1+1+0+0+4+16 = 32 and n−1 = 7.
    const xs = [2, 4, 4, 4, 5, 5, 7, 9]
    expect(mean(xs)).toBe(5)
    expect(variance(xs)).toBeCloseTo(32 / 7, CLOSE)
    expect(stdev(xs)).toBeCloseTo(Math.sqrt(32 / 7), CLOSE)
  })

  it('is undefined, not zero, where the statistic does not exist', () => {
    expect(mean([])).toBeNull()
    expect(variance([])).toBeNull()
    expect(variance([1])).toBeNull()
    expect(quantile([], 0.5)).toBeNull()
  })

  it('quantile follows the R type-7 / numpy definition', () => {
    // numpy.percentile([1,2,3,4], 25) = 1.75:  h = (4−1)·0.25 = 0.75,
    // Q = x[0] + 0.75·(x[1] − x[0]) = 1 + 0.75 = 1.75
    const xs = [1, 2, 3, 4]
    expect(quantile(xs, 0)).toBe(1)
    expect(quantile(xs, 0.25)).toBeCloseTo(1.75, CLOSE)
    expect(quantile(xs, 0.5)).toBeCloseTo(2.5, CLOSE)
    expect(quantile(xs, 0.75)).toBeCloseTo(3.25, CLOSE)
    expect(quantile(xs, 1)).toBe(4)
    expect(median([3, 1, 2])).toBe(2)
  })

  it('quantile does not require sorted input', () => {
    expect(quantile([4, 1, 3, 2], 0.25)).toBeCloseTo(1.75, CLOSE)
  })

  it('rank averages ties', () => {
    // [10, 20, 20, 30] → ranks 1, 2.5, 2.5, 4
    expect(rank([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4])
    // All tied → every rank is the mean of 1..4
    expect(rank([5, 5, 5, 5])).toEqual([2.5, 2.5, 2.5, 2.5])
  })

  it('Pearson is exactly ±1 on a perfect linear relation', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, CLOSE)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, CLOSE)
  })

  it('Pearson on a known pair', () => {
    // x = [1,2,3,4,5], y = [2,4,5,4,5].  Σxy = 3+8+15+16+25... worked:
    // mx = 3, my = 4. dx = [-2,-1,0,1,2], dy = [-2,0,1,0,1]
    // Σdxdy = 4+0+0+0+2 = 6 ; Σdx² = 10 ; Σdy² = 4+0+1+0+1 = 6
    // r = 6 / sqrt(60) = 0.7745966692...
    expect(pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5])).toBeCloseTo(6 / Math.sqrt(60), CLOSE)
  })

  it('Spearman is 1 for any strictly increasing relation, linear or not', () => {
    expect(spearman([1, 2, 3, 4], [1, 8, 27, 64])).toBeCloseTo(1, CLOSE)
    expect(spearman([1, 2, 3, 4], [64, 27, 8, 1])).toBeCloseTo(-1, CLOSE)
  })

  it('Spearman handles ties through averaged ranks', () => {
    // x ranks [1, 2.5, 2.5, 4], y ranks [1, 2, 3, 4]
    // dx = [-1.5, 0, 0, 1.5], dy = [-1.5, -0.5, 0.5, 1.5]
    // Σdxdy = 2.25 + 0 + 0 + 2.25 = 4.5 ; Σdx² = 4.5 ; Σdy² = 2.25+0.25+0.25+2.25 = 5
    // rho = 4.5 / sqrt(22.5) = 0.9486832980...
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(4.5 / Math.sqrt(22.5), CLOSE)
  })

  it('correlation is undefined against a constant', () => {
    expect(pearson([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
    expect(spearman([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull()
  })

  it('proportionCI brackets the estimate and stays inside (0,1)', () => {
    const ci = proportionCI(60, 100)!
    expect(ci.lower).toBeLessThan(0.6)
    expect(ci.upper).toBeGreaterThan(0.6)
    expect(ci.lower).toBeGreaterThan(0)
    expect(ci.upper).toBeLessThan(1)
  })

  it('proportionCI narrows as n grows', () => {
    const small = proportionCI(6, 10)!
    const large = proportionCI(600, 1000)!
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower)
  })

  it('proportionCI is null where the log-odds are infinite', () => {
    expect(proportionCI(0, 10)).toBeNull()
    expect(proportionCI(10, 10)).toBeNull()
    expect(proportionCI(1, 0)).toBeNull()
  })
})

describe('binary classification — hand-computed confusion matrix', () => {
  // TP=5, FP=3, FN=2, TN=10.  n = 20
  //   accuracy  = 15/20        = 0.75
  //   precision = 5/8          = 0.625
  //   recall    = 5/7          = 0.714285714...
  //   specificity = 10/13      = 0.769230769...
  //   F1        = 2·5/(10+3+2) = 10/15 = 0.666666...
  //   balanced  = (5/7 + 10/13)/2      = 0.741758241...
  //   MCC = (5·10 − 3·2)/sqrt(8·7·13·12) = 44/sqrt(8736) = 0.470740...
  const m = binaryMetrics(5, 3, 2, 10)

  it('accuracy', () => expect(m.accuracy).toBeCloseTo(0.75, CLOSE))
  it('precision', () => expect(m.precision).toBeCloseTo(5 / 8, CLOSE))
  it('recall', () => expect(m.recall).toBeCloseTo(5 / 7, CLOSE))
  it('specificity', () => expect(m.specificity).toBeCloseTo(10 / 13, CLOSE))
  it('F1 equals 2TP/(2TP+FP+FN)', () => expect(m.f1).toBeCloseTo(10 / 15, CLOSE))
  it('balanced accuracy', () => expect(m.balancedAccuracy).toBeCloseTo((5 / 7 + 10 / 13) / 2, CLOSE))
  it('MCC', () => expect(m.mcc).toBeCloseTo(44 / Math.sqrt(8 * 7 * 13 * 12), CLOSE))
  it('base rate', () => expect(m.baseRate).toBeCloseTo(7 / 20, CLOSE))

  it('MCC is +1 for a perfect classifier and −1 for a perfectly inverted one', () => {
    expect(binaryMetrics(10, 0, 0, 10).mcc).toBeCloseTo(1, CLOSE)
    expect(binaryMetrics(0, 10, 10, 0).mcc).toBeCloseTo(-1, CLOSE)
  })

  it('MCC is 0 for a classifier independent of the label', () => {
    // Predicts positive half the time regardless of truth.
    expect(binaryMetrics(25, 25, 25, 25).mcc).toBeCloseTo(0, CLOSE)
  })

  it('MCC is null, not 0, when a predictor or the labels are constant', () => {
    expect(binaryMetrics(0, 0, 10, 10).mcc).toBeNull()   // never predicts positive
    expect(binaryMetrics(10, 10, 0, 0).mcc).toBeNull()   // no actual negatives
  })

  it('precision is null when nothing was predicted positive', () => {
    const z = binaryMetrics(0, 0, 5, 5)
    expect(z.precision).toBeNull()
    expect(z.recall).toBe(0)
    expect(z.f1).toBeNull()
  })

  it('F1 is 0, not null, when precision and recall are both defined and zero', () => {
    expect(binaryMetrics(0, 5, 5, 0).f1).toBe(0)
  })

  it('binaryFromLabels agrees with the counts it derives', () => {
    const yTrue = [true, true, true, true, true, true, true, false, false, false]
    const yPred = [true, true, true, true, true, false, false, true, false, false]
    const m2 = binaryFromLabels(yTrue, yPred)
    expect([m2.tp, m2.fp, m2.fn, m2.tn]).toEqual([5, 1, 2, 2])
    expect(m2.n).toBe(10)
  })

  it('rejects mismatched lengths rather than truncating', () => {
    expect(() => binaryFromLabels([true], [true, false])).toThrow(/length mismatch/)
  })
})

describe('multiclass — worked 3×3 example', () => {
  // The scikit-learn confusion_matrix docstring example, relabelled:
  //   y_true = [cat, ant, cat, cat, ant, bird]
  //   y_pred = [ant, ant, cat, cat, ant, cat]
  // sklearn, labels ordered [ant, bird, cat], gives
  //   [[2, 0, 0],
  //    [0, 0, 1],
  //    [1, 0, 2]]
  const yTrue = ['cat', 'ant', 'cat', 'cat', 'ant', 'bird']
  const yPred = ['ant', 'ant', 'cat', 'cat', 'ant', 'cat']
  const cm = confusionMatrix(yTrue, yPred, ['ant', 'bird', 'cat'])

  it('reproduces the published matrix, rows = truth', () => {
    expect(cm.counts).toEqual([[2, 0, 0], [0, 0, 1], [1, 0, 2]])
    expect(cm.n).toBe(6)
  })

  it('accuracy is the trace over the total', () => {
    expect(multiclassMetrics(cm).accuracy).toBeCloseTo(4 / 6, CLOSE)
  })

  it('per-class precision and recall', () => {
    const m = multiclassMetrics(cm)
    const by = Object.fromEntries(m.classes.map(c => [c.label, c]))
    // ant: TP 2, predicted 3 → precision 2/3 ; support 2 → recall 1
    expect(by.ant.precision).toBeCloseTo(2 / 3, CLOSE)
    expect(by.ant.recall).toBeCloseTo(1, CLOSE)
    // bird: TP 0, predicted 0 → precision undefined ; support 1 → recall 0
    expect(by.bird.precision).toBeNull()
    expect(by.bird.recall).toBe(0)
    // cat: TP 2, predicted 3 → precision 2/3 ; support 3 → recall 2/3
    expect(by.cat.precision).toBeCloseTo(2 / 3, CLOSE)
    expect(by.cat.recall).toBeCloseTo(2 / 3, CLOSE)
  })

  it('balanced accuracy is the macro-averaged recall', () => {
    // (1 + 0 + 2/3) / 3 = 0.5555...
    expect(multiclassMetrics(cm).balancedAccuracy).toBeCloseTo((1 + 0 + 2 / 3) / 3, CLOSE)
  })

  it('multiclass MCC reduces to the binary MCC when K = 2', () => {
    // TP=5 (a→a), FN=2 (a→b), FP=3 (b→a), TN=10 (b→b)
    const cm2 = confusionMatrix(
      [...Array(7).fill('a'), ...Array(13).fill('b')],
      [...Array(5).fill('a'), ...Array(2).fill('b'), ...Array(3).fill('a'), ...Array(10).fill('b')],
      ['a', 'b'],
    )
    expect(multiclassMetrics(cm2).mcc).toBeCloseTo(binaryMetrics(5, 3, 2, 10).mcc!, CLOSE)
  })

  it('multiclass MCC is 1 for a perfect classifier', () => {
    const y = ['a', 'b', 'c', 'a', 'b', 'c']
    expect(multiclassMetrics(confusionMatrix(y, y, ['a', 'b', 'c'])).mcc).toBeCloseTo(1, CLOSE)
  })

  it('rejects a label outside the declared vocabulary', () => {
    expect(() => confusionMatrix(['a'], ['z'], ['a', 'b'])).toThrow(/unknown predicted label "z"/)
    expect(() => confusionMatrix(['z'], ['a'], ['a', 'b'])).toThrow(/unknown true label "z"/)
  })

  it('rejects duplicate labels', () => {
    expect(() => confusionMatrix(['a'], ['a'], ['a', 'a'])).toThrow(/labels must be unique/)
  })
})

describe('probability — published reference values', () => {
  it('Brier score of the scikit-learn docstring example', () => {
    // sklearn brier_score_loss([0,1,1,0], [0.1, 0.9, 0.8, 0.3]) = 0.0375
    // = ((0.1)² + (0.1)² + (0.2)² + (0.3)²)/4 = (0.01+0.01+0.04+0.09)/4
    expect(brierScore([0.1, 0.9, 0.8, 0.3], [false, true, true, false])).toBeCloseTo(0.0375, CLOSE)
  })

  it('Brier score of a perfect and of a maximally wrong forecast', () => {
    expect(brierScore([1, 0], [true, false])).toBe(0)
    expect(brierScore([0, 1], [true, false])).toBe(1)
  })

  it('a constant forecast at the base rate scores exactly b(1−b)', () => {
    const y = [true, true, true, false, false, false, false, false, false, false]  // b = 0.3
    expect(brierScore(Array(10).fill(0.3), y)).toBeCloseTo(0.3 * 0.7, CLOSE)
    // and therefore has zero skill, by construction
    expect(brierSkillScore(Array(10).fill(0.3), y)).toBeCloseTo(0, CLOSE)
  })

  it('Brier skill is positive for a better forecast and negative for a worse one', () => {
    const y = [true, true, false, false]
    expect(brierSkillScore([0.9, 0.9, 0.1, 0.1], y)!).toBeGreaterThan(0)
    expect(brierSkillScore([0.1, 0.1, 0.9, 0.9], y)!).toBeLessThan(0)
  })

  it('log loss of an uninformative 0.5 forecast is log 2', () => {
    expect(logLoss([0.5, 0.5, 0.5, 0.5], [true, false, true, false])).toBeCloseTo(Math.LN2, CLOSE)
  })

  it('log loss of the scikit-learn docstring example', () => {
    // sklearn log_loss(["spam","ham","ham","spam"], [[.1,.9],[.9,.1],[.8,.2],[.35,.65]])
    //   = 0.21616...   with P(spam) = [0.9, 0.1, 0.2, 0.65] and y = [1,0,0,1]
    const p = [0.9, 0.1, 0.2, 0.65]
    const y = [true, false, false, true]
    const expected = -(Math.log(0.9) + Math.log(0.9) + Math.log(0.8) + Math.log(0.65)) / 4
    expect(logLoss(p, y)).toBeCloseTo(expected, CLOSE)
    expect(logLoss(p, y)).toBeCloseTo(0.21616187468057912, 10)
  })

  it('log loss is finite at p = 0 and p = 1 because of the eps clip', () => {
    const eps = 1e-15
    const v = logLoss([0, 1], [true, false], eps)!
    expect(Number.isFinite(v)).toBe(true)
    // Both samples are maximally wrong, so both cost the clipped extreme.
    // The two costs are NOT identical: `1 - 1e-15` is not representable in
    // float64 (it rounds to 0.999999999999999), so the upper clip leaves
    // 9.99e-16 rather than 1e-15. A ~1e-5 relative difference on a cap that is
    // arbitrary to begin with — stated rather than papered over with a loose
    // tolerance.
    const expected = (-Math.log(eps) + -Math.log(1 - (1 - eps))) / 2
    expect(v).toBeCloseTo(expected, CLOSE)
    expect(v).toBeGreaterThan(34)
  })

  it('a larger eps caps the penalty more aggressively', () => {
    expect(logLoss([0], [true], 1e-3)!).toBeCloseTo(-Math.log(1e-3), CLOSE)
    expect(logLoss([0], [true], 1e-6)!).toBeCloseTo(-Math.log(1e-6), CLOSE)
  })

  it('rejects an eps outside (0, 0.5)', () => {
    expect(() => logLoss([0.5], [true], 0)).toThrow(/eps must be in \(0, 0\.5\)/)
    expect(() => logLoss([0.5], [true], 0.5)).toThrow(/eps must be in \(0, 0\.5\)/)
  })

  it('rejects a probability outside [0,1] rather than clamping it', () => {
    expect(() => brierScore([1.3], [true])).toThrow(/must be a finite number in \[0, 1\]/)
    expect(() => logLoss([-0.1], [true])).toThrow(/must be a finite number in \[0, 1\]/)
    expect(() => brierScore([NaN], [true])).toThrow(/must be a finite number in \[0, 1\]/)
  })

  it('ROC AUC is 1 for perfect separation, 0 for perfect inversion, 0.5 for a constant score', () => {
    expect(rocAuc([0.1, 0.2, 0.8, 0.9], [false, false, true, true])).toBe(1)
    expect(rocAuc([0.9, 0.8, 0.2, 0.1], [false, false, true, true])).toBe(0)
    expect(rocAuc([0.5, 0.5, 0.5, 0.5], [false, false, true, true])).toBe(0.5)
  })

  it('ROC AUC counts ties as half, per the Mann–Whitney definition', () => {
    // scores [1,2,2,3], y [F,F,T,T]. Pairs (neg,pos): (1,2)>,(1,3)>,(2,2)tie,(2,3)>
    // AUC = (3 + 0.5)/4 = 0.875
    expect(rocAuc([1, 2, 2, 3], [false, false, true, true])).toBeCloseTo(0.875, CLOSE)
  })

  it('ROC AUC is null when only one class is present', () => {
    expect(rocAuc([0.1, 0.2], [true, true])).toBeNull()
    expect(rocAuc([0.1, 0.2], [false, false])).toBeNull()
  })

  it('ROC AUC is invariant to any monotone rescaling of the score', () => {
    const y = [false, true, false, true, true]
    const s = [0.1, 0.6, 0.3, 0.8, 0.7]
    expect(rocAuc(s.map(x => x ** 3), y)).toBe(rocAuc(s, y))
    expect(rocAuc(s.map(x => 100 * x + 7), y)).toBe(rocAuc(s, y))
  })
})

describe('calibration', () => {
  it('a perfectly calibrated forecast has ECE 0', () => {
    // 100 samples at p = 0.7, exactly 70 of which are positive.
    const p = Array(100).fill(0.7)
    const y = [...Array(70).fill(true), ...Array(30).fill(false)]
    const c = calibration(p, y, { bins: 10 })
    expect(c.ece).toBeCloseTo(0, CLOSE)
    expect(c.mce).toBeCloseTo(0, CLOSE)
  })

  it('ECE equals the miscalibration when it is uniform', () => {
    // 100 samples at p = 0.9, only 50 positive → |0.5 − 0.9| = 0.4 in one bin.
    const p = Array(100).fill(0.9)
    const y = [...Array(50).fill(true), ...Array(50).fill(false)]
    const c = calibration(p, y, { bins: 10 })
    expect(c.ece).toBeCloseTo(0.4, CLOSE)
    expect(c.mce).toBeCloseTo(0.4, CLOSE)
  })

  it('bin counts sum to n and hits sum to the positives', () => {
    const p = Array.from({ length: 500 }, (_, i) => (i % 100) / 100)
    const y = p.map((v, i) => (i * 7919) % 100 < v * 100)
    const c = calibration(p, y, { bins: 10 })
    expect(c.bins.reduce((a, b) => a + b.n, 0)).toBe(500)
    expect(c.bins.reduce((a, b) => a + b.hits, 0)).toBe(y.filter(Boolean).length)
  })

  it('p = 1 lands in the top bin rather than falling out of every bin', () => {
    const c = calibration([1, 1, 1], [true, true, false], { bins: 10 })
    expect(c.bins[c.bins.length - 1].n).toBe(3)
    expect(c.bins.reduce((a, b) => a + b.n, 0)).toBe(3)
  })

  it('uses the MEAN PREDICTED probability, not the bin midpoint', () => {
    // Two samples at 0.81 in the [0.8, 0.9) bin, both positive.
    // Against the mean (0.81) the error is 0.19; against the midpoint (0.85)
    // it would be 0.15. The mean is the correct attribution.
    const c = calibration([0.81, 0.81], [true, true], { bins: 10, minBinCount: 1 })
    const bin = c.bins.find(b => b.n > 0)!
    expect(bin.meanPredicted).toBeCloseTo(0.81, CLOSE)
    expect(c.ece).toBeCloseTo(0.19, CLOSE)
  })

  it('empty bins are reported as empty, not as zero-accuracy', () => {
    const c = calibration([0.05, 0.05], [true, false], { bins: 10 })
    expect(c.bins[0].n).toBe(2)
    for (const b of c.bins.slice(1)) {
      expect(b.n).toBe(0)
      expect(b.observedFrequency).toBeNull()
      expect(b.meanPredicted).toBeNull()
    }
  })

  it('MCE ignores bins below the minimum count', () => {
    // 200 well-calibrated samples at 0.5, plus one wild sample at 0.99.
    const p = [...Array(200).fill(0.5), 0.99]
    const y = [...Array(100).fill(true), ...Array(100).fill(false), false]
    const loose = calibration(p, y, { bins: 10, minBinCount: 1 })
    const strict = calibration(p, y, { bins: 10, minBinCount: 10 })
    expect(loose.mce).toBeCloseTo(0.99, CLOSE)
    expect(strict.mce).toBeCloseTo(0, CLOSE)
  })

  it('equal-width edges cut [0,1] evenly', () => {
    expect(binEdges([], 4, 'equal-width')).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it('quantile edges collapse duplicates rather than emitting zero-width bins', () => {
    // Every value identical → all interior quantiles coincide.
    const edges = binEdges(Array(100).fill(0.6), 10, 'quantile')
    expect(edges).toEqual([0, 0.6, 1])
    expect(new Set(edges).size).toBe(edges.length)
  })
})

describe('trading primitives', () => {
  it('max drawdown of a hand-traced increment series', () => {
    // increments  +3, −1, −1, +2, −5, +1
    // cumulative   3,  2,  1,  3, −2, −1     peaks 3,3,3,3,3,3
    // drawdowns    0,  1,  2,  0,  5,  4  → max 5
    expect(maxDrawdown([3, -1, -1, 2, -5, 1]).maxDrawdown).toBe(5)
  })

  it('max drawdown is 0 for a monotonically rising curve', () => {
    expect(maxDrawdown([1, 1, 1, 1]).maxDrawdown).toBe(0)
  })

  it('max drawdown measures from the running peak, not from the start', () => {
    // +10 then −4: the peak is 10, the trough 6, so the drawdown is 4.
    expect(maxDrawdown([10, -4]).maxDrawdown).toBe(4)
  })

  it('downside deviation divides by N, not by the count of negatives', () => {
    // rs = [1, 1, 1, −2].  Σ min(r,0)² = 4.  N = 4 → sqrt(1) = 1.
    // Dividing by the 1 negative would give sqrt(4) = 2 — the common error.
    expect(downsideDeviation([1, 1, 1, -2], 0)).toBeCloseTo(1, CLOSE)
  })

  it('downside deviation is 0 when nothing falls below the MAR', () => {
    expect(downsideDeviation([1, 2, 3], 0)).toBe(0)
  })

  it('downside deviation respects a non-zero minimum acceptable return', () => {
    // rs = [1, 2], MAR = 3 → deviations −2, −1 → sqrt((4+1)/2)
    expect(downsideDeviation([1, 2], 3)).toBeCloseTo(Math.sqrt(2.5), CLOSE)
  })
})
