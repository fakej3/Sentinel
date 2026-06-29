# Sentinel — Engine Rules

This document defines every market rule used by the analysis engine.
No logic in the engine should exist without a corresponding rule here.
Every rule must have documented reasoning.

---

## 1. Trend Rules

### Definition

Trend is determined by the combination of EMA alignment, market structure, and momentum. No single factor alone defines the trend.

### Bullish Trend — All of the following must be true:

| Condition | Rule |
|-----------|------|
| EMA Alignment | Price is above EMA20, EMA50, EMA100, and EMA200 |
| EMA Order | EMA20 > EMA50 > EMA100 > EMA200 |
| Market Structure | At least 2 consecutive Higher Highs AND Higher Lows |
| Momentum | RSI ≥ 45 |
| MACD | MACD line is above signal line |

If all 5 conditions are met → **Strong Bullish Trend**

If 3–4 conditions are met → **Moderate Bullish Bias**

If 1–2 conditions are met → **Weak Bullish Signal** (insufficient for trend declaration)

### Bearish Trend — All of the following must be true:

| Condition | Rule |
|-----------|------|
| EMA Alignment | Price is below EMA20, EMA50, EMA100, and EMA200 |
| EMA Order | EMA20 < EMA50 < EMA100 < EMA200 |
| Market Structure | At least 2 consecutive Lower Highs AND Lower Lows |
| Momentum | RSI ≤ 55 |
| MACD | MACD line is below signal line |

If all 5 conditions are met → **Strong Bearish Trend**

If 3–4 conditions are met → **Moderate Bearish Bias**

If 1–2 conditions are met → **Weak Bearish Signal**

### Neutral / Ranging Trend:

| Condition | Rule |
|-----------|------|
| Price | Between EMA20 and EMA200 without clear order |
| Structure | No consistent HH-HL or LH-LL sequence (≥ 3 swings) |
| RSI | Between 40 and 60 |
| ADX | Below 20 |

If 3 or more neutral conditions are met → **Ranging / Consolidation**

---

## 2. Market Structure Rules

### Swing Point Detection

A swing high is confirmed when:
- A candle's high is higher than the 2 candles to its left AND 2 candles to its right.

A swing low is confirmed when:
- A candle's low is lower than the 2 candles to its left AND 2 candles to its right.

Minimum lookback: 20 candles.

### Higher High (HH)
A swing high is higher than the previous confirmed swing high.

### Higher Low (HL)
A swing low is higher than the previous confirmed swing low.

### Lower High (LH)
A swing high is lower than the previous confirmed swing high.

### Lower Low (LL)
A swing low is lower than the previous confirmed swing low.

### Break of Structure (BOS)
Price closes above the most recent confirmed swing high (in a bullish sequence) or below the most recent confirmed swing low (in a bearish sequence).

BOS requires a **candle close** — not just a wick breach.

### Change of Character (CHOCH)
In an uptrend: price closes below the most recent confirmed swing low.
In a downtrend: price closes above the most recent confirmed swing high.

CHOCH signals a potential trend reversal. It does not confirm one.

### Consolidation
No new HH or LL for at least 5 consecutive swing points within a price range of ≤ 3% from high to low.

### Breakout
Price closes above confirmed resistance with volume ≥ 1.3× the 20-period volume average.

### Pullback
Price retraces toward the EMA20 or EMA50 after a BOS, without breaking structure.

---

## 3. RSI Rules

| Range | Classification |
|-------|----------------|
| < 30 | Oversold |
| 30–45 | Weak / Bearish Momentum |
| 45–55 | Neutral |
| 55–70 | Healthy Bullish Momentum |
| > 70 | Overbought |

### RSI Divergence Rules

**Bullish Divergence:** Price makes a Lower Low while RSI makes a Higher Low.
- Requires at least 2 swing lows to compare.
- Confidence reduction: −15 points from bearish confidence (or +15 from bullish confidence).

**Bearish Divergence:** Price makes a Higher High while RSI makes a Lower High.
- Requires at least 2 swing highs to compare.
- Confidence reduction: −20 points from bullish confidence.

---

## 4. MACD Rules

Calculation: EMA(12) − EMA(26); Signal = EMA(9) of MACD.

| Signal | Condition |
|--------|-----------|
| Bullish | MACD line > Signal line AND histogram is positive and increasing |
| Bearish | MACD line < Signal line AND histogram is negative and decreasing |
| Bullish Crossover | MACD line crosses above Signal line (current candle) |
| Bearish Crossover | MACD line crosses below Signal line (current candle) |
| Neutral | MACD and Signal are within 0.1% of each other |

MACD is a secondary confirmation. It does not define trend alone.

---

## 5. EMA Rules

| EMA | Role |
|-----|------|
| EMA20 | Short-term trend / dynamic support or resistance |
| EMA50 | Medium-term trend |
| EMA100 | Long-term momentum reference |
| EMA200 | Major long-term trend line |

**EMA Support Rule:**
Price is above EMA → EMA acts as dynamic support.

**EMA Resistance Rule:**
Price is below EMA → EMA acts as dynamic resistance.

**EMA Confluence:**
Multiple EMAs within 0.5% of each other = confluence zone. Treat as a single stronger level.

---

## 6. ATR Rules

ATR is used exclusively for volatility classification. It is never used for entries or exits.

| ATR Percentile (vs 30-day avg) | Classification |
|--------------------------------|----------------|
| < 70% | Low Volatility |
| 70%–130% | Normal Volatility |
| > 130% | High Volatility |
| > 200% | Extreme Volatility |

ATR is an absolute value and must be expressed as a percentage of current price when displayed.

---

## 7. ADX Rules

ADX measures trend strength, not direction.

| ADX Value | Classification |
|-----------|----------------|
| < 20 | Weak / No Trend |
| 20–25 | Emerging Trend |
| 25–40 | Strong Trend |
| 40–60 | Very Strong Trend |
| > 60 | Extreme Trend (rare) |

ADX must always be read alongside DI+ and DI− to determine direction.
If ADX < 20, trend-based conclusions should not be made with high confidence.

---

## 8. Volume Rules

### Classification

Volume is always compared against its 20-period moving average.

| Relative Volume | Classification |
|-----------------|----------------|
| < 0.7× | Very Low Volume |
| 0.7–0.9× | Below Average |
| 0.9–1.1× | Average |
| 1.1–1.5× | Above Average |
| 1.5–2.0× | Strong Volume |
| > 2.0× | Volume Spike |

### Volume Trend

- Increasing: Current volume MA is higher than 5 periods ago.
- Decreasing: Current volume MA is lower than 5 periods ago.
- Flat: Difference < 5%.

### Volume Confirmation

A price move is **confirmed** by volume if:
- Bullish move + volume > 1.2× average.
- Bearish move + volume > 1.2× average.

A price move is **unconfirmed** if:
- Volume < 0.9× average.

### Volume Exhaustion

Defined as: 3+ consecutive volume spikes followed by a sudden drop to below-average volume, without significant price progress. Signals potential reversal.

### Buying vs Selling Pressure (when data available)

If trade direction is available:
- Buy pressure = (buy volume / total volume) × 100
- Sell pressure = (sell volume / total volume) × 100
- > 60% buy pressure = Buyers in control
- > 60% sell pressure = Sellers in control
- 40–60% = Balanced

---

## 9. Bollinger Bands Rules

| Condition | Interpretation |
|-----------|----------------|
| Price touches upper band | Near overbought territory (not a sell signal alone) |
| Price touches lower band | Near oversold territory (not a buy signal alone) |
| Bands contracting | Consolidation. Breakout likely soon |
| Bands expanding | Volatility increasing. Trend accelerating |
| Price walks upper band | Strong uptrend |
| Price walks lower band | Strong downtrend |

Bollinger Bands must always be confirmed by RSI and volume.

---

## 10. Stochastic RSI Rules

| Range | Classification |
|-------|----------------|
| < 20 | Oversold |
| 20–80 | Neutral |
| > 80 | Overbought |

| Signal | Condition |
|--------|-----------|
| Bullish Crossover | %K crosses above %D while both below 20 |
| Bearish Crossover | %K crosses below %D while both above 80 |

StochRSI is a faster oscillator. Do not use it alone for trend conclusions.

---

## 11. Confidence Scoring Rules

The Confidence Score is a 0–10 value derived from evidence.
It represents the strength and consistency of supporting evidence — not a prediction of future price.

### Default Scoring Weights

| Factor | Points |
|--------|--------|
| Price above EMA200 | +15 |
| Higher High confirmed | +15 |
| Higher Low confirmed | +15 |
| Bullish MACD | +10 |
| RSI in 55–70 range | +8 |
| Strong volume confirmation | +12 |
| ADX above 25 | +8 |
| Bullish StochRSI crossover | +5 |
| Price above EMA50 | +7 |
| Price above EMA20 | +5 |
| Bullish OBV trend | +6 |
| Bearish RSI divergence | −20 |
| Strong resistance overhead | −10 |
| Below average volume on move | −8 |
| Overbought RSI (>70) | −10 |
| Price below EMA200 | −15 |
| Lower High confirmed | −15 |
| Lower Low confirmed | −15 |
| Bearish MACD | −10 |
| RSI in 30–45 range | −8 |
| Weak volume on breakout | −12 |
| Bullish RSI divergence | +15 |

### Score Normalization

Raw points are summed and normalized to a 0–10 scale.
Maximum theoretical positive score ≈ 106 points = 10.0
Scale: `score = min(10, max(0, rawPoints / 10.6))`

### Score Interpretation

| Score | Meaning |
|-------|---------|
| 0.0–3.0 | Weak evidence / unclear market |
| 3.0–5.0 | Mixed signals |
| 5.0–7.0 | Moderate confidence |
| 7.0–8.5 | Strong evidence |
| 8.5–10.0 | Very strong evidence alignment |

### Important

The Confidence Score is NOT a probability.
It is not a win rate.
It must never be presented as "X% chance of going up."
It is a measure of how many evidence factors align.

---

## 12. Support & Resistance Detection Rules

### Static Support Level
A price level that has acted as support (price bounced up from it) at least 2 times in the last 100 candles.
Tolerance: ±0.3% from the exact level.

### Static Resistance Level
A price level that has acted as resistance (price rejected downward) at least 2 times in the last 100 candles.
Tolerance: ±0.3% from the exact level.

### Pivot Zones
Classical pivot: `(High + Low + Close) / 3`
R1 = `(2 × Pivot) − Low`
S1 = `(2 × Pivot) − High`
R2 = `Pivot + (High − Low)`
S2 = `Pivot − (High − Low)`

### Level Strength Classification

| Touches | Classification |
|---------|----------------|
| 2 | Weak Level |
| 3–4 | Moderate Level |
| 5+ | Strong Level |

---

*Last updated: project initialization*
*Next update: when first engine module is implemented*
