# Sentinel — Validation Rules

This document defines the rules for the Validation Engine (Module 7).
Every AI-generated statement must pass validation before it appears in any published content.
No factual claim bypasses this engine.

---

## Purpose

The Validation Engine is the final gatekeeper between computed analysis and the AI writer.

It ensures:
1. The AI writer only receives verified, accurate data.
2. Every factual claim in the generated content is traceable to real computed values.
3. Hallucinations, incorrect numbers, and unsupported conclusions are rejected before reaching users.

---

## Validation Stages

### Stage 1 — Input Validation (Before AI Writing)

Before the JSON payload is passed to the AI Writing Engine, validate that:

| Check | Rule |
|-------|------|
| All required fields present | coin, timeframe, price, indicators, marketStructure, levels, volume, evidence, confidence |
| No null indicator values | Every indicator used in evidence must have a computed value |
| Price is a positive number | current price > 0 |
| Timestamp is recent | Within 5 minutes of current time (to prevent stale data) |
| Confidence score is in range | 0.0 ≤ confidence ≤ 10.0 (per ENGINE_RULES.md §11) |
| Evidence list is non-empty | At least 1 evidence item must be present |
| No contradiction in trend | If trend = "bullish", bullish evidence must outweigh bearish |

If any Stage 1 check fails → **reject the entire analysis payload and surface an error to the user.**

---

### Stage 2 — Output Validation (After AI Writing)

After the AI writer generates content, scan the output for all factual claims and validate each one against the source data.

#### 2a. Numeric Claims

For every number mentioned in the AI-generated text:

1. Extract the number and the context (what it refers to).
2. Look up the corresponding value in the source JSON.
3. Compare extracted number against source value.

| Tolerance | Rule |
|-----------|------|
| Price levels | ±0.5% tolerance allowed |
| Indicator values (RSI, ADX, etc.) | ±1 unit tolerance allowed |
| Percentage changes | ±0.1% tolerance allowed |
| Exact integers (e.g. EMA period) | Zero tolerance |

If a number in the AI output does not match the source within tolerance → **reject the sentence. Queue for regeneration.**

#### 2b. Indicator State Claims

For every indicator state mentioned (e.g. "RSI is overbought", "MACD is bullish"):

| AI Statement | Validation Check |
|---|---|
| "RSI is overbought" | Computed RSI must be > 70 |
| "RSI is oversold" | Computed RSI must be < 30 |
| "RSI shows healthy momentum" | Computed RSI must be 55–70 |
| "MACD is bullish" | MACD line must be > Signal line |
| "MACD is bearish" | MACD line must be < Signal line |
| "Bullish MACD crossover" | MACD crossed above Signal on last or current candle |
| "Bearish MACD crossover" | MACD crossed below Signal on last or current candle |
| "Above EMA200" | Current price must be > computed EMA200 |
| "Below EMA200" | Current price must be < computed EMA200 |
| "Above EMA50" | Current price must be > computed EMA50 |
| "Overbought on StochRSI" | StochRSI %K must be > 0.80 |
| "Oversold on StochRSI" | StochRSI %K must be < 0.20 |
| "Volume is above average" | Relative volume must be > 1.1 |
| "Volume is below average" | Relative volume must be < 0.9 |
| "Volume spike" | Relative volume must be > 2.0 |
| "ADX shows strong trend" | ADX must be ≥ 25 |
| "ADX shows weak trend" | ADX must be < 20 |

If an indicator state claim fails validation → **reject the sentence. Queue for regeneration.**

#### 2c. Market Structure Claims

| AI Statement | Validation Check |
|---|---|
| "Higher Highs" | marketStructure.structure.higherHighs must be > 0 |
| "Higher Lows" | marketStructure.structure.higherLows must be > 0 |
| "Lower Highs" | marketStructure.structure.lowerHighs must be > 0 |
| "Lower Lows" | marketStructure.structure.lowerLows must be > 0 |
| "Break of Structure" | marketStructure.bos.detected must be true |
| "Change of Character" | marketStructure.choch.detected must be true |
| "Market is consolidating" | marketStructure.consolidation.detected must be true |
| "Breakout" | marketStructure.breakout.confirmed must be true |
| "Pullback" | marketStructure.pullback.detected must be true |

#### 2d. Trend Claims

| AI Statement | Validation Check |
|---|---|
| "Bullish trend" | marketStructure.trend must equal "bullish" |
| "Bearish trend" | marketStructure.trend must equal "bearish" |
| "Ranging" / "Sideways" | marketStructure.trend must equal "ranging" |
| "Strong uptrend" | trend = "bullish" AND confidence ≥ 7.0 |
| "Weak bullish bias" | trend = "bullish" AND confidence < 5.0 |

#### 2e. Support and Resistance Claims

| AI Statement | Validation Check |
|---|---|
| Any specific support price mentioned | Must appear in levels.support (±0.5%) |
| Any specific resistance price mentioned | Must appear in levels.resistance (±0.5%) |
| "Strong support" | The level must have ≥ 3 historical touches |
| "Strong resistance" | The level must have ≥ 3 historical touches |

**The AI must never invent support or resistance levels that do not exist in the computed levels array.**

#### 2f. Confidence Claims

| AI Statement | Validation Check |
|---|---|
| Any confidence score mentioned | Must match computed confidence ± 0.1 |
| "High confidence" | confidence must be ≥ 7.0 |
| "Mixed signals" / "Low confidence" | confidence must be < 5.0 |

---

### Stage 3 — Contradiction Detection

Scan the full generated text for internal contradictions:

| Contradiction | Example |
|---|---|
| Trend vs Structure | Text says "bullish" but structure says LH-LL |
| RSI vs claim | Text says "momentum is strong" but RSI is 38 |
| Volume vs claim | Text says "volume confirms the move" but relative volume is 0.6 |
| Support vs price | Text identifies a support level that is above the current price |
| Resistance vs price | Text identifies a resistance level that is below the current price |

If any contradiction is detected → **reject the affected sentences. Queue for regeneration.**

---

## Rejection Protocol

When a sentence is rejected:

1. Log the rejection with:
   - The original sentence
   - The claim that failed
   - The computed value that contradicted it
   - The rule that was violated

2. Mark the sentence for regeneration.

3. Re-prompt the AI with explicit instruction not to make that claim.

4. Maximum regeneration attempts: **3**

5. If after 3 attempts the sentence still fails validation → **omit the claim entirely from the output.**

6. If more than 30% of sentences are rejected → **abort the generation and surface an error to the user** with the message: "Insufficient data quality for content generation."

---

## What Validation Must Never Allow

- Numbers that were not in the input JSON.
- Indicators that were not calculated (e.g. Fibonacci if not enabled).
- Future price predictions ("will reach", "will break", "target is").
- Certainty language ("definitely", "guaranteed", "will").
- Financial advice language ("buy", "sell", "invest").
- Fabricated support or resistance levels.
- Trend claims without corresponding structure data.
- Divergence claims without computed divergence detection.

---

## Validation Audit Log

Every content generation session must produce an audit trail:

```json
{
  "sessionId": "abc123",
  "coin": "BTCUSDT",
  "timeframe": "4h",
  "timestamp": 1700000000000,
  "validationPassed": true,
  "stagesRun": ["stage1", "stage2a", "stage2b", "stage2c", "stage2d", "stage2e", "stage2f", "stage3"],
  "rejections": [
    {
      "sentence": "RSI is currently overbought.",
      "claim": "RSI > 70",
      "actualValue": 61.4,
      "rule": "2b - RSI overbought requires RSI > 70",
      "regenerationAttempts": 1,
      "outcome": "replaced"
    }
  ],
  "finalValidated": true
}
```

This log must be stored alongside each completed analysis in the History Database (Module 12).

---

*Last updated: Foundation Stabilization (post-audit v0.1)*
