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
| Bullish | `macdLine > signalLine` AND `histogram > 0` AND `histogram > previousHistogram` — all three required; `macdBullish = false` when `previousHistogram` is null (see LIM-030) |
| Bearish | `macdLine < signalLine` AND `histogram < 0` AND `histogram < previousHistogram` — all three required; `macdBearish = false` when `previousHistogram` is null |
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

Volume is always compared against its 20-period moving average (prior bars only).

| Relative Volume | Classification | Code enum |
|-----------------|----------------|-----------|
| < 0.5× | Very Low | `very_low` |
| 0.5–0.7× | Low | `low` |
| 0.7–1.5× | Normal | `normal` |
| 1.5–2.5× | High | `high` |
| ≥ 2.5× | Very High | `very_high` |

These thresholds match Module 5 `DEFAULT_CONFIG` (`relativeVolumeVeryLow: 0.5`, `relativeVolumeLow: 0.7`, `relativeVolumeHigh: 1.5`, `relativeVolumeVeryHigh: 2.5`).

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

---

## 14. Analysis Engine — Module 6 Rules

Module 6 (`computeAnalysis`) is the **synthesis layer**. It reads the outputs of
Modules 1–5 and produces `MarketAnalysisResult` — the authoritative cross-module
analysis payload consumed by Modules 7–9.

Module 6 performs no indicator computation, no candle processing, and no zone
detection. It only interprets, synthesises, and collects evidence.

---

### 14.1 Full Trend Synthesis

The full trend (`FullTrendResult.trend`) is the **only authoritative trend label**
in the system. `MarketStructureResult.trend` (Module 3) is structural bias only.

**5 Bullish Conditions** (ENGINE_RULES.md §1):

| # | Condition | Field checked |
|---|-----------|--------------|
| 1 | Price above all EMAs | `indicators.ema20/50/100/200` all non-null and price > each |
| 2 | EMAs in bullish order | `ema20 > ema50 > ema100 > ema200` |
| 3 | Consistent HH+HL | `recentStructure.higherHighs ≥ 2` AND `recentStructure.higherLows ≥ 2` (windowed recent swings — see §2 and CRIT-01) |
| 4 | RSI supports bullish | `rsi ≥ 45` (configurable: `rsiBullishMin`; overlaps with bearish threshold at 45–55 — see LIM-031) |
| 5 | MACD bullish | `macd.macdLine > macd.signalLine` AND `macd.histogram > 0` AND `macd.histogram > macd.previousHistogram` (null previousHistogram → false) |

**5/5 met → `strong bullish`. 3–4/5 AND bullish > bearish → `moderate bullish`.**

**5 Bearish Conditions** (ENGINE_RULES.md §1):

| # | Condition | Field checked |
|---|-----------|--------------|
| 1 | Price below all EMAs | all EMAs non-null and price < each |
| 2 | EMAs in bearish order | `ema20 < ema50 < ema100 < ema200` |
| 3 | Consistent LH+LL | `recentStructure.lowerHighs ≥ 2` AND `recentStructure.lowerLows ≥ 2` (windowed recent swings — see §2 and CRIT-01) |
| 4 | RSI supports bearish | `rsi ≤ 55` (configurable: `rsiBearishMax`; overlaps with bullish threshold at 45–55 — see LIM-031) |
| 5 | MACD bearish | `macd.macdLine < macd.signalLine` AND `macd.histogram < 0` AND `macd.histogram < macd.previousHistogram` (null previousHistogram → false) |

**5/5 met → `strong bearish`. 3–4/5 AND bearish > bullish → `moderate bearish`.**

**4 Neutral Conditions** (ENGINE_RULES.md §1):

| # | Condition |
|---|-----------|
| 1 | ADX < 20 (configurable: `adxWeakThreshold`) |
| 2 | RSI in [40, 60] (configurable: `rsiNeutralLow`/`rsiNeutralHigh`) |
| 3 | No consistent HH-HL or LH-LL structure |
| 4 | Price between EMAs without clear stack order |

**3+/4 neutral met → `ranging`.**

Remaining cases: `weak bullish` (1–2 bullish conditions, bullish > bearish),
`weak bearish` (1–2 bearish conditions, bearish > bullish), `ranging` (default).

---

### 14.2 EMA Context

- `emaAlignment = 'bullish_stack'`: EMA20 > EMA50 > EMA100 > EMA200 (all 4 available)
- `emaAlignment = 'bearish_stack'`: EMA20 < EMA50 < EMA100 < EMA200 (all 4 available)
- `emaAlignment = 'mixed'`: some EMAs available but not in either stack
- `emaAlignment = 'unavailable'`: no EMAs computed

**EMA Confluence Zone** (ENGINE_RULES.md §5):
Two or more EMAs within `emaConfluencePercent` (default 0.5%) of each other form
a confluence zone. Treated as a single stronger dynamic level.

---

### 14.3 S/R Context

- `approachingSupport`: nearest support center is within `supportProximityPercent` (default 2%) of current price
- `approachingResistance`: nearest resistance center is within `resistanceProximityPercent` (default 2%) of current price
- `strongestActiveSupport`: active support zone with the highest `strength` score
- `strongestActiveResistance`: active resistance zone with the highest `strength` score

---

### 14.4 Evidence Items

Each `EvidenceItem` has:
- `factor`: canonical name from the table below (Module 8 uses this to look up point weights)
- `impact`: `'high'` | `'medium'` | `'low'`
- `description`: human-readable explanation of why this item is present
- `source`: which upstream module produced the underlying data

Items are sorted by impact (high → medium → low) in `MarketAnalysisResult.evidence`.

**Canonical Factor Names (ENGINE_RULES.md §11 scoring weights apply to these):**

| Factor | Impact | Source |
|--------|--------|--------|
| Price above EMA200 | high | indicators |
| Price below EMA200 | high | indicators |
| Price above EMA100 | medium | indicators |
| Price below EMA100 | medium | indicators |
| Price above EMA50 | medium | indicators |
| Price below EMA50 | medium | indicators |
| Price above EMA20 | low | indicators |
| Price below EMA20 | low | indicators |
| EMA bullish alignment | high | indicators |
| EMA bearish alignment | high | indicators |
| EMA confluence zone | medium | indicators |
| Higher High confirmed | high | market_structure |
| Higher Low confirmed | high | market_structure |
| Lower High confirmed | high | market_structure |
| Lower Low confirmed | high | market_structure |
| Bullish BOS | high | market_structure |
| Bearish BOS | high | market_structure |
| Bullish CHoCH | high | market_structure |
| Bearish CHoCH | high | market_structure |
| Market in consolidation | medium | market_structure |
| Breakout confirmed | high | market_structure |
| Failed breakout | medium | market_structure |
| Active pullback | medium | market_structure |
| RSI supports bullish | medium | indicators |
| RSI neutral | low | indicators |
| Overbought RSI (>70) | medium | indicators |
| Oversold RSI (<30) | medium | indicators |
| RSI in 30–45 range | medium | indicators |
| RSI in 55–70 range | medium | indicators |
| MACD bullish bias | medium | indicators |
| MACD bearish bias | medium | indicators |
| ADX above 25 | medium | indicators |
| ADX trend weak | low | indicators |
| Bollinger squeeze | medium | indicators |
| Bollinger expansion | medium | indicators |
| Price at Bollinger upper | medium | indicators |
| Price at Bollinger lower | medium | indicators |
| StochRSI overbought | low | indicators |
| StochRSI oversold | low | indicators |
| Price at active support | high | support_resistance |
| Price at active resistance | high | support_resistance |
| Strong support below | medium | support_resistance |
| Strong resistance above | medium | support_resistance |
| Active support zone | low | support_resistance |
| Strong resistance overhead | low | support_resistance |
| Strong volume confirmation | high | volume |
| Below average volume on move | medium | volume |
| Volume climax buying | high | volume |
| Volume climax selling | high | volume |
| Volume exhaustion | medium | volume |
| Accumulation detected | high | volume |
| Distribution detected | high | volume |
| Bullish OBV trend | medium | volume |
| OBV diverging from price | medium | volume |
| Price above VWAP | low | volume |
| Price below VWAP | low | volume |
| High relative volume | medium | volume |
| Low relative volume | medium | volume |

**Factors deferred to future modules** (not yet detectable — see LIM-023 through LIM-026):
`RSI bullish divergence`, `RSI bearish divergence`, `MACD bullish crossover (current)`,
`MACD bearish crossover (current)`, `ATR elevated vs historical`, `StochRSI bullish crossover`,
`StochRSI bearish crossover`.

---

### 14.5 Default Configuration

| Parameter | Default | ENGINE_RULES ref |
|-----------|---------|-----------------|
| `emaConfluencePercent` | 0.5 | §5 |
| `stochRsiOverboughtThreshold` | 80 | §10 |
| `stochRsiOversoldThreshold` | 20 | §10 |
| `adxWeakThreshold` | 20 | §7 |
| `adxStrongThreshold` | 25 | §7 |
| `rsiNeutralLow` | 40 | §1 |
| `rsiNeutralHigh` | 60 | §1 |
| `rsiBullishMin` | 45 | §1 |
| `rsiBearishMax` | 55 | §1 |
| `supportProximityPercent` | 2.0 | §12 |
| `resistanceProximityPercent` | 2.0 | §12 |
| `minBullishSwingsForTrend` | 2 | §1 |
| `minBearishSwingsForTrend` | 2 | §1 |

---

## 15. Validation Engine — Module 7 Rules

Module 7 (`validateAnalysis`) is the **deterministic gatekeeper** between Module 6
synthesis and Module 8 confidence scoring. It runs four independent checks on a
`MarketAnalysisResult` and returns a structured `ValidationResult`.

Module 7 performs no calculations. It only validates.

---

### 15.1 Public API

```typescript
validateAnalysis(
  result: MarketAnalysisResult,
  config?: Partial<ValidationConfig>,
): ValidationResult
```

Merges the caller-supplied partial config with `DEFAULT_VALIDATION_CONFIG` and
runs all four checkers in sequence. Issues from all checkers are combined into a
single `issues[]` array.

---

### 15.2 ValidationResult Structure

| Field | Type | Meaning |
|-------|------|---------|
| `passed` | `boolean` | No critical issues (and no warnings when `failOnWarning` is set) |
| `clean` | `boolean` | No issues at all |
| `issues` | `ValidationIssue[]` | All detected problems |
| `criticalCount` | `number` | Count of `severity === 'critical'` issues |
| `warningCount` | `number` | Count of `severity === 'warning'` issues |
| `infoCount` | `number` | Count of `severity === 'info'` issues |
| `summary` | `string` | Human-readable one-line summary |

`ValidationIssue` fields: `severity` (`critical | warning | info`), `category`
(`completeness | consistency | contradiction | structural`), `field` (dot-path
into `MarketAnalysisResult`), `message`, optional `expected` and `actual`.

---

### 15.3 Completeness Check (`checkCompleteness`)

All findings are `category: 'completeness'`.

| Check | Severity | Condition |
|-------|----------|-----------|
| `price.current` | critical | `price.current <= 0` |
| `symbol` | critical | `symbol.trim() === ''` |
| `evidence` count | critical | `evidence.length < minEvidenceItems` |
| High-impact evidence | warning | `highImpactCount < minHighImpactEvidence` |
| `bullishConditionsMet` range | critical | value not in [0, 5] |
| `bearishConditionsMet` range | critical | value not in [0, 5] |
| `neutralConditionsMet` range | critical | value not in [0, 4] |

Default thresholds: `minEvidenceItems = 3`, `minHighImpactEvidence = 1`.

---

### 15.4 Consistency Check (`checkConsistency`)

Verifies that each `TrendConditions` boolean matches its raw upstream source.
All findings are `category: 'consistency'`.

| Field | Source | Derived as |
|-------|--------|-----------|
| `priceAboveEMA20` | `indicators.ema20` | `price > ema20` (false when null) |
| `priceAboveEMA50` | `indicators.ema50` | `price > ema50` (false when null) |
| `priceAboveEMA100` | `indicators.ema100` | `price > ema100` (false when null) |
| `priceAboveEMA200` | `indicators.ema200` | `price > ema200` (false when null) |
| `priceBelowEMA20` | `indicators.ema20` | `price < ema20` (false when null) |
| `priceBelowEMA50` | `indicators.ema50` | `price < ema50` (false when null) |
| `priceBelowEMA100` | `indicators.ema100` | `price < ema100` (false when null) |
| `priceBelowEMA200` | `indicators.ema200` | `price < ema200` (false when null) |
| `emaInBullishOrder` | all 4 EMAs | `ema20 > ema50 > ema100 > ema200` (false when any null) |
| `emaInBearishOrder` | all 4 EMAs | `ema20 < ema50 < ema100 < ema200` (false when any null) |
| `hasConsistentHHHL` | `marketStructure.recentStructure` | `higherHighs >= 2 && higherLows >= 2` (windowed — same window as `determineTrend()`) |
| `hasConsistentLHLL` | `marketStructure.recentStructure` | `lowerHighs >= 2 && lowerLows >= 2` (windowed — same window as `determineTrend()`) |
| `rsiSupportsBullish` | `indicators.rsi` | `rsi >= rsiBullishMin` (false when null) |
| `rsiSupportsBearish` | `indicators.rsi` | `rsi <= rsiBearishMax` (false when null) |
| `rsiInNeutralRange` | `indicators.rsi` | `rsi >= rsiNeutralLow && rsi <= rsiNeutralHigh` (false when null) |
| `macdBullish` | `indicators.macd` | `macdLine > signalLine` AND `histogram > 0` AND `histogram > previousHistogram` (false when macd null or previousHistogram null) |
| `macdBearish` | `indicators.macd` | `macdLine < signalLine` AND `histogram < 0` AND `histogram < previousHistogram` (false when macd null or previousHistogram null) |
| `adxBelowWeakThreshold` | `indicators.adx` | `adx < adxWeakThreshold` (false when null) |
| `noConsistentStructure` | other conditions | `!hasConsistentHHHL && !hasConsistentLHLL` |
| `priceBetweenEMAsWithoutClearOrder` | other conditions | `!priceAboveAllEMAs && !priceBelowAllEMAs && !emaInBullishOrder && !emaInBearishOrder` |
| `insideSupport` | `supportResistance.currentZone` | `currentZone?.type === 'support' ?? false` |
| `insideResistance` | `supportResistance.currentZone` | `currentZone?.type === 'resistance' ?? false` |
| Volume context fields | `volumeAnalysis` | All 11 `VolumeContextResult` fields matched to their Module 5 sources |

RSI classification is re-derived using M6's exact boundaries (`< 30` oversold, `< 45` weak_bearish, `≤ 55` neutral, `≤ 70` healthy_bullish, else overbought). MACD bias is re-derived from `macdLine > signalLine` (bullish), `< signalLine` (bearish), else neutral.

---

### 15.5 Contradiction Check (`checkContradictions`)

Verifies logical consistency within the derived fields. All findings are `category: 'contradiction'`.

| Check | Severity | Rule |
|-------|----------|------|
| `priceAboveAllEMAs` derivation | critical | Must equal AND of all four `priceAboveEMA*` booleans |
| `priceBelowAllEMAs` derivation | critical | Must equal AND of all four `priceBelowEMA*` booleans |
| Both above and below all EMAs | critical | `priceAboveAllEMAs && priceBelowAllEMAs` is impossible |
| Both EMA orders | critical | `emaInBullishOrder && emaInBearishOrder` is impossible |
| `bullishConditionsMet` tally | critical | Must equal count of true values in [priceAboveAllEMAs, emaInBullishOrder, hasConsistentHHHL, rsiSupportsBullish, macdBullish] |
| `bearishConditionsMet` tally | critical | Must equal count of true values in [priceBelowAllEMAs, emaInBearishOrder, hasConsistentLHLL, rsiSupportsBearish, macdBearish] |
| `neutralConditionsMet` tally | critical | Must equal count of true values in [adxBelowWeakThreshold, rsiInNeutralRange, noConsistentStructure, priceBetweenEMAsWithoutClearOrder] |
| Trend label | critical | Must match `deriveTrendLabel(bullish, bearish, neutral)` priority order (§1) |
| Evidence sort order | warning | Evidence items must be sorted high → medium → low impact; first violation reported only |
| RSI overlap | warning | `rsiSupportsBullish && rsiSupportsBearish` both true — RSI is in the 45–55 overlap zone; both thresholds intentionally overlap (see LIM-031); emits a warning, not a critical error |

---

### 15.6 Structural Check (`checkStructural`)

Validates the geometric and logical integrity of S/R zones and market structure events.
All findings are `category: 'structural'`.

**Zone geometry** (for each zone in `supportResistance.zones[]`):

| Check | Severity | Rule |
|-------|----------|------|
| `lower > center` | critical | `lower > center + zoneCenterTolerance × center` |
| `center > upper` | critical | `center > upper + zoneCenterTolerance × upper` |
| `lower >= upper` | critical | Zone has no width |
| Width mismatch | warning | `|zone.width − (zone.upper − zone.lower)| >= 0.0001` |

**Active zone lists**:

| Check | Severity | Rule |
|-------|----------|------|
| `activeSupport` type | critical | Every zone must have `type === 'support'` |
| `activeSupport` broken | critical | No zone in `activeSupport` may have `broken === true` |
| `activeResistance` type | critical | Every zone must have `type === 'resistance'` |
| `activeResistance` broken | critical | No zone in `activeResistance` may have `broken === true` |

**Market structure event consistency**:

| Check | Severity | Rule |
|-------|----------|------|
| `bos.detected` vs `bos.events` | critical | `bos.detected === (bos.events.length > 0)` |
| `bos.last` when detected | critical | `bos.last` must equal `bos.events[bos.events.length − 1]` |
| `bos.last` when not detected | critical | `bos.last` must be `null` |
| `choch.detected` vs `choch.events` | critical | `choch.detected === (choch.events.length > 0)` |
| `choch.last` consistency | critical | Same rules as `bos.last` |
| BOS events chronological order | critical | `bos.events[i].index < bos.events[i+1].index` for all i |
| CHOCH events chronological order | critical | Same rule for `choch.events` |
| `events` count | critical | `events.length === bos.events.length + choch.events.length` |
| `events` chronological order | critical | `events[i].index < events[i+1].index` for all i |

---

### 15.7 Default Configuration

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `zoneCenterTolerance` | 0.001 | Tolerance for zone geometry comparisons (0.1%) |
| `minEvidenceItems` | 3 | Minimum total evidence items (critical if below) |
| `minHighImpactEvidence` | 1 | Minimum high-impact evidence items (warning if below) |
| `failOnWarning` | false | When true, warnings also cause `passed: false` |
| `rsiBullishMin` | 45 | Threshold for `rsiSupportsBullish` (ENGINE_RULES.md §1) |
| `rsiBearishMax` | 55 | Threshold for `rsiSupportsBearish` (ENGINE_RULES.md §1) |
| `adxWeakThreshold` | 20 | Threshold for `adxBelowWeakThreshold` (ENGINE_RULES.md §7) |
| `rsiNeutralLow` | 40 | Lower bound of RSI neutral range (ENGINE_RULES.md §1) |
| `rsiNeutralHigh` | 60 | Upper bound of RSI neutral range (ENGINE_RULES.md §1) |
| `minBullishSwingsForTrend` | 2 | Swing count floor for `hasConsistentHHHL` |
| `minBearishSwingsForTrend` | 2 | Swing count floor for `hasConsistentLHLL` |

---

## §16 Writing Engine Rules (Module 9)

### 16.1 Input Contract

Module 9 reads from three typed objects only:
- `MarketAnalysisResult` — full analysis including evidence[], indicatorSummary, etc. (Module 6)
- `ValidationResult` — validation pass/fail and issue list (Module 7)
- `ConfidenceResult` — confidence score, grade, reasons, penalties (Module 8)

Module 9 must **never** read raw candles. It must **never** derive, calculate, or infer any values — it only reads the pre-computed structured fields.

### 16.2 Evidence-First Writing

Every statement in the generated report must be traceable to a specific field in the input objects. Prohibited:
- Referencing price targets or future prices.
- Inventing patterns not present in the input.
- Parsing description strings to infer direction — always read `EvidenceItem.direction` directly.
- Any language implying certainty about future price movement.

### 16.3 Confidence-Driven Hedging Language

The opening phrase of the summary and conclusion is determined by `ConfidenceResult.grade`:

| Grade | Opening phrase |
|-------|----------------|
| `very_strong` | "The available evidence strongly supports" |
| `strong` | "The current evidence supports" |
| `moderate` | "The current signals suggest" |
| `mixed` | "The current signals are mixed, with indications of" |
| `weak` | "The available evidence is limited, with tentative indications of" |

### 16.4 Critical Validation Gate

When `ValidationResult.criticalCount > 0`:
- All section content is replaced with minimal stubs (empty strings).
- `fullReport` contains only the validation warning text.
- The headline becomes `"Analysis unavailable — critical validation failure"`.
- Metadata is still populated normally.

### 16.5 Banned Phrases

The following phrases must never appear in any generated output:

"will", "going to", "definitely", "guaranteed", "certain", "buy", "sell", "moon", "dump", "pump", "100% sure", "great opportunity", "buy the dip", "according to analysts"

Every report must end with: **"This is not financial advice."**

### 16.6 Template Specifications

| Template | Description |
|----------|-------------|
| `full` | Markdown headers (`## Section`), all sections, complete report |
| `executive` | Flowing prose without headers; headline + summary + trend + confidence + risk + conclusion |
| `summary` | Single paragraph summary only |
| `bullet` | 5–7 `•` bullet points covering headline, trend, indicators, volume, S/R, risk |
| `headline` | Single title line: `{SYMBOL} {TF}: {trend} — Confidence {N.N}/10 @ {price}` |
| `social` | Short post-format: headline + first sentence of summary + first sentence of confidence |

### 16.7 Default Configuration

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `template` | `'full'` | Output format |
| `verbosity` | `'standard'` | Verbosity level |
| `maxSummaryLength` | 600 | Character limit for summary field |
| `maxReportLength` | 4000 | Character limit for fullReport |
| `includeValidationSection` | true | Whether to populate validationSection |
| `includeConfidenceSection` | true | Whether to populate confidenceSection |
| `includeWarnings` | true | Whether to include confidence warnings |
| `maxReasonsDisplayed` | 3 | Max confidence reasons shown |
| `maxRiskFactors` | 3 | Max risk factors in risk section |

*Last updated: Module 9 — AI Writing Engine (v0.10.4)*

---

## §17 Analysis Pipeline Orchestrator Rules

Module 10 (`src/modules/pipeline/`) is the single public entry point. It chains Modules 1–9 and returns `PipelineResult`.

### 17.1 Public API

```typescript
analyzeMarket(options: PipelineOptions): Promise<PipelineResult>
```

### 17.2 Execution Order

Stages execute sequentially. Each stage receives only outputs that previous stages have produced. No stage may execute before its upstream dependency has completed.

| Stage | Module | Input | Output |
|-------|--------|-------|--------|
| 1 | Binance | `symbol`, `interval`, `candleLimit` | `MarketData` |
| 2 | Indicators | `candles` | `IndicatorResult` |
| 3 | Market Structure | `candles` | `MarketStructureResult` |
| 4 | Support/Resistance | `candles`, `marketStructure` | `SupportResistanceResult` |
| 5 | Volume Analysis | `candles`, `indicators`, `marketStructure`, `supportResistance` | `VolumeAnalysisResult` |
| 6 | Analysis | `marketData`, `indicators`, `marketStructure`, `supportResistance`, `volumeAnalysis` | `MarketAnalysisResult` |
| 7 | Validation | `analysis` | `ValidationResult` |
| 8 | Confidence | `analysis`, `validation` | `ConfidenceResult` |
| 9 | Writer | `analysis`, `validation`, `confidence` | `GeneratedAnalysis` |

### 17.3 Error Model

| Code | Trigger |
|------|---------|
| `configuration_error` | Invalid `PipelineOptions` (empty symbol) before any I/O |
| `fetch_failure` | Fetch implementation throws |
| `insufficient_candles` | `candles.length < minCandleCount` after fetch |
| `internal_module_failure` | Any Module 2–9 throws unexpectedly |
| `validation_failure` | Reserved — not thrown automatically; exposed for caller use |

All errors are instances of `PipelineError` (extends `Error`) with `code`, `module`, `reason`, and `cause` fields.

### 17.4 Configuration

`PipelineOptions.config` accepts `Partial<PipelineConfig>`:
- `minCandleCount` — minimum candles required (default 50)
- `marketStructure`, `supportResistance`, `volumeAnalysis`, `analysis`, `validation`, `confidence`, `writer` — each passes through to the corresponding module as `Partial<ModuleConfig>`; defaults are preserved for any omitted field.

### 17.5 Dependency Injection

`PipelineOptions.fetchImpl` replaces the real `fetchMarketData` call with any function matching `(symbol, timeframe, options) => Promise<MarketData>`. When omitted, the real Binance client is used. This is the canonical testing interface — all pipeline tests inject a deterministic mock.

### 17.6 Timings

`metadata.timings` contains wall-clock milliseconds for each stage and a `total` covering the full `analyzeMarket` call including input validation.

*Last updated: Module 10 — Analysis Pipeline Orchestrator (v0.11.0)*
