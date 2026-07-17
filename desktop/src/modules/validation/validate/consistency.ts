import type { MarketAnalysisResult } from '../../analysis/types'
import type { ValidationIssue, ValidationConfig } from '../types'
import { classifyRSI } from '../../analysis/compute/indicators'

function critical(field: string, message: string, expected: string, actual: string): ValidationIssue {
  return { severity: 'critical', category: 'consistency', field, message, expected, actual }
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

  const allEMAsAvailable =
    indicators.ema20 !== null && indicators.ema50 !== null &&
    indicators.ema100 !== null && indicators.ema200 !== null

  if (allEMAsAvailable) {
    const e20 = indicators.ema20 as number
    const e50 = indicators.ema50 as number
    const e100 = indicators.ema100 as number
    const e200 = indicators.ema200 as number

    const expectedBullishOrder = e20 > e50 && e50 > e100 && e100 > e200
    if (conditions.emaInBullishOrder !== expectedBullishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBullishOrder',
        `emaInBullishOrder is ${conditions.emaInBullishOrder} but EMA20>50>100>200 is ${expectedBullishOrder}`,
        String(expectedBullishOrder), String(conditions.emaInBullishOrder),
      ))
    }

    const expectedBearishOrder = e20 < e50 && e50 < e100 && e100 < e200
    if (conditions.emaInBearishOrder !== expectedBearishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBearishOrder',
        `emaInBearishOrder is ${conditions.emaInBearishOrder} but EMA20<50<100<200 is ${expectedBearishOrder}`,
        String(expectedBearishOrder), String(conditions.emaInBearishOrder),
      ))
    }
  } else {
    if (conditions.emaInBullishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBullishOrder',
        'emaInBullishOrder is true but not all 4 EMAs are available',
        'false', 'true',
      ))
    }
    if (conditions.emaInBearishOrder) {
      issues.push(critical(
        'fullTrend.conditions.emaInBearishOrder',
        'emaInBearishOrder is true but not all 4 EMAs are available',
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

  const expectedBetween =
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

  if (vc.priceAboveVWAP !== va.vwapAnalysis.above) {
    issues.push(critical(
      'volumeContext.priceAboveVWAP',
      `priceAboveVWAP is ${vc.priceAboveVWAP} but vwapAnalysis.above is ${va.vwapAnalysis.above}`,
      String(va.vwapAnalysis.above), String(vc.priceAboveVWAP),
    ))
  }

  if (vc.vwapDistancePercent !== va.vwapAnalysis.distancePercent) {
    issues.push(critical(
      'volumeContext.vwapDistancePercent',
      `vwapDistancePercent is ${vc.vwapDistancePercent} but vwapAnalysis.distancePercent is ${va.vwapAnalysis.distancePercent}`,
      String(va.vwapAnalysis.distancePercent), String(vc.vwapDistancePercent),
    ))
  }

  if (vc.respectingVWAP !== va.vwapAnalysis.respectingVWAP) {
    issues.push(critical(
      'volumeContext.respectingVWAP',
      `respectingVWAP is ${vc.respectingVWAP} but vwapAnalysis.respectingVWAP is ${va.vwapAnalysis.respectingVWAP}`,
      String(va.vwapAnalysis.respectingVWAP), String(vc.respectingVWAP),
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
