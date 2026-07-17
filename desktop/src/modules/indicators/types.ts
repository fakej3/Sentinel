export interface MACDResult {
  macdLine: number
  signalLine: number
  histogram: number
  /**
   * Histogram value from the previous bar (n−1).
   * null when the signal series has only one value (exactly 34 closes — minimum for MACD).
   * ENGINE_RULES.md §4: macdBullish requires histogram > previousHistogram.
   * When null, the increasing check cannot be verified and macdBullish is false.
   */
  previousHistogram: number | null
  bias: 'bullish' | 'bearish' | 'neutral'
}

export interface ADXResult {
  adx: number
  diPlus: number
  diMinus: number
}

export interface BollingerResult {
  upper: number
  middle: number
  lower: number
  bandwidth: number
}

export interface StochRSIResult {
  k: number
  d: number
}

export interface VolumeMaResult {
  ma: number
  relativeVolume: number
}

export interface IndicatorResult {
  ema20: number | null
  ema50: number | null
  ema100: number | null
  ema200: number | null
  sma20: number | null
  sma50: number | null
  sma200: number | null
  rsi: number | null
  macd: MACDResult | null
  atr: number | null
  atrPercent: number | null
  adx: ADXResult | null
  vwap: number
  bollingerBands: BollingerResult | null
  stochRsi: StochRSIResult | null
  obv: number
  mfi: number | null
  cci: number | null
  volumeMA: VolumeMaResult | null
}
