# Sentinel — Changelog

All notable changes to this project are documented here.
Format: Date · Version · Summary · Modules Affected · Known Side Effects.

---

## [Unreleased]

Work in progress. No released version yet.

---

## [0.9.0] — 2026-06-30

### MODULE 6 — Analysis Engine

#### Added

- **`src/modules/analysis/types.ts`** — `PriceSummary`; `FullTrendLabel` (7-value union), `TrendConditions` (9 bullish + 9 bearish + 4 neutral booleans), `FullTrendResult`; `EMALabel`, `EMAAlignmentState`, `EMAConfluenceZone`, `EMAContextResult`; `RSIClassification`, `RSIInterpretation`, `MACDInterpretation`, `ADXTrendStrength`, `ADXInterpretation`, `BollingerBandwidthState`, `PriceVsBands`, `BollingerInterpretation`, `StochRSIInterpretation`, `IndicatorSummaryResult`; `SRContextResult`; `ClimaxSignalType`, `VolumeContextResult`; `EvidenceImpact`, `ModuleSource`, `EvidenceItem`; `AnalysisConfig`; `MarketAnalysisResult`.

- **`src/modules/analysis/config.ts`** — `DEFAULT_ANALYSIS_CONFIG` (13 parameters, all documented in ENGINE_RULES.md §14.5).

- **`src/modules/analysis/compute/price.ts`** — `extractPriceSummary`: reads `MarketData.ticker` for price/24h stats; projects `atrPercent` from `IndicatorResult`.

- **`src/modules/analysis/compute/full-trend.ts`** — `synthesizeFullTrend`: evaluates all 5 bullish, 5 bearish, and 4 neutral conditions per ENGINE_RULES.md §1; assigns 7-value `FullTrendLabel`; exposes raw `TrendConditions` for Module 7 validation.

- **`src/modules/analysis/compute/ema-context.ts`** — `computeEMAContext`: detects bullish/bearish/mixed/unavailable EMA stack alignment; identifies EMA confluence zones using sorted-group algorithm within `emaConfluencePercent` tolerance.

- **`src/modules/analysis/compute/indicators.ts`** — `interpretIndicators`: RSI 5-tier classification (oversold/weak_bearish/neutral/healthy_bullish/overbought); MACD bias from macdLine vs signalLine; ADX 5-tier strength + dominant direction from DI+/DI−; Bollinger bandwidth state + price vs bands; StochRSI overbought/oversold zone.

- **`src/modules/analysis/compute/sr-context.ts`** — `deriveSRContext`: distance from price to nearest support/resistance (as % of price); approaching flags (within configurable proximity %); strongest active zone by strength score.

- **`src/modules/analysis/compute/volume-context.ts`** — `buildVolumeContext`: projects all relevant Module 5 fields into `VolumeContextResult`; resolves `ClimaxSignalType` enum from buyingClimax/sellingClimax/exhaustion flags.

- **`src/modules/analysis/compute/evidence.ts`** — `collectEvidence`: ~57 canonical evidence items; factor names match ENGINE_RULES.md §14.4 exactly; items sorted high → medium → low impact.

- **`src/modules/analysis/index.ts`** — `computeAnalysis(marketData, indicators, marketStructure, supportResistance, volumeAnalysis, config?)` public API. Sequential 8-step pipeline. Re-exports all public types and `DEFAULT_ANALYSIS_CONFIG`.

- **`src/modules/analysis/__tests__/helpers.ts`** — `candle()`, `marketData()`, `indicators()`, `macd()`, `adx()`, `bollinger()`, `stochRsi()`, `bullishIndicators()`, `bearishIndicators()`, `emptyStructure()`, `bullishStructure()`, `bearishStructure()`, `priceZone()`, `emptySupportResistance()`, `emptyVolumeAnalysis()`.

- **115 unit tests** across 8 test files: price × 5, full-trend × 14, ema-context × 12, indicators × 27, sr-context × 11, volume-context × 13, evidence × 15, index × 18.

#### Changed

- **`docs/ENGINE_RULES.md`** — §8 volume classification thresholds corrected (1.5/2.5 not 2.0/3.0, to match Module 5 code). Added §14 Analysis Engine Rules: full trend synthesis (§14.1), EMA context (§14.2), S/R context (§14.3), evidence items canonical table (§14.4), default configuration (§14.5). Heading renamed from "Evidence Engine" to "Analysis Engine".

- **`docs/DECISIONS.md`** — Added ADR-016 (FullTrendLabel 7-value union), ADR-017 (EvidenceItem has no points field), ADR-018 (computeAnalysis receives MarketData not Candle[]), ADR-019 (pass-through raw results in MarketAnalysisResult).

- **`docs/KNOWN_LIMITATIONS.md`** — Added Module 6 section with LIM-023 (RSI divergence not detectable), LIM-024 (MACD crossover not detectable), LIM-025 (ATR percentile unavailable), LIM-026 (StochRSI crossover not detectable), LIM-027 (volume trend acceleration unavailable).

- **`docs/ROADMAP.md`** — Progress 38% → 46%. Module 6 status: Not Started → Complete. Added Module 6 completed file list. Updated current task to Module 7.

- **`docs/TESTING_STRATEGY.md`** — Updated test count: 390/40 → 505/48.

### Modules Affected

- MODULE 6 — Analysis Engine: **complete**. 115 tests passing.

### Test count: 505 tests passing (390 prior + 115 new)

### Known Side Effects

- None. Module 6 reads from but does not modify Modules 1–5.

---

## [0.8.0] — 2026-06-30

### MODULE 5 — Volume Analysis Engine

#### Added

- **`src/modules/volume-analysis/types.ts`** — `VolumeClassification`, `VolumeTrendDirection`, `DominantSide`, `AccDistState`, `OBVDirection`; `RelativeVolumeResult`, `VolumeTrendResult`, `BuySellPressureResult`, `VolumeConfirmationResult`, `ClimaxResult`, `AccumulationDistributionResult`, `OBVAnalysisResult`, `VWAPAnalysisResult`, `VolumeAnalysisResult`, `VolumeAnalysisConfig`.

- **`src/modules/volume-analysis/config.ts`** — `DEFAULT_CONFIG` (14 parameters, all documented in ENGINE_RULES.md §13.11).

- **`src/modules/volume-analysis/compute/utils.ts`** — `linearRegression` (OLS; returns `{ slope, r² }`; handles n < 2, SSxx = 0, SSyy = 0); `localOBVSeries` (window-based OBV starting from 0).

- **`src/modules/volume-analysis/compute/relative-volume.ts`** — `computeRelativeVolume`: uses `indicators.volumeMA` when non-null; falls back to raw prior candles. Current bar is always excluded from the average.

- **`src/modules/volume-analysis/compute/volume-trend.ts`** — `computeVolumeTrend`: OLS regression on volumes over `volumeTrendWindow` candles; normalized slope determines direction; `confidence = clamp(r² × 10, 0, 10)`.

- **`src/modules/volume-analysis/compute/buy-sell-pressure.ts`** — `computeBuySellPressure`: sums `takerBuyVolume` and `takerSellVolume` from Binance kline data over `pressureWindow` candles; computes delta, deltaPercent, dominantSide.

- **`src/modules/volume-analysis/compute/volume-confirmation.ts`** — `computeVolumeConfirmation`: confirmed, reason, supportsTrend, supportsBreakout, supportsBOS, supportsCHOCH. Historical BOS/CHoCH volume ratios computed from raw prior bars.

- **`src/modules/volume-analysis/compute/climax.ts`** — `computeClimax`: buying climax, selling climax (high volume + large body + multi-bar directional close), exhaustion (high volume + small body). 10-candle lookback for multi-bar high/low.

- **`src/modules/volume-analysis/compute/accumulation-distribution.ts`** — `computeAccumulationDistribution`: rule-based composite score −10..+10 from 14 signal categories; state = accumulation / distribution / neutral based on score > ±3.

- **`src/modules/volume-analysis/compute/obv-analysis.ts`** — `computeOBVAnalysis`: local OBV series regression vs price close regression; direction, confirmingPrice, diverging.

- **`src/modules/volume-analysis/compute/vwap-analysis.ts`** — `computeVWAPAnalysis`: above/below, distancePercent, respectingVWAP (proximity OR 5-candle cross detection).

- **`src/modules/volume-analysis/compute/strength.ts`** — `computeOverallStrength`: 0–10 composite from relative volume (max 3), trend confidence (max 2), pressure imbalance (max 2), OBV confirmation (max 1), acc/dist (max 2).

- **`src/modules/volume-analysis/compute/evidence.ts`** — `buildEvidence`: aggregates factual strings from all sub-results into the top-level `evidence[]` array.

- **`src/modules/volume-analysis/index.ts`** — `computeVolumeAnalysis(candles, indicators, marketStructure, supportResistance, config?)` public API. Merges partial config with defaults. Re-exports all public types.

- **`src/modules/volume-analysis/__tests__/helpers.ts`** — `candle()`, `flatCandles()`, `emptyIndicators()`, `emptyStructure()`, `emptySupportResistance()`.

- **72 unit tests** across 10 test files: relative-volume × 12, volume-trend × 7, buy-sell-pressure × 8, volume-confirmation × 9, climax × 6, accumulation-distribution × 4, obv-analysis × 6, vwap-analysis × 7, strength × 5, index × 8.

#### Changed

- **`docs/ENGINE_RULES.md`** — Added §13 Volume Analysis Rules (§13.1–§13.11): public API, relative volume, volume trend, buy/sell pressure, confirmation, climax/exhaustion, accumulation/distribution, OBV analysis, VWAP analysis, strength scoring, and default configuration table.

- **`docs/ARCHITECTURE.md`** — Updated MODULE 5 description with full capability list.

- **`docs/ROADMAP.md`** — Progress 31% → 38%. Module 5 status: Not Started → Complete. Added Module 5 completed file list. Updated current task to Module 6.

- **`docs/KNOWN_LIMITATIONS.md`** — Added Module 5 section with LIM-020 (VWAP cross approximation), LIM-021 (10-candle climax lookback), LIM-022 (fixed acc/dist weights).

- **`docs/TESTING_STRATEGY.md`** — Updated test count: 318/30 → 390/40.

### Modules Affected

- MODULE 5 — Volume Analysis Engine: **complete**. 72 tests passing.

### Test count: 390 tests passing (318 prior + 72 new)

### Known Side Effects

- None. Module 5 has no dependencies on future modules and does not modify any existing module.

---

## [0.7.1] — 2026-06-30

### Module 4 Stabilization — Post-Audit v0.2

#### Fixed

- **H-001 — Remove module-level mutable state** (`src/modules/support-resistance/zones.ts`):
  Removed `let zoneCounter = 0`, `resetZoneCounter()`, and `nextZoneId()`. Zone IDs are
  now generated locally within `createZoneCandidates` using the new `idOffset` parameter.
  `computeSupportResistance` is now fully stateless — calling it twice with identical input
  always produces identical output (enforced by the new determinism test).

- **H-002 — Remove duplicated ATR implementation** (`src/modules/support-resistance/zones.ts`,
  `src/modules/support-resistance/index.ts`, `src/modules/indicators/index.ts`):
  Removed `computeAtr(candles: Candle[])` from `zones.ts`. Module 4 now uses Module 2's
  canonical `computeAtr(highs, lows, closes, period)` exported from `src/modules/indicators`.
  `createZoneCandidates` now accepts an `atr: number | null` parameter. The caller
  (`computeSupportResistance`) computes ATR via Module 2 and passes it in.

- **H-003 — Fix pipeline order** (`src/modules/support-resistance/index.ts`):
  Pipeline is now **Create → Merge → Interactions → Filter → Finalize → Classify**.
  Previously the order was Create → Interactions → Filter → Merge, which caused
  interactions to be detected against pre-merge zone boundaries — systematically
  underestimating interaction history for merged zones.

- **M-001 — Fix test helper import path** (`src/modules/support-resistance/__tests__/helpers.ts`):
  Changed import of `MarketStructureResult` and `SwingPoint` from internal
  `'../../market-structure/types'` to public `'../../market-structure'` index.

- **M-002 — Fix VolumeMA self-reference** (`src/modules/indicators/compute/volume-ma.ts`):
  `computeVolumeMa` now uses prior bars only (`volumes.slice(-(period+1), -1)`).
  Minimum input length is now `period + 1`. Previously the current bar was included
  in the MA, inflating the baseline on high-volume candles.

#### Added

- **L-001 — Determinism test** (`src/modules/support-resistance/__tests__/index.test.ts`):
  Added a test that calls `computeSupportResistance` twice with identical input and
  asserts `JSON.stringify(r1) === JSON.stringify(r2)`.

- **L-007 — Remove internal exports** (`src/modules/support-resistance/zones.ts`):
  `zoneHalfWidth` is now an unexported internal function (was previously exported
  for test access). Its behavior is covered indirectly via `createZoneCandidates` tests.

#### Changed

- **`src/modules/support-resistance/__tests__/zones.test.ts`**: Removed `computeAtr`
  tests (function removed from zones.ts), removed `zoneHalfWidth` tests (unexported),
  removed `resetZoneCounter` beforeEach, updated `createZoneCandidates` calls to pass
  `atr` parameter. Added `idOffset` test and ATR-based width test.

- **`src/modules/support-resistance/__tests__/index.test.ts`**: Removed
  `resetZoneCounter` import and `beforeEach` call.

- **`src/modules/indicators/__tests__/volume-ma.test.ts`**: Updated test assertions to
  match the prior-bars-only MA convention.

- **`docs/ENGINE_RULES.md` §12**: Added "Pipeline Order" section documenting the
  Create → Merge → Interactions → Filter → Finalize order. Updated §12.2 to document
  that ATR comes from Module 2's `computeAtr`. Updated §12.5 to document state
  priority explicitly (`weakening` takes priority over `strengthened` when both conditions hold).

- **`docs/ARCHITECTURE.md`**: Fixed JSON schema — `activeSupport` and `activeResistance`
  now show `PriceZone[]` abbreviated objects instead of incorrect string arrays. Fixed
  `nearestSupport` and `nearestResistance` to show `PriceZone` objects instead of
  string IDs. (M-004)

- **`docs/KNOWN_LIMITATIONS.md`**: Updated LIM-015 (ATR now shared from Module 2,
  not duplicated). Added LIM-017 (merge-before-interactions constituent touch
  double-counting tradeoff), LIM-018 (look-ahead bias in `didReverseWithin3`),
  LIM-019 (VolumeMA prior-bars-only convention; minimum input `period + 1`).

- **`docs/DECISIONS.md`**: Added ADR-014 (pipeline order: merge before interactions)
  and ADR-015 (computeAtr exported from Module 2, not duplicated in Module 4).
  Updated ADR-011 test count.

- **`docs/INDICATOR_RULES.md`**: Updated §13 VolumeMA calculation to document
  prior-bars-only convention and new minimum input requirement. Updated footer.

- **`docs/TESTING_STRATEGY.md`**: Updated test count from 227/25 to 318/30.

### Modules Affected

- MODULE 2 — Technical Indicator Engine: VolumeMA fix (prior bars only); `computeAtr` exported.
- MODULE 4 — Support & Resistance Engine: H-001, H-002, H-003 fixes; pipeline order corrected;
  mutable global state removed; duplicate ATR removed.

### Test count: 318 tests passing (30 test files)

### Known Side Effects

- **Breaking change:** `computeVolumeMa` now requires `volumes.length >= period + 1`
  (was `period`). Any caller passing exactly `period` volumes will now receive `null`.
- **Breaking change:** `createZoneCandidates` now requires an `atr` parameter (fourth
  argument). Callers outside the module must pass the ATR value explicitly.
- `resetZoneCounter` is removed from `zones.ts` exports. Any external caller of this
  function must be updated (internal tests already updated).

---

## [0.7.0] — 2026-06-30

### MODULE 4 — Support & Resistance Engine

#### Added

- **`src/modules/support-resistance/types.ts`** — `ZoneState`, `ZoneOrigin`, `PriceZone`, `SupportResistanceConfig`, `SupportResistanceResult`.
- **`src/modules/support-resistance/config.ts`** — `DEFAULT_CONFIG` (`atrMultiplier: 0.25`, `mergeTolerance: 0.5`, `minTouchCount: 2`, `maxZoneAge: 200`, `lookback: 100`, `strengthDecayAge: 50`).
- **`src/modules/support-resistance/zones.ts`** — `createZoneCandidates` (zone seeds from swing points), `computeAtr` (Wilder's 14-period), `zoneHalfWidth` (ATR × multiplier; 0.3% fallback), `resetZoneCounter` (deterministic IDs per call).
- **`src/modules/support-resistance/merge.ts`** — `mergeZones`: greedy nearest-first merge. Zones of same type merge when gap < ATR × `mergeTolerance`. Merged zone properties (center, upper, lower, counts) computed per ENGINE_RULES.md §12.3.
- **`src/modules/support-resistance/interactions.ts`** — `applyInteractions`: non-mutating candle-by-candle scan. Detects touches, successful reactions (bounces), failed reactions (breaks with close-only confirmation, 3-candle reversal window), and retests (broken zone re-entered; close must confirm new role).
- **`src/modules/support-resistance/strength.ts`** — `computeStrength` (ENGINE_RULES.md §12.6 formula; clamped 0–10), `computeZoneConfidence` (reaction ratio scoring), `deriveState` (7-state machine per §12.5).
- **`src/modules/support-resistance/evidence.ts`** — `buildZoneEvidence` (per-zone strings), `buildResultEvidence` (result summary with nearest zones and active count).
- **`src/modules/support-resistance/index.ts`** — `computeSupportResistance(candles, marketStructure, config?)` public API. 9-step pipeline: validate → ATR → zone candidates → interactions → minTouchCount filter → merge (support and resistance separately) → finalize state/strength/confidence/evidence → classify active/nearest/current → build result evidence. Re-exports `DEFAULT_CONFIG` and all public types.
- **`src/modules/support-resistance/__tests__/helpers.ts`** — Shared test factories: `candle()`, `flatCandles()`, `emptyStructure()`, `swing()`, `withSwings()`.
- **93 unit tests** across 5 test files (zones × 12, merge × 13, strength × 17, interactions × 14, index × 37).

#### Changed

- **`docs/ROADMAP.md`** — Overall progress 25% → 31%. Module 4 status: Not Started → Complete. Completed section updated with full Module 4 file list.
- **`docs/CHANGELOG.md`** — This entry.
- **`docs/KNOWN_LIMITATIONS.md`** — Module 4 section: LIM-015 and LIM-016 promoted from "future" notes to tracked open items.

### Modules Affected

- MODULE 4 — Support & Resistance Engine: **complete**. 93 tests passing.

### Test count: 320 tests passing (227 prior + 93 new)

### Known Side Effects

- None. Module 4 has no dependencies on future modules and does not modify any existing module.

---

## [0.6.1] — 2026-06-30

### Architectural Improvement — Support & Resistance as Price Zones

#### Changed

- **`docs/ARCHITECTURE.md`** — Updated Module 4 description to reflect the zone-based design. Replaced `"levels"` object (flat scalar arrays) in the shared data structure JSON with `"supportResistance"` (zone objects with full `PriceZone` shape). Added "Price Zone Architecture" section containing: rationale for zones vs lines; canonical `PriceZone`, `SupportResistanceConfig`, and `SupportResistanceResult` TypeScript type definitions; zone lifecycle state transition diagram; and future compatibility table mapping planned features (Order Blocks, FVGs, Fibonacci, Volume Profile, etc.) to `PriceZone` fields.

- **`docs/ENGINE_RULES.md` §12** — Rewrote "Support & Resistance Detection Rules" as "Support & Resistance Zone Rules". New content: §12.1 Zone Creation (swing-high → resistance, swing-low → support; `minTouchCount` gate); §12.2 Zone Width (ATR × `atrMultiplier`; degenerate fallback; never hardcode); §12.3 Zone Merging (greedy nearest-first; merge condition; merged zone property rules; do not merge opposite types); §12.4 Zone Interaction Detection (touch, successful reaction, failed reaction, retest definitions with close-based rules); §12.5 Zone State Machine (7 states: active, tested, strengthened, weakening, broken, flipped, archived; state transition table); §12.6 Zone Strength Scoring (raw points formula: base + touches + reactions − failures + retest bonus − age decay; normalize to 0–10; 4-tier classification); §12.7 Zone Proximity Classification (inside/overhead/near/distant; nearest support/resistance definitions).

- **`docs/DECISIONS.md`** — Added ADR-013: Support & Resistance as Price Zones. Documents the decision, the reasoning (5 points), alternatives considered (static lines, classical pivots, EMA-based), tradeoffs table, and future benefits table showing how all planned S/R concepts map to `PriceZone` with a new `origin` value.

- **`docs/VALIDATION_RULES.md` §2e** — Updated "Support and Resistance Claims" validation rules to reference `supportResistance.zones[]` and `PriceZone` fields (`zone.center`, `zone.strength`, `zone.broken`, `zone.state`, `zone.touchCount`) instead of the former scalar `levels.support[]` and `levels.resistance[]` arrays.

- **`docs/KNOWN_LIMITATIONS.md`** — Added two new entries: LIM-015 (zone width requires ATR from Module 2; fallback documented) and LIM-016 (classical pivot points not modeled as zones; deferred to post-v1.0.0).

#### Added

- No new source files (architecture definition only; Module 4 implementation not yet started).

### Modules Affected

- MODULE 4 — Support & Resistance Engine: architecture defined. Implementation pending.
- docs: ARCHITECTURE.md, ENGINE_RULES.md, DECISIONS.md, VALIDATION_RULES.md, KNOWN_LIMITATIONS.md.

### Known Side Effects

- None. No existing module contracts were changed. `MarketStructureResult`, `IndicatorResult`, and `MarketData` types are unaffected.

---

## [0.6.0] — 2026-06-30

### Milestone 0.4 — Engineering Standards

#### Added

- `docs/QUALITY_GATE.md` — Permanent Definition of Done for every module. Seven sections: Code Quality (clean architecture, no dead code, meaningful naming, modular design, documented public API), Correctness (determinism, explainability, no AI calculations, no silent failures, no magic numbers, configurable thresholds, numerical stability, edge case handling), Testing (required test categories and quality bar), Documentation (required doc updates per module), Performance (allocation, redundant calculation, complexity, scalability), Architecture (module boundaries, no circular dependencies, shared contracts), and an Engineering Review checklist (7 questions). Concludes with a formal Definition of Done checklist.

- `docs/VERSIONING.md` — Complete semantic versioning strategy. Defines PATCH/MINOR/MAJOR rules with examples. Documents the development milestone roadmap (0.x through 3.0.0): v1.0.0 = complete deterministic analysis engine; v1.5.0 = AI Writing Engine; v2.0.0 = multi-exchange; v3.0.0 = institutional platform. Branching strategy, release process (9-step checklist), and stability expectations per version series.

- `docs/TESTING_STRATEGY.md` — Permanent testing handbook. Philosophy section (correctness over coverage, determinism as first-class guarantee, regression prevention, tests as documentation). Six implemented test categories (unit, integration, regression, boundary, invalid input, property) with naming patterns and code examples. Two future categories (historical replay, TradingView comparison). Naming conventions, folder structure, mock strategy (network: vi.stubGlobal; time/randomness: not needed), test factory patterns (canonical `candle()` factory and scenario builders), reference dataset plan, and CI expectations.

- `docs/DECISIONS.md` — Architecture Decision Records (ADR). 12 records: ADR-001 (Deterministic Analysis Engine), ADR-002 (AI Is a Writer Not an Analyst), ADR-003 (Canonical 0–10 Confidence Scale), ADR-004 (Server-Side Binance Proxy), ADR-005 (Structural Bias vs Full Trend), ADR-006 (Modular Pipeline Architecture), ADR-007 (Configuration Over Hardcoding), ADR-008 (Evidence-First Analysis), ADR-009 (Validation Before Publishing), ADR-010 (Wilder's Smoothing for RSI and ATR), ADR-011 (Testing-First Development), ADR-012 (Documentation as Source of Truth). Each record includes decision, reason, alternatives considered, tradeoffs, consequences, and review date.

- `docs/KNOWN_LIMITATIONS.md` — Permanent record of intentional limitations and accepted technical debt. 14 open entries organized into sections: Indicator Engine (VWAP cumulative not session-based; TradingView parity not verified; StochRSI returns 0 on flat series), Market Structure (historical replay not implemented; structural bias ≠ full trend), Infrastructure (server-side proxy required; no rate limiting; no retry strategy), Performance (no caching; no multi-market optimization), AI Layer (writing engine not implemented; hallucination benchmarking not implemented), Testing (no historical replay suite; no performance benchmarks), Future Features (11 deferred analysis capabilities). Resolved section tracks 6 limitations fixed in v0.5.0.

### Modules Affected

- None (documentation only).

### Known Side Effects

- None.

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
