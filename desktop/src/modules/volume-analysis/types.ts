export type VolumeClassification = 'very_low' | 'low' | 'normal' | 'high' | 'very_high'
export type VolumeTrendDirection = 'increasing' | 'decreasing' | 'flat'
export type DominantSide = 'buyers' | 'sellers' | 'balanced'
export type AccDistState = 'accumulation' | 'distribution' | 'neutral'
export type OBVDirection = 'bullish' | 'bearish' | 'neutral'

export interface RelativeVolumeResult {
  /** Raw volume of the current candle */
  current: number
  /** Mean volume of the prior `relativeVolumePeriod` candles (current bar excluded) */
  average: number
  /** current / average; 0 when average is 0 */
  ratio: number
  classification: VolumeClassification
}

export interface VolumeTrendResult {
  direction: VolumeTrendDirection
  /**
   * 0–10 score representing how consistently the volume is trending.
   * Derived from R² of the linear regression over the trend window.
   */
  confidence: number
  evidence: string[]
}

export interface BuySellPressureResult {
  /** Sum of takerBuyVolume over the pressure window */
  buyVolume: number
  /** Sum of takerSellVolume over the pressure window */
  sellVolume: number
  /** buyVolume − sellVolume */
  delta: number
  /** (delta / totalVolume) × 100; 0 when totalVolume is 0 */
  deltaPercent: number
  dominantSide: DominantSide
}

export interface VolumeConfirmationResult {
  /** True when current relative volume ≥ confirmationThreshold */
  confirmed: boolean
  /** Human-readable explanation of why volume is or is not confirmed */
  reason: string
  /** Volume confirmed AND current market trend is not ranging */
  supportsTrend: boolean
  /** breakout.confirmed AND current volume ≥ confirmationThreshold */
  supportsBreakout: boolean
  /** The most recent BOS candle had volume ≥ confirmationThreshold × its prior average */
  supportsBOS: boolean
  /** The most recent CHOCH candle had volume ≥ confirmationThreshold × its prior average */
  supportsCHOCH: boolean
}

export interface ClimaxResult {
  /**
   * Bullish climax: high-volume candle + large bullish body + price at/near multi-bar high.
   * Signals strong buying — but also a potential exhaustion reversal.
   */
  buyingClimax: boolean
  /**
   * Bearish climax: high-volume candle + large bearish body + price at/near multi-bar low.
   * Signals strong selling — but also a potential exhaustion reversal.
   */
  sellingClimax: boolean
  /**
   * High-volume candle with a small body (close ≈ open).
   * Supply and demand are in equilibrium — potential trend pause or reversal.
   */
  exhaustion: boolean
}

export interface AccumulationDistributionResult {
  state: AccDistState
  /**
   * Composite score from −10 (pure distribution) to +10 (pure accumulation).
   * Each detected signal contributes ±1 or ±2 depending on weight.
   */
  score: number
}

export interface OBVAnalysisResult {
  /** Direction of the local OBV trend over the trend window */
  direction: OBVDirection
  /** OBV and price are trending in the same direction */
  confirmingPrice: boolean
  /** OBV and price are trending in opposite directions */
  diverging: boolean
}

export interface VWAPAnalysisResult {
  /** Current price is above the rolling VWAP */
  above: boolean
  /** Current price is below the rolling VWAP */
  below: boolean
  /** (currentPrice − vwap) / vwap × 100 */
  distancePercent: number
  /**
   * Price has crossed VWAP recently (within last 5 candles) OR is within 0.5% of VWAP.
   * Indicates price is using VWAP as a reference / mean-reversion level.
   */
  respectingVWAP: boolean
}

export interface VolumeAnalysisResult {
  volumeTrend: VolumeTrendResult
  relativeVolume: RelativeVolumeResult
  buySellPressure: BuySellPressureResult
  volumeConfirmation: VolumeConfirmationResult
  climax: ClimaxResult
  accumulationDistribution: AccumulationDistributionResult
  obvAnalysis: OBVAnalysisResult
  vwapAnalysis: VWAPAnalysisResult
  /** 0–10 composite volume strength score */
  overallStrength: number
  /** Human-readable factual strings explaining every conclusion */
  evidence: string[]
}

export interface VolumeAnalysisConfig {
  /** Prior bars used for the relative-volume average. Default: 20 */
  relativeVolumePeriod: number
  /** Relative volume thresholds for classification */
  relativeVolumeVeryLow: number   // < 0.5
  relativeVolumeLow: number       // < 0.7
  relativeVolumeHigh: number      // >= 1.5
  relativeVolumeVeryHigh: number  // >= 2.5
  /** Candles to include in the linear-regression volume trend. Default: 10 */
  volumeTrendWindow: number
  /**
   * Normalised slope below which the volume trend is classified as flat.
   * Computed as |slope / meanVolume|. Default: 0.01 (1% per candle of mean).
   */
  volumeSlopeThreshold: number
  /** Candles to aggregate for buy/sell pressure and accumulation signals. Default: 10 */
  pressureWindow: number
  /**
   * |deltaPercent| below this value → dominantSide = 'balanced'.
   * Default: 10.0 (within 10% of total volume is considered balanced).
   */
  pressureBalanceThreshold: number
  /**
   * Minimum relative volume to count as volume "confirmation".
   * Default: 1.2 (20% above average).
   */
  confirmationThreshold: number
  /**
   * Relative volume required to flag a climax candle.
   * Default: 2.0 (2× the prior average).
   */
  climaxThreshold: number
  /**
   * body/range must be ≥ this to qualify as a large-body candle (climax).
   * Default: 0.6 (body covers 60% of the high–low range).
   */
  climaxBodyRatio: number
  /**
   * body/range must be ≤ this to qualify as exhaustion.
   * Default: 0.3 (body covers 30% or less of the range).
   */
  exhaustionBodyRatio: number
  /**
   * Absolute value of distancePercent below which price is considered "at VWAP".
   * Default: 0.5 (within 0.5% of VWAP = respecting VWAP).
   */
  vwapProximityPercent: number
}
