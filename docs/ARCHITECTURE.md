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
- Detects price zones (not lines) from swing points in the candle series.
- Every zone has a center, width derived from ATR, touch count, reaction history, and lifecycle state.
- Nearby zones are merged to avoid redundant overlapping signals.
- Zone strength and confidence are computed from touch quality, reaction count, and age.
- Rules documented in `ENGINE_RULES.md §12`.
- See also: "Price Zone Architecture" section below.

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
  "supportResistance": {
    "zones": [
      {
        "id": "sr-001",
        "type": "resistance",
        "origin": "swing-high",
        "state": "active",
        "center": 109200,
        "upper": 109820,
        "lower": 108580,
        "width": 1240,
        "touchCount": 3,
        "successfulReactions": 2,
        "failedReactions": 0,
        "broken": false,
        "retested": false,
        "firstDetectedIndex": 45,
        "lastInteractionIndex": 87,
        "age": 42,
        "strength": 7.0,
        "confidence": 6.5,
        "evidence": ["3 touches at resistance zone 108580–109820", "2 successful rejections"]
      },
      {
        "id": "sr-002",
        "type": "support",
        "origin": "swing-low",
        "state": "strengthened",
        "center": 104800,
        "upper": 105420,
        "lower": 104180,
        "width": 1240,
        "touchCount": 4,
        "successfulReactions": 3,
        "failedReactions": 1,
        "broken": false,
        "retested": false,
        "firstDetectedIndex": 30,
        "lastInteractionIndex": 95,
        "age": 65,
        "strength": 8.0,
        "confidence": 7.5,
        "evidence": ["4 touches at support zone 104180–105420", "3 successful bounces"]
      }
    ],
    "activeSupport": [{ "id": "sr-002", "type": "support", "center": 104800, "...": "full PriceZone — same shape as zones[] entries" }],
    "activeResistance": [{ "id": "sr-001", "type": "resistance", "center": 109200, "...": "full PriceZone — same shape as zones[] entries" }],
    "nearestSupport": { "id": "sr-002", "type": "support", "center": 104800, "...": "full PriceZone — same shape as zones[] entries" },
    "nearestResistance": { "id": "sr-001", "type": "resistance", "center": 109200, "...": "full PriceZone — same shape as zones[] entries" },
    "currentZone": null,
    "evidence": ["Strong resistance zone at 109200 (3 touches)", "Strengthened support zone at 104800 (4 touches)"]
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

## Price Zone Architecture

### Why Zones, Not Lines

Real markets do not reverse at an exact price to the tick. They reverse within a
region where buying or selling interest accumulates — an area of demand or supply
that persists across multiple candles. Representing support and resistance as single
price lines ignores this reality and produces brittle comparisons (`price === 109200`)
that miss legitimate reactions a few ticks away.

Sentinel models all support and resistance as **Price Zones**: bounded rectangular
regions of the price axis with a center, a top boundary, and a bottom boundary.
A zone is confirmed when price has entered and reacted from it multiple times.

If a downstream consumer (writing engine, validation engine, UI) needs a single
representative price, it uses `zone.center`. No information is lost.

---

### PriceZone Type

```typescript
type ZoneState  = 'active' | 'tested' | 'strengthened' | 'weakening' | 'broken' | 'flipped' | 'archived'
type ZoneOrigin = 'swing-high' | 'swing-low' | 'merged'

interface PriceZone {
  /** Unique identifier, e.g. "sr-001" */
  id: string

  type: 'support' | 'resistance'

  /** How this zone was created */
  origin: ZoneOrigin

  /** Current lifecycle state */
  state: ZoneState

  /** Midpoint between upper and lower */
  center: number

  /** Top of the zone (upper boundary) */
  upper: number

  /** Bottom of the zone (lower boundary) */
  lower: number

  /** upper − lower (derived) */
  width: number

  /** Total number of times price entered the zone */
  touchCount: number

  /** Times price entered the zone and reversed back out (bounced) */
  successfulReactions: number

  /** Times price entered the zone and continued through it (broke) */
  failedReactions: number

  /** True when price has closed through the zone without reversing */
  broken: boolean

  /** True when price returned to the zone from the opposite side after breaking */
  retested: boolean

  /** Candle index when this zone was first detected */
  firstDetectedIndex: number

  /** Candle index of the most recent touch, bounce, or break */
  lastInteractionIndex: number

  /** Candles elapsed since firstDetectedIndex */
  age: number

  /**
   * 0–10 evidence-weighted strength score.
   * Factors: touch count, successful reactions, failed reactions, age.
   * See ENGINE_RULES.md §12 for the scoring algorithm.
   */
  strength: number

  /**
   * 0–10 evidence alignment score.
   * Reflects how consistently the zone's history supports its current classification.
   */
  confidence: number

  /** Human-readable strings explaining this zone's properties */
  evidence: string[]
}
```

---

### SupportResistanceConfig Type

```typescript
interface SupportResistanceConfig {
  /**
   * Zone half-width = ATR × atrMultiplier.
   * Full zone width = 2 × ATR × atrMultiplier.
   * ENGINE_RULES.md default: 0.25
   */
  atrMultiplier: number

  /**
   * Two zones merge when their price ranges overlap OR when the gap between
   * them is less than ATR × mergeTolerance.
   * ENGINE_RULES.md default: 0.5
   */
  mergeTolerance: number

  /**
   * Minimum number of touches for a zone to be considered valid.
   * Zones with fewer touches are candidates but are not included in the output.
   * ENGINE_RULES.md default: 2
   */
  minTouchCount: number

  /**
   * Candles since firstDetectedIndex after which a zone is archived.
   * ENGINE_RULES.md default: 200
   */
  maxZoneAge: number

  /**
   * Number of candles to scan backward from the current candle when
   * searching for zone-forming swing points.
   * ENGINE_RULES.md default: 100
   */
  lookback: number

  /**
   * Zone strength begins decaying after this many candles of no interaction.
   * ENGINE_RULES.md default: 50
   */
  strengthDecayAge: number
}
```

---

### SupportResistanceResult Type

```typescript
interface SupportResistanceResult {
  /** All detected zones, active and archived, sorted by center descending */
  zones: PriceZone[]

  /** Zones that are not broken and type === 'support', sorted nearest first */
  activeSupport: PriceZone[]

  /** Zones that are not broken and type === 'resistance', sorted nearest first */
  activeResistance: PriceZone[]

  /** Nearest active support zone below current price (null if none) */
  nearestSupport: PriceZone | null

  /** Nearest active resistance zone above current price (null if none) */
  nearestResistance: PriceZone | null

  /** Zone whose range contains the current price (null if price is between zones) */
  currentZone: PriceZone | null

  /** Human-readable summary of key zones */
  evidence: string[]
}
```

---

### Zone Lifecycle State Transitions

```
Created from swing point
         │
         ▼
      ┌───────┐
      │ active│  (zone exists; price has not yet entered it)
      └───┬───┘
          │ price enters zone
          │ and bounces (1 reaction)
          ▼
      ┌────────┐
      │ tested │  (zone absorbed one test; status uncertain)
      └───┬────┘
          │ further bounces     │ price fails to bounce
          ▼                     ▼
  ┌─────────────┐         ┌──────────┐
  │strengthened │         │weakening │  (failed reactions accumulate)
  └──────┬──────┘         └────┬─────┘
         │                     │ price closes through
         │                     ▼
         │              ┌────────────┐
         │              │   broken   │  (zone boundary breached)
         │              └─────┬──────┘
         │                    │ price returns from opposite side
         │                    ▼
         │              ┌────────────┐
         │              │  flipped   │  (support↔resistance role reversed)
         │              └────────────┘
         │
         └──────── age > maxZoneAge ──────▶  ┌──────────┐
                                              │ archived │
                                              └──────────┘
```

Any zone may transition to `archived` when `age > maxZoneAge`, regardless
of its current state. Archived zones are retained in `result.zones` but
excluded from `activeSupport` and `activeResistance`.

---

### Future Compatibility

The `PriceZone` type is designed to absorb future S/R concepts without breaking
the existing contract:

| Future Feature | Integration Point |
|----------------|-------------------|
| Order Blocks | `origin: 'order-block'` — new `ZoneOrigin` variant |
| Fair Value Gaps | `origin: 'fair-value-gap'` — new `ZoneOrigin` variant |
| Fibonacci Levels | Zones created from Fibonacci retracements use `origin: 'fibonacci'` |
| Volume Profile | `zone.volumeWeight` field added; strength scoring updated to use it |
| Anchored VWAP | Zones near VWAP receive a `nearVwap: boolean` flag |
| Multi-Timeframe | `timeframe` field added; MTF confluence detected by zone overlap |
| Liquidity Sweeps | `liquiditySweepDetected: boolean` tracks wick-through-zone events |

The `SupportResistanceResult` contract and `PriceZone` core fields will not
change when these features are added. New fields are additive only.

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
