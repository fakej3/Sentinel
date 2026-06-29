# Sentinel — Changelog

All notable changes to this project are documented here.
Format: Date · Version · Summary · Modules Affected · Known Side Effects.

---

## [Unreleased]

Work in progress. No released version yet.

---

## [0.3.0] — 2026-06-29

### Added
- `src/modules/indicators/types.ts` — `MACDResult`, `ADXResult`, `BollingerResult`, `StochRSIResult`, `VolumeMaResult`, `IndicatorResult` canonical types.
- `src/modules/indicators/utils.ts` — `emaSeries` (full EMA series with SMA seed) and `rsiSeries` (Wilder's smoothing) shared building blocks.
- `src/modules/indicators/compute/ema.ts` — `computeEma(closes, period)` for EMA20/50/100/200.
- `src/modules/indicators/compute/sma.ts` — `computeSma(closes, period)` for SMA20/50/200.
- `src/modules/indicators/compute/rsi.ts` — `computeRsi(closes, period=14)` using Wilder's smoothing.
- `src/modules/indicators/compute/macd.ts` — `computeMacd(closes)` — MACD(12,26,9) with histogram bias (bullish/bearish/neutral). EMA series alignment ensures macdLine[k] = EMA12 − EMA26 at the same candle index.
- `src/modules/indicators/compute/atr.ts` — `computeAtr(highs, lows, closes, period=14)` using Wilder's smoothing on true range.
- `src/modules/indicators/compute/adx.ts` — `computeAdx(highs, lows, closes, period=14)` — ADX with +DI and −DI. Requires ≥ period×2 candles.
- `src/modules/indicators/compute/vwap.ts` — `computeVwap(candles)` — rolling VWAP; always returns a number (falls back to last close when volume=0).
- `src/modules/indicators/compute/bollinger.ts` — `computeBollinger(closes, period=20, stdDev=2)` — upper/middle/lower bands with bandwidth.
- `src/modules/indicators/compute/stoch-rsi.ts` — `computeStochRsi(closes, rsiPeriod=14, stochPeriod=14, kSmooth=3, dSmooth=3)` — handles degenerate range=0 case by returning 0.
- `src/modules/indicators/compute/obv.ts` — `computeObv(candles)` — cumulative On-Balance Volume; always returns a number.
- `src/modules/indicators/compute/mfi.ts` — `computeMfi(highs, lows, closes, volumes, period=14)` — Money Flow Index; requires period+1 candles.
- `src/modules/indicators/compute/cci.ts` — `computeCci(highs, lows, closes, period=20)` — Commodity Channel Index with 0.015 constant factor; returns 0 when mean deviation=0.
- `src/modules/indicators/compute/volume-ma.ts` — `computeVolumeMa(volumes, period=20)` — volume SMA with relative volume ratio.
- `src/modules/indicators/index.ts` — public `computeIndicators(candles)` API returning full `IndicatorResult`. Computes `atrPercent = (atr / lastClose) * 100`.
- 97 unit tests across 15 test files — all passing.

### Modules Affected
- MODULE 2 — Technical Indicator Engine: **complete**.

### Known Side Effects
- None.

---

## [0.2.0] — 2026-06-29

### Added
- Project scaffold: Vite 5 + React 18 + TypeScript 5 + Vitest 2.
- `src/modules/binance/types.ts` — canonical types: `Candle`, `Ticker24h`, `FundingRate`, `OpenInterest`, `MarketData`, `FetchOptions`, `Timeframe`.
- `src/modules/binance/constants.ts` — `SPOT_BASE_URL`, `FUTURES_BASE_URL`, `DEFAULT_CANDLE_LIMIT` (200), `MAX_CANDLE_LIMIT` (1000), `REQUEST_TIMEOUT_MS` (10s), `VALID_TIMEFRAMES` set.
- `src/modules/binance/client.ts` — `BinanceApiError` class; `spotRequest` and `futuresRequest` helpers with AbortController timeout, HTTP error parsing, and network error wrapping.
- `src/modules/binance/normalise.ts` — raw API tuple/object → typed domain objects: `normaliseCandle`, `normaliseCandles`, `normaliseTicker24h`, `normaliseFundingRate`, `normaliseOpenInterest`. `takerSellVolume` derived as `volume − takerBuyVolume`.
- `src/modules/binance/endpoints.ts` — `fetchCandles` (with limit clamping 1–1000), `fetchTicker24h`, `fetchFundingRate`, `fetchOpenInterest`.
- `src/modules/binance/index.ts` — public `fetchMarketData(symbol, timeframe, options?)` API. Validates timeframe, upcases symbol, fetches candles + ticker concurrently, conditionally fetches funding rate and open interest.
- `src/App.tsx` — minimal interactive harness that calls `fetchMarketData` and renders the raw output. Used to validate Module 1 end-to-end in the browser.
- 34 unit tests: 11 normalise, 13 endpoints, 10 index — all passing.

### Modules Affected
- MODULE 1 — Binance Data Engine: **complete**.

### Known Side Effects
- None.

---

## [0.1.1] — 2026-06-29

### Added
- `docs/ANALYSIS_MANIFESTO.md` — 12 core principles governing every design decision: data first, explain before predicting, transparency over certainty, no hidden reasoning, AI as writer only, evidence-required statements, balanced bullish/bearish reporting, prohibited absolute language, confidence-is-not-probability, educational value, institutional tone, and continuous improvement.

### Modules Affected
- None (documentation only).

### Known Side Effects
- None.

---

## [0.1.0] — 2026-06-29

### Added
- `ROADMAP.md` — full project module tracking, progress percentage, remaining tasks, known issues, future ideas.
- `docs/ARCHITECTURE.md` — system architecture, pipeline diagram, module responsibilities, shared data structures, design principles.
- `docs/ENGINE_RULES.md` — all market rules: trend rules, market structure detection (HH/HL/LH/LL, BOS, CHOCH), RSI/MACD/EMA/ATR/ADX/volume classification, confidence scoring weights, S/R detection rules.
- `docs/INDICATOR_RULES.md` — all 13 indicators documented with purpose, calculation, interpretation, limitations, and dependencies.
- `docs/VALIDATION_RULES.md` — 3-stage validation protocol, per-claim validation rules, rejection protocol, contradiction detection, audit log format.
- `docs/WRITING_GUIDELINES.md` — AI writer rules, banned phrases, content styles, required structure, prompt requirements, example mappings.
- `docs/CHANGELOG.md` — this file.

### Modules Affected
- None (documentation only — no code written yet).

### Known Side Effects
- None.

---

*Entries are added here after every completed feature, module, or significant change.*
*Format: `## [version] — YYYY-MM-DD` followed by Added / Changed / Fixed / Removed sections.*
