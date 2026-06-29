# Sentinel — Crypto Market Analysis Platform: Roadmap

## Overall Progress

`15%` — Modules 1–2 complete. 2 of 13 modules done.

---

## Module Status

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Binance Data Engine | **Complete** | OHLC, price, volume, 24H stats, funding rate, OI — 34 tests passing |
| 2 | Technical Indicator Engine | **Complete** | EMA×4, SMA×3, RSI, MACD, ATR, ADX, VWAP, BB, StochRSI, OBV, MFI, CCI, Vol MA — 97 tests passing |
| 3 | Market Structure Engine | Not Started | HH/HL/LH/LL, BOS, CHOCH, consolidation, breakout, pullback |
| 4 | Support & Resistance Engine | Not Started | Static levels, dynamic EMA S/R, pivot zones, swing levels |
| 5 | Volume Analysis Engine | Not Started | Relative volume, spikes, trend, buy/sell pressure |
| 6 | Evidence Engine | Not Started | Every conclusion must carry supporting evidence |
| 7 | Validation Engine | Not Started | Rejects hallucinations, fake numbers, unsupported claims |
| 8 | Confidence Engine | Not Started | Evidence-weighted scoring system (0–10) |
| 9 | AI Writing Engine | Not Started | Writes from validated JSON only; no data invention |
| 10 | Content Generator | Not Started | Multiple output styles from the same analysis |
| 11 | Image Generator | Not Started | Summary cards, S/R diagrams, indicator tables |
| 12 | History Database | Not Started | Persists analyses, indicators, content, images |
| 13 | Performance Tracker | Not Started | Evaluates historical analyses at 24h / 3d / 7d |

---

## Completed

- [x] Architecture design and project specification
- [x] Documentation suite (`docs/` — ARCHITECTURE, ENGINE_RULES, INDICATOR_RULES, VALIDATION_RULES, WRITING_GUIDELINES, ANALYSIS_MANIFESTO)
- [x] Project setup — Vite + React + TypeScript + Vitest
- [x] MODULE 1 — Binance Data Engine
  - [x] `types.ts` — Candle, Ticker24h, FundingRate, OpenInterest, MarketData, FetchOptions
  - [x] `constants.ts` — base URLs, limits, valid timeframes
  - [x] `client.ts` — fetch wrapper with timeout, BinanceApiError, spot + futures request helpers
  - [x] `normalise.ts` — raw API response → typed domain objects
  - [x] `endpoints.ts` — fetchCandles, fetchTicker24h, fetchFundingRate, fetchOpenInterest
  - [x] `index.ts` — fetchMarketData (public API)
  - [x] 34 unit tests passing (normalise × 11, endpoints × 13, index × 10)
- [x] MODULE 2 — Technical Indicator Engine
  - [x] `types.ts` — MACDResult, ADXResult, BollingerResult, StochRSIResult, VolumeMaResult, IndicatorResult
  - [x] `utils.ts` — emaSeries, rsiSeries (shared building blocks)
  - [x] `compute/ema.ts` — EMA20/50/100/200
  - [x] `compute/sma.ts` — SMA20/50/200
  - [x] `compute/rsi.ts` — RSI(14) with Wilder's smoothing
  - [x] `compute/macd.ts` — MACD(12,26,9) with bias
  - [x] `compute/atr.ts` — ATR(14) with Wilder's smoothing
  - [x] `compute/adx.ts` — ADX(14) with +DI/-DI
  - [x] `compute/vwap.ts` — rolling VWAP (always non-null)
  - [x] `compute/bollinger.ts` — Bollinger Bands(20,2) with bandwidth
  - [x] `compute/stoch-rsi.ts` — StochRSI(14,14,3,3) with degenerate range handling
  - [x] `compute/obv.ts` — cumulative OBV (always non-null)
  - [x] `compute/mfi.ts` — MFI(14) Money Flow Index
  - [x] `compute/cci.ts` — CCI(20) Commodity Channel Index
  - [x] `compute/volume-ma.ts` — Volume MA(20) with relative volume
  - [x] `index.ts` — computeIndicators (public API)
  - [x] 97 unit tests passing across 15 test files

---

## Current Task

Module 3 — Market Structure Engine (next)

---

## Remaining Tasks

### Foundation
- [x] Initialize project (Vite + React + TypeScript + Vitest)
- [ ] Set up PWA scaffold (manifest, service worker, responsive layout)
- [ ] Define shared data types and interfaces across all modules

### Data Layer
- [x] MODULE 1: Binance Data Engine
  - [x] Candle fetching (OHLC)
  - [x] Current price and 24H stats
  - [x] Volume data
  - [x] Funding rate (optional)
  - [x] Open interest (optional)

### Analysis Layer
- [x] MODULE 2: Technical Indicator Engine
- [ ] MODULE 3: Market Structure Engine
- [ ] MODULE 4: Support & Resistance Engine
- [ ] MODULE 5: Volume Analysis Engine

### Reasoning Layer
- [ ] MODULE 6: Evidence Engine
- [ ] MODULE 7: Validation Engine
- [ ] MODULE 8: Confidence Engine

### Output Layer
- [ ] MODULE 9: AI Writing Engine
- [ ] MODULE 10: Content Generator (multiple styles)
- [ ] MODULE 11: Image Generator

### Storage & Tracking
- [ ] MODULE 12: History Database
- [ ] MODULE 13: Performance Tracker

### UI
- [ ] Dashboard layout (navigation, coin selector, timeframe selector)
- [ ] Market snapshot panel
- [ ] Indicator dashboard
- [ ] Market structure panel
- [ ] Evidence panel
- [ ] Confidence display
- [ ] AI analysis output
- [ ] Export / copy / download / save
- [ ] History view
- [ ] Performance statistics view

### Infrastructure
- [ ] PWA installation support (Android, iOS, Windows, macOS)
- [ ] Offline handling / caching strategy
- [ ] Error handling and API rate-limit management

---

## Known Issues

None yet.

---

## Ideas for Future Improvements

- Order book snapshot analysis (liquidity mapping)
- Recent trades analysis
- Trendline detection
- Fibonacci retracement levels
- Liquidity zone detection
- Order Block detection
- Fair Value Gap (FVG) detection
- Multi-coin comparison view
- Watchlist / alerts
- Scheduled auto-analysis (e.g. daily report generation)
- Shareable analysis links
- Custom confidence scoring weights (user-configurable)
- Dark / light theme toggle
- Telegram / Discord export integration

---

## Golden Rule

> Every sentence in the final analysis must be traceable to objective market data or clearly identified as an interpretation derived from predefined rules. If a statement cannot be justified with evidence, it must not appear in the final content.
