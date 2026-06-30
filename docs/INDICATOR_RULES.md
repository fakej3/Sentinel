# Sentinel — Indicator Rules

This document defines every technical indicator used by the platform.
Each indicator includes its purpose, calculation method, interpretation, limitations, and dependencies.
New indicators must be documented here before implementation.

---

## 1. EMA — Exponential Moving Average

**Purpose:**
Tracks the average price over a period, giving more weight to recent prices. Used to identify trend direction and dynamic support/resistance.

**Periods used:** 20, 50, 100, 200

**Calculation:**
```
Multiplier = 2 / (period + 1)
EMA(today) = (Close(today) × Multiplier) + (EMA(yesterday) × (1 − Multiplier))
```
Seed: EMA starts with a simple average of the first N candles.

**Interpretation:**
- Price above EMA → bullish bias for that timeframe.
- Price below EMA → bearish bias for that timeframe.
- EMA20 < EMA50 < EMA100 < EMA200 with price below all → strong downtrend.
- EMA20 > EMA50 > EMA100 > EMA200 with price above all → strong uptrend.

**Limitations:**
- Lagging indicator. Reacts after price has already moved.
- In choppy/ranging markets, EMAs cross frequently and produce false signals.
- Not reliable alone for entries or exits.

**Dependencies:** Closing prices only.

---

## 2. SMA — Simple Moving Average

**Purpose:**
Equal-weight average of closing prices. Less reactive to recent price than EMA. Used as a baseline reference.

**Periods used:** 20, 50, 200 (configurable)

**Calculation:**
```
SMA = Sum(Close, N) / N
```

**Interpretation:**
- Slower-moving than EMA.
- The 200 SMA is widely watched as a long-term trend indicator.
- Price above 200 SMA → long-term bullish.
- Price below 200 SMA → long-term bearish.

**Limitations:**
- More lag than EMA.
- All data points weighted equally — old data has the same influence as recent.

**Dependencies:** Closing prices only.

---

## 3. RSI — Relative Strength Index

**Purpose:**
Measures the speed and magnitude of price changes. Identifies overbought and oversold conditions and momentum shifts.

**Period:** 14

**Calculation:**
```
RS = Average Gain(14) / Average Loss(14)
RSI = 100 − (100 / (1 + RS))
```
Uses Wilder's smoothing method (exponential smoothing with α = 1/14).

**Interpretation:**

| Range | Label |
|-------|-------|
| < 30 | Oversold |
| 30–45 | Weak / Bearish Momentum |
| 45–55 | Neutral |
| 55–70 | Healthy Bullish Momentum |
| > 70 | Overbought |

Divergence rules are defined in `ENGINE_RULES.md`.

**Limitations:**
- Can stay overbought for extended periods in strong trends.
- Not a timing tool — price can remain at extremes.
- Divergence signals are early warnings, not triggers.

**Dependencies:** Closing prices, 14-period lookback.

---

## 4. MACD — Moving Average Convergence Divergence

**Purpose:**
Measures the relationship between two EMAs to identify momentum shifts, trend direction, and crossover signals.

**Parameters:** EMA(12), EMA(26), Signal EMA(9)

**Calculation:**
```
MACD Line = EMA(12) − EMA(26)
Signal Line = EMA(9) of MACD Line
Histogram = MACD Line − Signal Line
```

**Interpretation:**
- MACD above Signal line → bullish momentum.
- MACD below Signal line → bearish momentum.
- Histogram increasing → momentum strengthening.
- Histogram decreasing → momentum weakening.
- Crossover above zero line → stronger bullish signal.
- Crossover below zero line → stronger bearish signal.

**Limitations:**
- Lagging indicator — does not predict, confirms.
- Zero-line crossovers can be delayed in slow markets.
- Works best in trending markets. Unreliable in ranging conditions.

**Dependencies:** EMA(12), EMA(26), EMA(9).

---

## 5. ATR — Average True Range

**Purpose:**
Measures market volatility. Does not indicate direction — only the size of price moves.

**Period:** 14

**Calculation:**
```
True Range = max(High − Low, |High − PrevClose|, |Low − PrevClose|)
ATR = Wilder Smoothing of True Range over 14 periods
```

**Interpretation:**
- Higher ATR → more volatile market.
- Lower ATR → calmer, tighter price action.
- ATR relative to price (%) is more meaningful than absolute value.
- Sudden ATR spike → volatility event (news, liquidation, breakout).

**Limitations:**
- Does not indicate direction.
- Cannot be used alone for any market conclusion.

**Dependencies:** OHLC data, 14-period lookback.

---

## 6. ADX — Average Directional Index

**Purpose:**
Measures trend strength regardless of direction. Used to determine whether a market is trending or ranging.

**Period:** 14

**Calculation:**
```
+DM = max(High − PrevHigh, 0)
−DM = max(PrevLow − Low, 0)
+DI = 100 × (Smoothed +DM / ATR)
−DI = 100 × (Smoothed −DM / ATR)
DX = 100 × |+DI − −DI| / (+DI + −DI)
ADX = Smoothed DX over 14 periods
```

**Interpretation:**

| ADX | Trend Strength |
|-----|---------------|
| < 20 | No trend / Weak |
| 20–25 | Emerging trend |
| 25–40 | Strong trend |
| 40–60 | Very strong trend |
| > 60 | Extreme (rare) |

+DI > −DI → Bullish direction.
−DI > +DI → Bearish direction.

**Limitations:**
- Does not indicate reversal.
- Lags — shows strength after trend begins.
- Only meaningful when combined with DI lines.

**Dependencies:** OHLC data, ATR.

---

## 7. VWAP — Volume Weighted Average Price

**Purpose:**
Shows the average price weighted by volume. Used as a benchmark for fair value during the session.

**Calculation:**
```
Typical Price = (High + Low + Close) / 3
VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
```
Resets at the beginning of each session (daily VWAP) or calculated rolling.

**Interpretation:**
- Price above VWAP → buyers have been in control on average.
- Price below VWAP → sellers have been in control on average.
- VWAP acts as dynamic intraday support/resistance.

**Limitations:**
- Most meaningful on intraday timeframes (1m–1h).
- On higher timeframes (4h, 1D), rolling VWAP is used but carries less institutional weight.
- Resets daily — not directly comparable across sessions.

**Dependencies:** HLC and volume data.

---

## 8. Bollinger Bands

**Purpose:**
Shows price volatility by placing bands at statistical standard deviations from a moving average. Identifies overbought/oversold conditions and volatility states.

**Parameters:** SMA(20), ±2 standard deviations

**Calculation:**
```
Middle Band = SMA(20)
Standard Deviation = sqrt(sum((Close − SMA)² / 20))
Upper Band = SMA(20) + (2 × StdDev)
Lower Band = SMA(20) − (2 × StdDev)
```

**Interpretation:**
- Price at upper band → statistically extended. Not a sell signal alone.
- Price at lower band → statistically compressed. Not a buy signal alone.
- Band squeeze (contracting) → low volatility; expansion likely.
- Band expansion → increasing volatility; trend accelerating.
- Price walking the upper band → strong uptrend.
- Price walking the lower band → strong downtrend.

**Limitations:**
- Standard deviations assume normal distribution of prices — not always true.
- Band touch alone is not a signal.
- Requires RSI and volume confirmation.

**Dependencies:** Closing prices, SMA(20).

---

## 9. Stochastic RSI

**Purpose:**
An oscillator applied to RSI values to generate faster overbought/oversold signals than RSI alone.

**Parameters:** RSI Period: 14, Stochastic Period: 14, %K Smoothing: 3, %D Smoothing: 3

**Calculation:**
```
StochRSI = (RSI − Lowest RSI(14)) / (Highest RSI(14) − Lowest RSI(14))
%K = SMA(StochRSI, 3)
%D = SMA(%K, 3)
```

**Interpretation:**

| Range | Classification |
|-------|----------------|
| < 0.20 | Oversold |
| 0.20–0.80 | Neutral |
| > 0.80 | Overbought |

- %K crosses above %D below 0.20 → Bullish crossover signal.
- %K crosses below %D above 0.80 → Bearish crossover signal.

**Limitations:**
- Very sensitive — produces many false signals in ranging markets.
- Must be confirmed by price action and RSI.
- Not reliable as a standalone indicator.

**Dependencies:** RSI values.

---

## 10. OBV — On-Balance Volume

**Purpose:**
Tracks cumulative buying and selling pressure using volume direction. Confirms or challenges price trends.

**Calculation:**
```
If Close > PrevClose: OBV = PrevOBV + Volume
If Close < PrevClose: OBV = PrevOBV − Volume
If Close = PrevClose: OBV = PrevOBV
```

**Interpretation:**
- OBV rising with price → bullish confirmation (volume supports move).
- OBV falling with rising price → bearish divergence (volume not supporting).
- OBV rising with falling price → bullish divergence (accumulation).
- OBV absolute value is meaningless — only the trend direction matters.

**Limitations:**
- A single high-volume candle can distort OBV significantly.
- Does not account for intraday volume distribution.

**Dependencies:** Closing prices and volume.

---

## 11. MFI — Money Flow Index

**Purpose:**
A volume-weighted RSI that measures buying and selling pressure over time.

**Period:** 14

**Calculation:**
```
Typical Price = (High + Low + Close) / 3
Raw Money Flow = Typical Price × Volume
Positive MF: if Typical Price > Previous Typical Price
Negative MF: if Typical Price < Previous Typical Price
Money Flow Ratio = Sum(Positive MF, 14) / Sum(Negative MF, 14)
MFI = 100 − (100 / (1 + Money Flow Ratio))
```

**Interpretation:**

| MFI | Classification |
|-----|----------------|
| < 20 | Oversold (with volume confirmation) |
| 20–40 | Weak buying pressure |
| 40–60 | Neutral |
| 60–80 | Healthy buying pressure |
| > 80 | Overbought (with volume) |

**Limitations:**
- Like RSI, can stay at extremes in strong trends.
- Less reliable in low-volume environments.

**Dependencies:** OHLC data and volume.

---

## 12. CCI — Commodity Channel Index

**Purpose:**
Measures the deviation of price from its statistical average. Identifies cyclical turns and overbought/oversold levels.

**Period:** 20

**Calculation:**
```
Typical Price = (High + Low + Close) / 3
Mean TP = SMA(Typical Price, 20)
Mean Deviation = SMA(|Typical Price − Mean TP|, 20)
CCI = (Typical Price − Mean TP) / (0.015 × Mean Deviation)
```

**Interpretation:**

| CCI | Classification |
|-----|----------------|
| < −100 | Oversold / Bearish extreme |
| −100 to 0 | Bearish territory |
| 0 to +100 | Bullish territory |
| > +100 | Overbought / Bullish extreme |

**Limitations:**
- Unbounded indicator — no fixed maximum.
- Works best in cyclical markets.

**Dependencies:** HLC data.

---

## 13. Volume Moving Average

**Purpose:**
A moving average of volume used to determine whether current volume is above or below the historical norm.

**Period:** 20

**Calculation:**
```
Volume MA = SMA(prior 20 volumes, excluding current bar)
Relative Volume = Current Volume / Volume MA
```

The moving average is computed from the **prior `period` bars only** — the current
bar is excluded. This ensures `relativeVolume` compares the current bar against an
uncontaminated historical baseline.

Minimum input: `period + 1` volumes (e.g., 21 for the default period of 20).
Returns `null` when insufficient data.

**Interpretation:**
- Relative Volume > 1.5 → strong participation.
- Relative Volume < 0.7 → weak participation.
- Trend is confirmed when relative volume supports the price direction.

**Limitations:**
- Minimum input is `period + 1`, not `period`. A caller with exactly 20 volumes
  will receive `null`.

**Dependencies:** Volume data.

---

## Future Indicators (Planned)

These will be documented here before implementation:

- Fibonacci Retracement Levels
- Trendline Detection (angle and touch count)
- Liquidity Zone Mapping
- Order Block Detection
- Fair Value Gap (FVG) Detection
- Volume Profile (VPVR / VPSV)
- Ichimoku Cloud
- Pivot Point Clusters

---

*Last updated: Module 4 Stabilization (post-audit v0.2)*
