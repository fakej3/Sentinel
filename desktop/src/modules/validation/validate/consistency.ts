import type { MarketAnalysisResult } from '../../analysis/types'
import type { VWAPAnalysisResult } from '../../volume-analysis/types'
import type { ValidationIssue, ValidationConfig } from '../types'
import { classifyRSI } from '../../analysis/compute/indicators'

function critical(field: string, message: string, expected: string, actual: string): ValidationIssue {
  return { severity: 'critical', category: 'consistency', field, message, expected, actual }
}

/**
 * Structural equality for the VWAP union. Written out rather than deep-equalled
 * so that adding a field to VWAPAnalysisResult is a compile error here — a
 * silently unchecked field is exactly the gap that let volumeContext drift from
 * vwapAnalysis before.
 */
function vwapContextMatches(a: VWAPAnalysisResult, b: VWAPAnalysisResult): boolean {
  if (a.available !== b.available) return false
  if (a.available && b.available) {
    return a.value === b.value
      && a.side === b.side
      && a.distancePercent === b.distancePercent
      && a.respectingVWAP === b.respectingVWAP
  }
  if (!a.available && !b.available) {
    return a.unavailable.code === b.unavailable.code
      && a.unavailable.detail === b.unavailable.detail
  }
  return false
}

export function checkConsistency(
  result: MarketAnalysisResult,
  cfg: ValidationConfig,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const { indicators, marketStructure, supportResistance, volumeAnalysis } = result
  const { conditions } = result.fullTrend
  const price = result.price.current

  // ── EMA price conditions vs raw indicator values ───────────────────────────

  function checkEMAAboveBelow(
    ema: number | null,
    period: number,
    above: boolean,
    below: boolean,
  ): void {
    const p = period
    if (ema !== null) {
      const expectedAbove = price > ema
      if (above !== expectedAbove) {
        issues.push(critical(
          `fullTrend.conditions.priceAboveEMA${p}`,
          `priceAboveEMA${p} is ${above} but price (${price}) vs EMA${p} (${ema}) implies ${expectedAbove}`,
          String(expectedAbove), String(above),
        ))
      }
      const expectedBelow = price < ema
      if (below !== expectedBelow) {
        issues.push(critical(
          `fullTrend.conditions.priceBelowEMA${p}`,
          `priceBelowEMA${p} is ${below} but price (${price}) vs EMA${p} (${ema}) implies ${expectedBelow}`,
          String(expectedBelow), String(below),
        ))
      }
    } else {
      if (above) {
        issues.push(critical(
          `fullTrend.conditions.priceAboveEMA${p}`,
          `priceAboveEMA${p} is true but EMA${p} is null`,
          'false', 'true',
        ))
      }
      if (below) {
        issues.push(critical(
          `fullTrend.conditions.priceBelowEMA${p}`,
          `priceBelowEMA${p} is true but EMA${p} is null`,
          'false', 'true',
        ))
      }
    }
  }

  checkEMAAboveBelow(indicators.ema20, 20, conditions.priceAboveEMA20, conditions.priceBelowEMA20)
  checkEMAAboveBelow(indicators.ema50, 50, conditions.priceAboveEMA50, conditions.priceBelowEMA50)
  checkEMAAboveBelow(indicators.ema100, 100, conditions.priceAboveEMA100, conditions.priceBelowEMA100)
  checkEMAAboveBelow(indicators.ema200, 200, conditions.priceAboveEMA200, conditions.priceBelowEMA200)

  // ── EMA stack order ────────────────────────────────────────────────────────

  // The stack conditions degrade gracefully: they are evaluated over whichever
  // EMAs are available (fast→slow), requiring at least two so a single line
  // cannot masquerade as a "stack". These checks mirror that contract exactly.
  // When all four EMAs are present this is identical to the previous
  // all-or-nothing rule; with 2–3 present it validates the degraded form
  // rather than declaring correct output a critical inconsistency.
  const availableEmas: Array<[number, number]> = ([
    [20,  indicators.ema20],
    [50,  indicators.ema50],
    [100, indicators.ema100],
    [200, indicators.ema200],
  ] as Array<[number, number | null]>)
    .filter((e): e is [number, number] => e[1] !== null)

  const emaLabel = availableEmas.map(([p]) => `EMA${p}`).join('>')

  if (availableEmas.length >= 2) {
    const values = availableEmas.map(([, v]) => v)

    const expectedBullishOrder = values.every((v, i) => i === 0 || values[i - 1] > v)
    if (conditions.emaInBullishOrder !== expectedBullishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBullishOrder',
        `emaInBullishOrder is ${conditions.emaInBullishOrder} but ${emaLabel} (available EMAs, descending) is ${expectedBullishOrder}`,
        String(expectedBullishOrder), String(conditions.emaInBullishOrder),
      ))
    }

    const expectedBearishOrder = values.every((v, i) => i === 0 || values[i - 1] < v)
    if (conditions.emaInBearishOrder !== expectedBearishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBearishOrder',
        `emaInBearishOrder is ${conditions.emaInBearishOrder} but ${emaLabel} (available EMAs, ascending) is ${expectedBearishOrder}`,
        String(expectedBearishOrder), String(conditions.emaInBearishOrder),
      ))
    }
  } else {
    // Fewer than two EMAs — "in order" is meaningless and must be false.
    if (conditions.emaInBullishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBullishOrder',
        'emaInBullishOrder is true but fewer than two EMAs are available',
        'false', 'true',
      ))
    }
    if (conditions.emaInBearishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBearishOrder',
        'emaInBearishOrder is true but fewer than two EMAs are available',
        'false', 'true',
      ))
    }
  }

  // ── Market structure conditions ────────────────────────────────────────────

  const { recentStructure } = marketStructure

  const expectedHHHL =
    recentStructure.higherHighs >= cfg.minBullishSwingsForTrend &&
    recentStructure.higherLows >= cfg.minBullishSwingsForTrend

  if (conditions.hasConsistentHHHL !== expectedHHHL) {
    issues.push(critical(
      'fullTrend.conditions.hasConsistentHHHL',
      `hasConsistentHHHL is ${conditions.hasConsistentHHHL} but recent HH=${recentStructure.higherHighs}, HL=${recentStructure.higherLows} (min=${cfg.minBullishSwingsForTrend}) implies ${expectedHHHL}`,
      String(expectedHHHL), String(conditions.hasConsistentHHHL),
    ))
  }

  const expectedLHLL =
    recentStructure.lowerHighs >= cfg.minBearishSwingsForTrend &&
    recentStructure.lowerLows >= cfg.minBearishSwingsForTrend

  if (conditions.hasConsistentLHLL !== expectedLHLL) {
    issues.push(critical(
      'fullTrend.conditions.hasConsistentLHLL',
      `hasConsistentLHLL is ${conditions.hasConsistentLHLL} but recent LH=${recentStructure.lowerHighs}, LL=${recentStructure.lowerLows} (min=${cfg.minBearishSwingsForTrend}) implies ${expectedLHLL}`,
      String(expectedLHLL), String(conditions.hasConsistentLHLL),
    ))
  }

  // ── RSI conditions ────────────────────────────────────────────────────────

  const rawRsi = indicators.rsi

  if (rawRsi !== null) {
    const expectedBullRsi = rawRsi >= cfg.rsiBullishMin
    if (conditions.rsiSupportsBullish !== expectedBullRsi) {
      issues.push(critical(
        'fullTrend.conditions.rsiSupportsBullish',
        `rsiSupportsBullish is ${conditions.rsiSupportsBullish} but RSI=${rawRsi} >= ${cfg.rsiBullishMin} is ${expectedBullRsi}`,
        String(expectedBullRsi), String(conditions.rsiSupportsBullish),
      ))
    }
    const expectedBearRsi = rawRsi <= cfg.rsiBearishMax
    if (conditions.rsiSupportsBearish !== expectedBearRsi) {
      issues.push(critical(
        'fullTrend.conditions.rsiSupportsBearish',
        `rsiSupportsBearish is ${conditions.rsiSupportsBearish} but RSI=${rawRsi} <= ${cfg.rsiBearishMax} is ${expectedBearRsi}`,
        String(expectedBearRsi), String(conditions.rsiSupportsBearish),
      ))
    }
    const expectedNeutral = rawRsi >= cfg.rsiNeutralLow && rawRsi <= cfg.rsiNeutralHigh
    if (conditions.rsiInNeutralRange !== expectedNeutral) {
      issues.push(critical(
        'fullTrend.conditions.rsiInNeutralRange',
        `rsiInNeutralRange is ${conditions.rsiInNeutralRange} but RSI=${rawRsi} in [${cfg.rsiNeutralLow},${cfg.rsiNeutralHigh}] is ${expectedNeutral}`,
        String(expectedNeutral), String(conditions.rsiInNeutralRange),
      ))
    }
  } else {
    if (conditions.rsiSupportsBullish) {
      issues.push(critical('fullTrend.conditions.rsiSupportsBullish', 'rsiSupportsBullish is true but RSI is null', 'false', 'true'))
    }
    if (conditions.rsiSupportsBearish) {
      issues.push(critical('fullTrend.conditions.rsiSupportsBearish', 'rsiSupportsBearish is true but RSI is null', 'false', 'true'))
    }
    if (conditions.rsiInNeutralRange) {
      issues.push(critical('fullTrend.conditions.rsiInNeutralRange', 'rsiInNeutralRange is true but RSI is null', 'false', 'true'))
    }
  }

  // ── MACD conditions ───────────────────────────────────────────────────────

  if (indicators.macd !== null) {
    const { macdLine, signalLine } = indicators.macd
    const expectedMacdBullish = macdLine > signalLine
    if (conditions.macdBullish !== expectedMacdBullish) {
      issues.push(critical(
        'fullTrend.conditions.macdBullish',
        `macdBullish is ${conditions.macdBullish} but rule (macdLine > signalLine) gives ${expectedMacdBullish}`,
        String(expectedMacdBullish), String(conditions.macdBullish),
      ))
    }
    const expectedMacdBearish = macdLine < signalLine
    if (conditions.macdBearish !== expectedMacdBearish) {
      issues.push(critical(
        'fullTrend.conditions.macdBearish',
        `macdBearish is ${conditions.macdBearish} but rule (macdLine < signalLine) gives ${expectedMacdBearish}`,
        String(expectedMacdBearish), String(conditions.macdBearish),
      ))
    }
  } else {
    if (conditions.macdBullish) {
      issues.push(critical('fullTrend.conditions.macdBullish', 'macdBullish is true but MACD is null', 'false', 'true'))
    }
    if (conditions.macdBearish) {
      issues.push(critical('fullTrend.conditions.macdBearish', 'macdBearish is true but MACD is null', 'false', 'true'))
    }
  }

  // ── ADX condition ──────────────────────────────────────────────────────────

  if (indicators.adx !== null) {
    const expectedAdxWeak = indicators.adx.adx < cfg.adxWeakThreshold
    if (conditions.adxBelowWeakThreshold !== expectedAdxWeak) {
      issues.push(critical(
        'fullTrend.conditions.adxBelowWeakThreshold',
        `adxBelowWeakThreshold is ${conditions.adxBelowWeakThreshold} but ADX=${indicators.adx.adx} < ${cfg.adxWeakThreshold} is ${expectedAdxWeak}`,
        String(expectedAdxWeak), String(conditions.adxBelowWeakThreshold),
      ))
    }
  } else {
    if (conditions.adxBelowWeakThreshold) {
      issues.push(critical('fullTrend.conditions.adxBelowWeakThreshold', 'adxBelowWeakThreshold is true but ADX is null', 'false', 'true'))
    }
  }

  // ── Derived compound conditions ────────────────────────────────────────────

  const expectedNoConsistentStructure = !conditions.hasConsistentHHHL && !conditions.hasConsistentLHLL
  if (conditions.noConsistentStructure !== expectedNoConsistentStructure) {
    issues.push(critical(
      'fullTrend.conditions.noConsistentStructure',
      `noConsistentStructure is ${conditions.noConsistentStructure} but !hasConsistentHHHL && !hasConsistentLHLL is ${expectedNoConsistentStructure}`,
      String(expectedNoConsistentStructure), String(conditions.noConsistentStructure),
    ))
  }

  // Mirrors the degraded contract: "between EMAs without clear order" needs
  // enough EMAs to judge (>=2), not all four.
  const expectedBetween =
    availableEmas.length >= 2 &&
    !conditions.priceAboveAllEMAs && !conditions.priceBelowAllEMAs &&
    !conditions.emaInBullishOrder && !conditions.emaInBearishOrder
  if (conditions.priceBetweenEMAsWithoutClearOrder !== expectedBetween) {
    issues.push(critical(
      'fullTrend.conditions.priceBetweenEMAsWithoutClearOrder',
      `priceBetweenEMAsWithoutClearOrder is ${conditions.priceBetweenEMAsWithoutClearOrder} but derived value is ${expectedBetween}`,
      String(expectedBetween), String(conditions.priceBetweenEMAsWithoutClearOrder),
    ))
  }

  // ── RSI classification vs raw RSI ─────────────────────────────────────────

  const rsiClassification = result.indicatorSummary.rsi.classification
  if (rawRsi !== null && rsiClassification !== 'unavailable') {
    const expectedClass = classifyRSI(rawRsi)

    if (rsiClassification !== expectedClass) {
      issues.push(critical(
        'indicatorSummary.rsi.classification',
        `RSI classification is '${rsiClassification}' but RSI=${rawRsi} maps to '${expectedClass}'`,
        expectedClass, rsiClassification,
      ))
    }
  }

  // ── MACD bias vs raw MACD ─────────────────────────────────────────────────

  const macdBias = result.indicatorSummary.macd.bias
  if (indicators.macd !== null && macdBias !== 'unavailable') {
    const { macdLine, signalLine } = indicators.macd
    const expectedBias =
      macdLine > signalLine ? 'bullish' :
      macdLine < signalLine ? 'bearish' : 'neutral'
    if (macdBias !== expectedBias) {
      issues.push(critical(
        'indicatorSummary.macd.bias',
        `MACD bias is '${macdBias}' but macdLine (${macdLine}) vs signalLine (${signalLine}) maps to '${expectedBias}'`,
        expectedBias, macdBias,
      ))
    }
  }

  // ── S/R context vs supportResistance ─────────────────────────────────────

  const currentZone = supportResistance.currentZone
  const expectedInsideSupport = currentZone !== null && currentZone.type === 'support'
  if (result.srContext.insideSupport !== expectedInsideSupport) {
    issues.push(critical(
      'srContext.insideSupport',
      `insideSupport is ${result.srContext.insideSupport} but currentZone type is '${currentZone?.type ?? 'null'}'`,
      String(expectedInsideSupport), String(result.srContext.insideSupport),
    ))
  }

  const expectedInsideResistance = currentZone !== null && currentZone.type === 'resistance'
  if (result.srContext.insideResistance !== expectedInsideResistance) {
    issues.push(critical(
      'srContext.insideResistance',
      `insideResistance is ${result.srContext.insideResistance} but currentZone type is '${currentZone?.type ?? 'null'}'`,
      String(expectedInsideResistance), String(result.srContext.insideResistance),
    ))
  }

  // ── Volume context vs volumeAnalysis ─────────────────────────────────────

  const vc = result.volumeContext
  const va = volumeAnalysis

  if (vc.relativeVolume !== va.relativeVolume.ratio) {
    issues.push(critical(
      'volumeContext.relativeVolume',
      `relativeVolume is ${vc.relativeVolume} but volumeAnalysis.relativeVolume.ratio is ${va.relativeVolume.ratio}`,
      String(va.relativeVolume.ratio), String(vc.relativeVolume),
    ))
  }

  if (vc.volumeClassification !== va.relativeVolume.classification) {
    issues.push(critical(
      'volumeContext.volumeClassification',
      `volumeClassification is '${vc.volumeClassification}' but volumeAnalysis says '${va.relativeVolume.classification}'`,
      va.relativeVolume.classification, vc.volumeClassification,
    ))
  }

  if (vc.confirmsCurrentMove !== va.volumeConfirmation.confirmed) {
    issues.push(critical(
      'volumeContext.confirmsCurrentMove',
      `confirmsCurrentMove is ${vc.confirmsCurrentMove} but volumeConfirmation.confirmed is ${va.volumeConfirmation.confirmed}`,
      String(va.volumeConfirmation.confirmed), String(vc.confirmsCurrentMove),
    ))
  }

  if (vc.accDistState !== va.accumulationDistribution.state) {
    issues.push(critical(
      'volumeContext.accDistState',
      `accDistState is '${vc.accDistState}' but accumulationDistribution.state is '${va.accumulationDistribution.state}'`,
      va.accumulationDistribution.state, vc.accDistState,
    ))
  }

  // volumeContext.vwap mirrors vwapAnalysis wholesale, so one structural
  // comparison replaces the three field-by-field checks this used to run. It is
  // also strictly stronger: the old checks could not detect a mismatch in
  // `available` or in the unavailability reason, because neither field existed
  // on volumeContext.
  if (!vwapContextMatches(vc.vwap, va.vwapAnalysis)) {
    issues.push(critical(
      'volumeContext.vwap',
      'volumeContext.vwap does not match vwapAnalysis',
      JSON.stringify(va.vwapAnalysis), JSON.stringify(vc.vwap),
    ))
  }

  if (vc.obvDirection !== va.obvAnalysis.direction) {
    issues.push(critical(
      'volumeContext.obvDirection',
      `obvDirection is '${vc.obvDirection}' but obvAnalysis.direction is '${va.obvAnalysis.direction}'`,
      va.obvAnalysis.direction, vc.obvDirection,
    ))
  }

  if (vc.obvConfirmingPrice !== va.obvAnalysis.confirmingPrice) {
    issues.push(critical(
      'volumeContext.obvConfirmingPrice',
      `obvConfirmingPrice is ${vc.obvConfirmingPrice} but obvAnalysis.confirmingPrice is ${va.obvAnalysis.confirmingPrice}`,
      String(va.obvAnalysis.confirmingPrice), String(vc.obvConfirmingPrice),
    ))
  }

  if (vc.overallStrength !== va.overallStrength) {
    issues.push(critical(
      'volumeContext.overallStrength',
      `overallStrength is ${vc.overallStrength} but volumeAnalysis.overallStrength is ${va.overallStrength}`,
      String(va.overallStrength), String(vc.overallStrength),
    ))
  }

  return issues
}
