# Sentinel — Changelog

All notable changes to this project are documented here.
Format: Date · Version · Summary · Modules Affected · Known Side Effects.

---

## [Unreleased]

Work in progress. No released version yet.

---

## [0.5.0] — 2026-06-30

### Foundation Stabilization — Post-Audit v0.1 (Critical + High Issues)

#### Fixed

- **C-2 — Confidence scale** (`confidence.ts`, `types.ts`, `index.ts`): `computeConfidence` now returns 0–10 (divides raw points by 10) to match ENGINE_RULES.md §11 and ARCHITECTURE.md. Previously returned 0–100.
- **C-3 — EMPTY_RESULT mutation** (`index.ts`): Replaced shared `EMPTY_RESULT` constant + shallow spread `{ ...EMPTY_RESULT }` with a `makeEmptyResult()` factory function. Each call returns independent nested objects; callers cannot accidentally share state.
- **H-2 — Breakout volume MA self-reference** (`breakout.ts`): Volume MA for breakout confirmation is now computed from `candles.slice(0, -1)` (prior candles only). Previously included the breakout candle itself, inflating the MA and suppressing confirmed signals on high-volume breakouts.

#### Added

- **C-1 — CORS architecture decision** (`docs/ARCHITECTURE.md`): Documented canonical approach (thin server-side proxy), development workaround (Vite `server.proxy`), and production constraint. Closes the open "No backend required" contradiction.
- **7 breakout tests** (`src/modules/market-structure/__tests__/breakout.test.ts`): strong/weak/borderline/self-reference confirmation, bearish breakout, failed breakout, no-consolidation guard.
- **1 mutation regression test** (`index.test.ts`): asserts two `computeMarketStructure([])` calls return independent `bos.events`, `evidence`, and `swings` arrays.

#### Changed

- **H-1 — Trend/structural bias distinction** (`types.ts`, `ENGINE_RULES.md`): Added JSDoc to `MarketStructureResult.trend` clarifying it is swing-pattern structural bias only (not full trend per ENGINE_RULES.md §1). ENGINE_RULES.md §1 updated with a note distinguishing Module 3 structural bias from the full synthesis performed by Module 6.
- **H-3 — ARCHITECTURE.md schema** (`docs/ARCHITECTURE.md`): Shared Data Structures JSON updated to match actual `MarketStructureResult` shape (`structure` object with counts, `bos`/`choch` objects, `confidence` as 0–10 float, `evidence` array, etc.).
- **H-4 — VALIDATION_RULES.md field paths** (`docs/VALIDATION_RULES.md`): Stage 2c updated to reference actual field paths (`marketStructure.structure.higherHighs > 0`, `marketStructure.bos.detected`, etc.). Stage 2d: removed invalid `"neutral"` string (not in `TrendDirection` type); replaced with `"ranging"`.
- **App.tsx `candleLimit`** (`src/App.tsx`): Changed from 5 to 200 so Module 2 and 3 indicators have enough candles to compute.
- **Type re-exports** (`src/modules/market-structure/index.ts`): All public types from `types.ts` are now re-exported from the module entry point.
- **`DEFAULT_CONFIG` export** (`src/modules/market-structure/index.ts`): `DEFAULT_CONFIG` is now re-exported from the module entry point.
- **Doc footers** (`ENGINE_RULES.md`, `VALIDATION_RULES.md`): Updated stale "Last updated: project initialization" footers.

### Modules Affected
- MODULE 3 — Market Structure Engine: bug fixes (confidence scale, EMPTY_RESULT, volume MA).
- docs: ARCHITECTURE.md, ENGINE_RULES.md, VALIDATION_RULES.md.

### Known Side Effects
- Any code reading `result.confidence` as 0–100 must be updated to expect 0–10.

---

## [0.4.0] — 2026-06-29

### Added
- `src/modules/market-structure/types.ts` — `SwingPoint`, `StructureEvent`, `MarketStructureResult`, `MarketStructureConfig`, `StructureCounts`, `PullbackResult`, `ConsolidationResult`, `BreakoutResult`, `TrendDirection`, `TrendStrength`, `SwingLabel`, `SwingType`, `StructureEventType`.
- `src/modules/market-structure/config.ts` — `DEFAULT_CONFIG`: `swingLookback=2`, `consolidationSwings=5`, `consolidationThreshold=3.0`, `breakoutVolumeMultiplier=1.3`, `minSwingsForTrend=4`, `equalThreshold=0.1`.
- `src/modules/market-structure/swings.ts` — `detectRawSwings(candles, config)`: strict inequality pivot detection (edges excluded, both sides must be strictly less/greater); `filterDominantSwings(rawSwings)`: collapses consecutive same-type pivots into a single most-extreme point (alternating zigzag).
- `src/modules/market-structure/labels.ts` — `labelSwings(dominantSwings, config)`: non-mutating; assigns HH/HL/LH/LL/EH/EL relative to previous same-type swing; `equalThreshold` (%) controls EH/EL tolerance; first of each type returns `null`.
- `src/modules/market-structure/trend.ts` — `countStructure(swings)`: full-history label counts; `determineTrend(swings, config)`: slides a window of last `minSwingsForTrend × 2` labeled swings; bull ratio ≥ 0.75 → bullish, ≤ 0.25 → bearish, else ranging; strength: strong = ratio ≥ 0.75 AND count ≥ 6 AND HH ≥ 2 AND HL ≥ 2, moderate = HH ≥ 2 AND HL ≥ 2, weak otherwise.
- `src/modules/market-structure/bos-choch.ts` — `detectBosChoch(candles, dominantSwings, config)`: chronological forward scan; swing becomes visible at index + swingLookback; close-only rule (wicks do not trigger); bias tracks last structural direction; same-direction break = BOS (continuation), opposite-direction break = CHOCH (potential reversal, flips bias); each structural level fires at most one event. Three-pass design: check existing levels first, then promote newly-confirmed swings, then check newly-promoted levels.
- `src/modules/market-structure/consolidation.ts` — `detectConsolidation(labeledSwings, config)`: checks last `consolidationSwings` swings; rejects if any label is HH or LL; computes rangePercent = (maxHigh − minLow) / minLow × 100; detects if ≤ `consolidationThreshold`%.
- `src/modules/market-structure/breakout.ts` — `detectBreakout(candles, consolidation, config)`: requires active consolidation; close above rangeHigh = bullish breakout, below rangeLow = bearish; confirmed when relative volume ≥ `breakoutVolumeMultiplier`; failed breakout = previous candle broke out but current returned inside the range.
- `src/modules/market-structure/pullback.ts` — `detectPullback(candles, labeledSwings, bosEvents)`: after last BOS, identifies anchor swing (last structural low/high before the BOS), detects pullback if close retraces between BOS level and anchor (structural violation not breached); depth ratio = (bosLevel − close) / (bosLevel − anchor).
- `src/modules/market-structure/confidence.ts` — `computeConfidence(...)`: evidence-weighted 0–100 integer; bullish path: base 20 + 10 per HH (max 3) + 10 per HL (max 3) + 20/10 strength bonus + 10 per bullish BOS (max 2) − 20 per CHOCH − 10 per LH (max 2) − 10 per LL (max 2); bearish path: symmetric; ranging: 30 + 20 if consolidation − 10 if any BOS.
- `src/modules/market-structure/evidence.ts` — `buildEvidence(...)`: returns `string[]` with one entry per conclusion; includes trend summary, structure counts, BOS/CHOCH details, consolidation range, breakout direction, pullback depth.
- `src/modules/market-structure/index.ts` — public `computeMarketStructure(candles, partialConfig?)` API; merges partial config with `DEFAULT_CONFIG`; returns `EMPTY_RESULT` when `candles.length < swingLookback × 2 + 1`; full 11-step deterministic pipeline.
- `src/modules/market-structure/__tests__/helpers.ts` — `candle()` and `candles()` test factory functions.
- 88 unit tests across 6 test files — all passing.

### Modules Affected
- MODULE 3 — Market Structure Engine: **complete**.

### Known Side Effects
- None.

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
