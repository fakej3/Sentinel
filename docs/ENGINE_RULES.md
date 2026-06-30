# Sentinel — Engine Rules

This document defines every market rule used by the analysis engine.
No logic in the engine should exist without a corresponding rule here.
Every rule must have documented reasoning.

---

## 1. Trend Rules

### Definition

Full trend is determined by the combination of EMA alignment, market structure, and momentum. No single factor alone defines the trend.

**Structural bias** (output of Module 3 `MarketStructureResult.trend`) is a
swing-pattern classification only — it does not incorporate EMA alignment, RSI,
or MACD. The full trend determination described below is performed by the
Evidence Engine (Module 6) which synthesises outputs from all analysis modules.

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

## 12. Support & Resistance Zone Rules

### Why Zones, Not Lines

Markets do not reverse at exact prices. Buying and selling interest accumulates
within a region of the price axis — a zone of demand (support) or supply
(resistance). Modeling S/R as single price lines produces brittle comparisons
that miss legitimate reactions a few ticks away from the "exact" level.

All support and resistance in Sentinel is modeled as **Price Zones**: bounded
regions defined by a center price and a width derived from the current ATR.

See `ARCHITECTURE.md` — "Price Zone Architecture" for the full type definitions.

### Pipeline Order

The Module 4 computation pipeline processes zones in this strict order:

1. **Create** zone candidates from swing points (§12.1, §12.2).
2. **Merge** same-type zones that are close together (§12.3).
3. **Apply interactions** to each merged zone — touches, bounces, breaks, retests (§12.4).
4. **Filter** zones below `minTouchCount` (§12.1).
5. **Finalize** — compute age, state (§12.5), strength (§12.6), confidence, and evidence.
6. **Classify** — activeSupport, activeResistance, nearest, currentZone (§12.7).

Merging before interactions is intentional: a merged zone covers a wider price area,
so interactions are detected against the correct combined boundary rather than the
narrower boundary of each constituent zone. See KNOWN_LIMITATIONS.md LIM-017 for
the accepted tradeoff.

---

### 12.1 Zone Creation

Zones originate from confirmed dominant swing points (output of Module 3):

| Swing Type | Zone Created |
|------------|-------------|
| Swing High | Resistance zone centered at the swing high price |
| Swing Low  | Support zone centered at the swing low price |

A swing point must appear within the `lookback` window (default: 100 candles)
to generate a zone candidate. Older swing points are ignored.

Zone candidates with `touchCount < minTouchCount` (default: 2) are not included
in the output. A zone candidate starts with `touchCount = 1` (its own creation
swing) and becomes valid only after a second touch is observed.

---

### 12.2 Zone Width

Zone boundaries are derived from the current ATR, not from a fixed percentage.
This ensures zones are wider during volatile periods and tighter during calm periods.

```
halfWidth = ATR × atrMultiplier           (default atrMultiplier = 0.25)
upper     = center + halfWidth
lower     = center − halfWidth
width     = upper − lower = 2 × halfWidth
```

**ATR used:** The 14-period Wilder ATR computed by Module 2's `computeAtr` function
(exported from `src/modules/indicators`). The caller extracts `highs[]`, `lows[]`,
and `closes[]` from the candle array and passes them directly. Module 4 does not
contain its own ATR implementation.

**Never hardcode widths.** If the ATR is zero (degenerate flat series), default
to `center × 0.003` (0.3% of price) as a fallback minimum width.

---

### 12.3 Zone Merging

After all zone candidates have been created, merge any pair that overlap or are
close together. This prevents multiple redundant zones representing the same
market area.

**Merge condition:** Two zones of the same type (`support` or `support`, `resistance`
or `resistance`) are merged if:

```
gap between zones < ATR × mergeTolerance     (default mergeTolerance = 0.5)
```

Where `gap = max(lower₁, lower₂) − min(upper₁, upper₂)` (negative gap means
the zones already overlap).

**Merge algorithm:** Greedy nearest-first. Sort candidates by center price.
Iterate from bottom to top. If two adjacent candidates satisfy the merge
condition, replace them with a single merged zone.

**Merged zone properties:**

| Property | Rule |
|----------|------|
| `origin` | `'merged'` |
| `center` | Weighted average of the two centers, weighted by `touchCount` |
| `upper` | `max(upper₁, upper₂)` |
| `lower` | `min(lower₁, lower₂)` |
| `touchCount` | `touchCount₁ + touchCount₂` |
| `successfulReactions` | `successfulReactions₁ + successfulReactions₂` |
| `failedReactions` | `failedReactions₁ + failedReactions₂` |
| `firstDetectedIndex` | `min(firstDetectedIndex₁, firstDetectedIndex₂)` |
| `lastInteractionIndex` | `max(lastInteractionIndex₁, lastInteractionIndex₂)` |
| `evidence` | Combined `evidence₁ + evidence₂` |
| `broken` | `broken₁ OR broken₂` |
| `retested` | `retested₁ OR retested₂` |

**Do not merge** zones of opposite types (support + resistance), even if they overlap.
An overlap between a support zone and a resistance zone creates a confluence zone —
this will be handled by a future confluence detection step.

---

### 12.4 Zone Interaction Detection

After zones are established, scan each candle to detect interactions:

**Touch:** A candle whose high ≥ `zone.lower` AND low ≤ `zone.upper` entered the zone.

**Successful Reaction (Bounce):**
- For a **resistance** zone: candle entered the zone AND the close is below `zone.lower`.
- For a **support** zone: candle entered the zone AND the close is above `zone.upper`.
- The next candle confirms: it continues away from the zone (does not re-enter).

**Failed Reaction (Break):**
- Price closed on the far side of the zone (above `zone.upper` for a support zone
  being broken bearishly, or below `zone.lower` for a resistance zone being broken
  bullishly) and did not reverse back into the zone within 3 candles.

**Retest:**
- After a zone is broken, price returns to the zone from the opposite side.
- A broken support zone (now former support) is retested when price falls back
  into it from above.
- A broken resistance zone (now former resistance) is retested when price rises
  back into it from below.
- After a successful retest, `zone.retested = true` and `zone.state = 'flipped'`.

---

### 12.5 Zone State Machine

| State | Meaning | Entry Condition |
|-------|---------|-----------------|
| `active` | Zone created; price has not yet entered it | Initial state |
| `tested` | Price entered and bounced once | `successfulReactions === 1` |
| `strengthened` | Multiple successful reactions | `successfulReactions ≥ 2` |
| `weakening` | Failed reaction(s) but not yet broken | `failedReactions ≥ 1` AND `broken === false` |
| `broken` | Price closed through the zone and continued | `failedReactions ≥ 1` AND price did not reverse within 3 candles |
| `flipped` | Broken zone retested from the opposite side | `broken === true` AND `retested === true` |
| `archived` | Zone is too old to be relevant | `age > maxZoneAge` (default: 200 candles) |

**Priority order (highest to lowest):**
1. `archived` — overrides all other states when `age > maxZoneAge`.
2. `flipped` — requires `broken === true` AND `retested === true`.
3. `broken` — requires a confirmed close-through with no reversal within 3 candles.
4. `weakening` — any `failedReactions ≥ 1` that has not yet met the `broken` threshold.
   **When `failedReactions ≥ 1` and `successfulReactions ≥ 2` are both true,
   `weakening` takes priority over `strengthened`.** Failed reactions signal
   deterioration regardless of historical bounce count.
5. `strengthened` — `successfulReactions ≥ 2` with no failed reactions.
6. `tested` — `successfulReactions === 1`.
7. `active` — default state after zone creation.

---

### 12.6 Zone Strength Scoring

Zone strength is a 0–10 score computed from touch history, reaction quality, and age.

**Raw point calculation:**

```
score = 20                                        (base)
      + min(touchCount − 1, 5) × 10              (up to +50 for 6 total touches)
      + min(successfulReactions, 4) × 5          (up to +20 for 4 bounces)
      − min(failedReactions, 2) × 10             (up to −20 for 2 failed breaks)
      + (retested ? 5 : 0)                       (+ 5 if zone was retested after flip)
      − max(0, age − strengthDecayAge) × 0.2     (decay after strengthDecayAge candles)
```

**Normalize:** `strength = clamp(score / 10, 0, 10)`

**Strength classification:**

| Strength | Classification |
|----------|----------------|
| 0.0–3.0 | Weak — newly created or mostly untested |
| 3.0–5.0 | Moderate — some touch history |
| 5.0–7.5 | Strong — multiple confirmed reactions |
| 7.5–10.0 | Very Strong — heavily tested, retested, or both |

**Important:** `broken` zones retain their historical `strength` score for reference.
The `state` field (`'broken'`) is the authoritative indicator that a zone no longer
acts as active S/R. The `confidence` score reflects how reliably this zone has
fulfilled its role historically.

---

### 12.7 Zone Proximity Classification

When reporting active zones relative to the current price:

| Condition | Classification |
|-----------|----------------|
| `zone.lower ≤ currentPrice ≤ zone.upper` | Price is **inside** the zone |
| `currentPrice < zone.lower` (for resistance) | Zone is overhead |
| `currentPrice > zone.upper` (for support) | Zone is below |
| Distance < ATR × 1.0 | Zone is **near** (approaching) |
| Distance > ATR × 3.0 | Zone is **distant** |

**Nearest Support:** The highest active support zone whose `upper < currentPrice`.
**Nearest Resistance:** The lowest active resistance zone whose `lower > currentPrice`.

---

---

## §13 Volume Analysis Rules

Module 5 (`src/modules/volume-analysis/`) produces a `VolumeAnalysisResult` from raw candle data, indicator outputs, market structure, and support/resistance zones.

### 13.1 Public API

```typescript
computeVolumeAnalysis(
  candles: Candle[],
  indicators: IndicatorResult,
  marketStructure: MarketStructureResult,
  supportResistance: SupportResistanceResult,
  config?: Partial<VolumeAnalysisConfig>,
): VolumeAnalysisResult
```

### 13.2 Relative Volume

- **Average** = mean of the prior `relativeVolumePeriod` candles, excluding the current bar.
- When `indicators.volumeMA` is non-null (Module 2 pre-computed), use it directly.
- Fallback: compute from raw candles using `min(period, priorCandles.length)` bars.
- **ratio** = `current / average`; 0 when average is 0.

| Ratio | Classification |
|-------|---------------|
| < 0.5 | `very_low` |
| 0.5 – 0.7 | `low` |
| 0.7 – 1.5 | `normal` |
| 1.5 – 2.5 | `high` |
| ≥ 2.5 | `very_high` |

### 13.3 Volume Trend

- Extracts volumes from the last `volumeTrendWindow` candles.
- Fits OLS linear regression; returns `slope` and `r²`.
- `normalizedSlope = slope / meanVolume`
- `direction`: `increasing` when normalizedSlope > `volumeSlopeThreshold`; `decreasing` when < `-threshold`; else `flat`.
- `confidence = clamp(r² × 10, 0, 10)`. A perfectly flat series has r² = 1 → confidence = 10.

### 13.4 Buy/Sell Pressure

- Sums `takerBuyVolume` and `takerSellVolume` from the last `pressureWindow` candles.
- Source: Binance kline fields representing aggressive market-order takers.
- `deltaPercent = (delta / totalVolume) × 100`
- `dominantSide`: `balanced` when `|deltaPercent| < pressureBalanceThreshold`; else `buyers` or `sellers`.

### 13.5 Volume Confirmation

- `confirmed`: ratio ≥ `confirmationThreshold`
- `supportsTrend`: confirmed AND market trend is not `ranging`
- `supportsBreakout`: confirmed AND `breakout.confirmed`
- `supportsBOS`: the candle at `bos.last.index` had relative volume ≥ `confirmationThreshold` (computed from raw prior bars)
- `supportsCHOCH`: same logic for `choch.last.index`

### 13.6 Climax / Exhaustion Detection

Operates on the current (last) candle. Uses the last 10 candles to establish multi-bar high/low.

| Signal | Conditions |
|--------|-----------|
| Buying climax | ratio ≥ `climaxThreshold` AND body/range ≥ `climaxBodyRatio` AND bullish candle AND close = 10-bar high close |
| Selling climax | ratio ≥ `climaxThreshold` AND body/range ≥ `climaxBodyRatio` AND bearish candle AND close = 10-bar low close |
| Exhaustion | ratio ≥ `climaxThreshold` AND body/range ≤ `exhaustionBodyRatio` |

### 13.7 Accumulation / Distribution

Rule-based composite score −10 to +10. State: score > 3 → `accumulation`; < −3 → `distribution`; else `neutral`.

| Signal | Score |
|--------|-------|
| Dominant buyers | +1 |
| Dominant sellers | −1 |
| OBV confirms bullish trend | +2 |
| OBV confirms bearish trend | −2 |
| OBV diverges from bullish price | −1 |
| OBV diverges from bearish price | +1 |
| Price above VWAP | +1 |
| Price below VWAP | −1 |
| Last BOS bullish | +1 |
| Last BOS bearish | −1 |
| Last CHoCH bullish | +2 |
| Last CHoCH bearish | −2 |
| Price inside support zone | +1 |
| Price inside resistance zone | −1 |

### 13.8 OBV Analysis

- Computes a local OBV series over the last `volumeTrendWindow` candles starting from 0.
- Fits OLS regression on OBV series and on close prices.
- `direction`: bullish/bearish/neutral based on OBV slope sign.
- `confirmingPrice`: OBV and price slope have the same sign.
- `diverging`: OBV and price slope have opposite signs.

### 13.9 VWAP Analysis

Uses `indicators.vwap` (single rolling VWAP from Module 2).

- `distancePercent = (close − vwap) / vwap × 100`
- `respectingVWAP`: `|distancePercent| ≤ vwapProximityPercent` OR price crossed VWAP within the last 5 candles.
- Cross detection uses current VWAP value against recent closes (approximation — see LIM-020).

### 13.10 Overall Strength Score (0–10)

| Component | Max |
|-----------|-----|
| Relative volume classification | 3 |
| Volume trend confidence (r² based) | 2 |
| Buy/sell pressure imbalance | 2 |
| OBV confirming price | 1 |
| Accumulation/distribution (mapped from −10..+10 → 0..2) | 2 |
| **Total** | **10** |

### 13.11 Default Configuration

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `relativeVolumePeriod` | 20 | Prior bars for RVOL average |
| `relativeVolumeVeryLow` | 0.5 | Below this = very_low |
| `relativeVolumeLow` | 0.7 | Below this = low |
| `relativeVolumeHigh` | 1.5 | At or above = high |
| `relativeVolumeVeryHigh` | 2.5 | At or above = very_high |
| `volumeTrendWindow` | 10 | Candles for trend regression |
| `volumeSlopeThreshold` | 0.01 | 1% per candle = trend threshold |
| `pressureWindow` | 10 | Candles for buy/sell aggregation |
| `pressureBalanceThreshold` | 10.0 | ±10% delta = balanced |
| `confirmationThreshold` | 1.2 | 1.2× average = confirmed |
| `climaxThreshold` | 2.0 | 2× average = climax candidate |
| `climaxBodyRatio` | 0.6 | 60% body/range = large body |
| `exhaustionBodyRatio` | 0.3 | ≤30% body/range = small body |
| `vwapProximityPercent` | 0.5 | ±0.5% of VWAP = respecting |

*Last updated: Module 5 — Volume Analysis Engine (v0.8.0)*
