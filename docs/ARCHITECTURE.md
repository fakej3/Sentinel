# Sentinel — System Architecture

## Overview

Sentinel is a professional crypto market analysis platform designed to produce technically accurate, data-backed content for Binance Square. It is not a trading signal generator and not a trading bot.

The system separates data collection, mathematical analysis, reasoning, validation, and writing into fully independent modules. The AI only writes. It never calculates, decides, or invent.

---

## Analysis Pipeline

```
Official Binance API
        │
        ▼
MODULE 1 — Binance Data Engine
  Raw market data (OHLC, price, volume, 24H stats, funding rate, OI)
        │
        ▼
MODULE 2 — Technical Indicator Engine
  Mathematically calculated indicators (RSI, MACD, EMA, ATR, etc.)
        │
        ▼
MODULE 3 — Market Structure Engine
  Deterministic structure detection (HH/HL/LH/LL, BOS, CHOCH)
        │
        ▼
MODULE 4 — Support & Resistance Engine
  Static levels, dynamic EMA levels, pivot zones, swing levels
        │
        ▼
MODULE 5 — Volume Analysis Engine
  Relative volume, trend, spikes, buy/sell pressure
        │
        ▼
MODULE 6 — Evidence Engine
  Collects all conclusions with supporting evidence
        │
        ▼
MODULE 7 — Validation Engine
  Rejects any unsupported, incorrect, or contradictory claims
        │
        ▼
MODULE 8 — Confidence Engine
  Calculates evidence-weighted Confidence Score (0–10)
        │
        ▼
MODULE 9 — AI Writing Engine
  Receives validated JSON only — writes, never invents
        │
        ▼
MODULE 10 — Content Generator
  Produces multiple output styles from the same analysis
        │
        ▼
Binance Square Ready Post
```

---

## Module Responsibilities

### MODULE 1 — Binance Data Engine
- Source of truth for all market data.
- Only fetches. Never transforms. Never infers.
- All data comes directly from the official Binance REST API.
- Outputs raw, structured data objects.

### MODULE 2 — Technical Indicator Engine
- Pure mathematical calculations.
- No AI. No interpretation. No decisions.
- Each indicator is independently calculable from raw candle data.
- Outputs typed numerical results.

### MODULE 3 — Market Structure Engine
- Applies predefined deterministic rules to detect market structure.
- Rules are documented in `ENGINE_RULES.md`.
- Outputs structured labels (e.g. `"trend": "bullish"`, `"structure": "HH-HL"`).

### MODULE 4 — Support & Resistance Engine
- Calculates key price levels from historical candles and indicators.
- Does not guess. Every level is derived from a documented algorithm.

### MODULE 5 — Volume Analysis Engine
- Classifies volume against historical averages.
- Determines volume trend direction and confirmation strength.

### MODULE 6 — Evidence Engine
- Aggregates outputs from Modules 2–5.
- Packages every conclusion with an explicit evidence list.
- No conclusion is forwarded without supporting evidence.

### MODULE 7 — Validation Engine
- Acts as a gatekeeper before AI writing.
- Validates every claim against raw computed values.
- Rejects hallucinated numbers, unsupported conclusions, contradictions.
- Rules documented in `VALIDATION_RULES.md`.

### MODULE 8 — Confidence Engine
- Scores the overall analysis using an evidence-weighted formula.
- Positive and negative factors are configurable.
- Outputs a score from 0.0 to 10.0.
- Does not generate probabilities. Does not predict outcomes.

### MODULE 9 — AI Writing Engine
- Receives only the validated, structured JSON payload.
- Transforms structured evidence into readable professional prose.
- Follows strict writing rules defined in `WRITING_GUIDELINES.md`.
- Must never introduce data not present in the input JSON.

### MODULE 10 — Content Generator
- Takes MODULE 9 output and repackages it in multiple formats:
  - Professional Analysis
  - Institutional Style
  - Beginner Friendly
  - Quick Summary
  - Daily Market Update
  - Weekly Market Review
  - Educational Breakdown

### MODULE 11 — Image Generator
- Generates visual cards from structured analysis data.
- Types: Market Summary Card, S/R Diagram, Indicator Table, Trend Summary.

### MODULE 12 — History Database
- Persists every completed analysis.
- Stores: coin, timeframe, timestamp, indicators, confidence, content, image.

### MODULE 13 — Performance Tracker
- Evaluates historical analyses against actual price movement.
- Evaluation windows: 24h, 3d, 7d.
- Tracks: trend accuracy, S/R accuracy, breakout accuracy, false breakout rate.

---

## Data Flow Contract

Every module must:
1. Accept only typed, structured inputs.
2. Produce only typed, structured outputs.
3. Never silently fail — surface errors explicitly.
4. Never mutate upstream data.
5. Be independently testable with mock inputs.

---

## Shared Data Structures

All inter-module data is passed as structured typed objects. The canonical structure for a completed analysis payload:

```json
{
  "coin": "BTCUSDT",
  "timeframe": "4h",
  "timestamp": 1700000000000,
  "price": {
    "current": 106800,
    "change24h": 2.4,
    "high24h": 108200,
    "low24h": 105600
  },
  "indicators": {
    "ema20": 105200,
    "ema50": 103400,
    "ema100": 99800,
    "ema200": 95100,
    "rsi": 61.4,
    "macd": { "value": 420, "signal": 310, "histogram": 110, "bias": "bullish" },
    "atr": 1240,
    "adx": 32,
    "vwap": 106100,
    "bollingerBands": { "upper": 109800, "middle": 106200, "lower": 102600 },
    "stochRsi": { "k": 72, "d": 68 },
    "obv": 128400000,
    "mfi": 58,
    "cci": 112,
    "volumeMA": 8400
  },
  "marketStructure": {
    "trend": "bullish",
    "strength": "strong",
    "confidence": 8.0,
    "structure": {
      "higherHighs": 3,
      "higherLows": 3,
      "lowerHighs": 0,
      "lowerLows": 0,
      "equalHighs": 0,
      "equalLows": 0
    },
    "bos": {
      "detected": true,
      "events": [{ "type": "BOS", "index": 12, "timestamp": 1700000000000, "level": 107000, "direction": "bullish" }],
      "last": { "type": "BOS", "index": 12, "timestamp": 1700000000000, "level": 107000, "direction": "bullish" }
    },
    "choch": { "detected": false, "events": [], "last": null },
    "consolidation": { "detected": false, "rangeHigh": null, "rangeLow": null, "rangePercent": null, "barsInRange": 0 },
    "breakout": { "confirmed": false, "failed": false, "level": null, "direction": null },
    "pullback": { "detected": false, "depth": null },
    "swings": [],
    "events": [],
    "evidence": ["3 Higher Highs — bullish structure", "Break of Structure at 107000 (bullish)"]
  },
  "levels": {
    "support": [104800, 102400],
    "resistance": [109200, 112000],
    "dynamicSupport": 105200,
    "dynamicResistance": null
  },
  "volume": {
    "current": 9200,
    "average": 7800,
    "relativeVolume": 1.18,
    "trend": "increasing",
    "confirmation": "strong"
  },
  "evidence": [
    { "factor": "Above EMA200", "impact": "bullish", "points": 15 },
    { "factor": "Higher Highs", "impact": "bullish", "points": 15 },
    { "factor": "Higher Lows", "impact": "bullish", "points": 15 },
    { "factor": "Bullish MACD", "impact": "bullish", "points": 10 },
    { "factor": "Healthy RSI", "impact": "bullish", "points": 8 },
    { "factor": "Strong Volume", "impact": "bullish", "points": 12 },
    { "factor": "Strong Resistance at 109200", "impact": "bearish", "points": -10 }
  ],
  "confidence": 8.6,
  "validated": true
}
```

---

## CORS and API Access

Direct browser calls to the Binance REST API are blocked by CORS policy on
`api.binance.com`. The canonical solution for this project is a **thin server-side
proxy** that forwards requests from the browser to Binance and relays the response.

### Required proxy behaviour

| Concern | Rule |
|---------|------|
| Forwarding | Pass all query parameters to Binance unchanged |
| Headers | Strip `Origin` / `Referer`; do NOT forward user cookies or auth headers |
| Caching | Cache candle responses in memory for 30 s to avoid rate-limit hits |
| Rate limits | Respect Binance weight limits (1200 weight/min on spot) |
| Error relay | Forward Binance HTTP status codes to the client |

The proxy is **out of scope for Modules 1–8** (pure computation). It will be
introduced when the PWA shell (Module 9+) is built. During development, use
`vite.config.ts` `server.proxy` to rewrite `/api/binance/**` to `api.binance.com`.

### Development workaround

Add the following to `vite.config.ts` during local development:

```ts
server: {
  proxy: {
    '/api/binance': {
      target: 'https://api.binance.com',
      changeOrigin: true,
      rewrite: path => path.replace(/^\/api\/binance/, ''),
    },
  },
},
```

This must **never** be shipped to production. The production app requires the
server-side proxy described above.

---

## Platform Requirements

- Progressive Web App (PWA)
- Single codebase for all platforms
- Installable on Android, iOS, Windows, macOS
- Fully responsive (mobile, tablet, desktop)
- Works offline for previously loaded data (cached)
- Requires a thin server-side proxy for Binance API access (see CORS section above)

---

## Design Principles

1. **Accuracy over speed.** Never rush an analysis.
2. **Transparency over confidence.** Always show evidence, never just conclusions.
3. **Rejection over invention.** If uncertain, reject. Never guess.
4. **Modularity.** Each engine is replaceable without breaking others.
5. **Traceability.** Every output must be traceable to its source data.
