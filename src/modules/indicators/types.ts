export interface MACDResult {
  macdLine: number
  signalLine: number
  histogram: number
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
