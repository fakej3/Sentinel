# Sentinel — Crypto Market Analysis Platform: Roadmap

## Overall Progress

`0%` — Architecture defined. Development not yet started.

---

## Module Status

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Binance Data Engine | Not Started | OHLC, price, volume, 24H stats, funding rate, OI |
| 2 | Technical Indicator Engine | Not Started | EMA, SMA, RSI, MACD, ATR, ADX, VWAP, BB, StochRSI, OBV, MFI, CCI, Vol MA |
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

---

## Current Task

None — awaiting development start.

---

## Remaining Tasks

### Foundation
- [ ] Initialize project (framework, tooling, folder structure)
- [ ] Set up PWA scaffold (manifest, service worker, responsive layout)
- [ ] Define shared data types and interfaces across all modules

### Data Layer
- [ ] MODULE 1: Binance Data Engine
  - [ ] Candle fetching (OHLC)
  - [ ] Current price and 24H stats
  - [ ] Volume data
  - [ ] Funding rate (optional)
  - [ ] Open interest (optional)

### Analysis Layer
- [ ] MODULE 2: Technical Indicator Engine
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
