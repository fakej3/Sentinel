# Sentinel — Crypto Market Analysis Platform: Roadmap

## Overall Progress

`77%` — Modules 1–10 complete + Engineering Standards established. Foundation stable.

---

## Module Status

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 1 | Binance Data Engine | **Complete** | OHLC, price, volume, 24H stats, funding rate, OI — 34 tests passing |
| 2 | Technical Indicator Engine | **Complete** | EMA×4, SMA×3, RSI, MACD, ATR, ADX, VWAP, BB, StochRSI, OBV, MFI, CCI, Vol MA — 97 tests passing |
| 3 | Market Structure Engine | **Complete** | Swing detection, HH/HL/LH/LL labeling, BOS, CHOCH, consolidation, breakout, pullback — 88 tests passing |
| 4 | Support & Resistance Engine | **Complete** | Price zones from swing points, ATR-based width, greedy merge, interaction detection, zone state machine, strength scoring — 93 tests passing |
| 5 | Volume Analysis Engine | **Complete** | Relative volume, trend (OLS), buy/sell pressure, climax, exhaustion, acc/dist, OBV, VWAP — 72 tests passing |
| 6 | Analysis Engine | **Complete** | Full trend synthesis (5-condition), EMA context, indicator interpretation, S/R context, volume context, evidence collection — 115 tests passing |
| 7 | Validation Engine | **Complete** | Completeness, consistency, contradiction, structural checks — 84 tests passing |
| 8 | Confidence Engine | **Complete** | Evidence-weighted scoring system (0–10) — 80 tests passing |
| 9 | AI Writing Engine | **Complete** | Template engine; 6 output formats; critical validation gate; banned phrases enforced — 131 tests passing |
| 10 | Analysis Pipeline Orchestrator | **Complete** | Single public entry point; orchestrates Modules 1–9; dependency-injectable fetch; typed errors; per-stage timings — 33 tests passing |
| 11 | Image Generator | Not Started | Summary cards, S/R diagrams, indicator tables |
| 12 | History Database | Not Started | Persists analyses, indicators, content, images |
| 13 | Performance Tracker | Not Started | Evaluates historical analyses at 24h / 3d / 7d |

---

## Completed

- [x] Architecture design and project specification
- [x] Documentation suite (`docs/` — ARCHITECTURE, ENGINE_RULES, INDICATOR_RULES, VALIDATION_RULES, WRITING_GUIDELINES, ANALYSIS_MANIFESTO)
- [x] Engineering Standards (QUALITY_GATE, VERSIONING, TESTING_STRATEGY, DECISIONS, KNOWN_LIMITATIONS)
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
- [x] MODULE 3 — Market Structure Engine
- [x] MODULE 4 — Support & Resistance Engine
  - [x] `types.ts` — ZoneState, ZoneOrigin, PriceZone, SupportResistanceConfig, SupportResistanceResult
  - [x] `config.ts` — DEFAULT_CONFIG (atrMultiplier: 0.25, mergeTolerance: 0.5, minTouchCount: 2, maxZoneAge: 200, lookback: 100, strengthDecayAge: 50)
  - [x] `zones.ts` — Zone candidates from swing points, ATR computation (Wilder's), zone width with fallback
  - [x] `merge.ts` — Greedy nearest-first merge (gap < ATR × mergeTolerance)
  - [x] `interactions.ts` — Touch, bounce, break, retest detection; close-only confirmation; non-mutating
  - [x] `strength.ts` — Strength scoring (ENGINE_RULES.md §12.6), confidence, state machine
  - [x] `evidence.ts` — Per-zone evidence strings + result summary evidence
  - [x] `index.ts` — computeSupportResistance (public API); 9-step pipeline; DEFAULT_CONFIG + all types re-exported
  - [x] 93 unit tests passing across 5 test files
  - [x] `types.ts` — SwingPoint, StructureEvent, MarketStructureResult, MarketStructureConfig, and all sub-types
  - [x] `config.ts` — DEFAULT_CONFIG with all thresholds documented
  - [x] `swings.ts` — detectRawSwings (strict inequality pivot detection) + filterDominantSwings (zigzag collapse)
  - [x] `labels.ts` — labelSwings: HH/HL/LH/LL/EH/EL relative to previous same-type swing; non-mutating
  - [x] `trend.ts` — countStructure + determineTrend: bull/bear ratio with recent-window sliding view, strong/moderate/weak strength
  - [x] `bos-choch.ts` — detectBosChoch: chronological forward scan; close-only rule; bias tracking; each level fires once; CHOCH flips bias
  - [x] `consolidation.ts` — detectConsolidation: last N swings, rejects HH/LL, tight range threshold
  - [x] `breakout.ts` — detectBreakout: close outside consolidation range + volume filter; failed breakout detection
  - [x] `pullback.ts` — detectPullback: after BOS, price between BOS level and anchor swing; depth ratio
  - [x] `confidence.ts` — computeConfidence: evidence-weighted 0-10 score; bullish/bearish/ranging paths
  - [x] `evidence.ts` — buildEvidence: human-readable string[] explaining every conclusion
  - [x] `index.ts` — computeMarketStructure (public API); merges partial config; factory-function empty result; type + DEFAULT_CONFIG re-exports
  - [x] 95 unit tests passing across 7 test files (88 original + 7 stabilization)

### Module 5 — Volume Analysis Engine ✅

- [x] `types.ts` — VolumeClassification, VolumeTrendDirection, DominantSide, AccDistState, OBVDirection; RelativeVolumeResult, VolumeTrendResult, BuySellPressureResult, VolumeConfirmationResult, ClimaxResult, AccumulationDistributionResult, OBVAnalysisResult, VWAPAnalysisResult, VolumeAnalysisResult, VolumeAnalysisConfig
- [x] `config.ts` — DEFAULT_CONFIG (14 parameters, all documented in ENGINE_RULES.md §13.11)
- [x] `compute/utils.ts` — linearRegression (OLS, slope + r²); localOBVSeries
- [x] `compute/relative-volume.ts` — computeRelativeVolume; prefers indicators.volumeMA; fallback to raw candles; prior-bars-only
- [x] `compute/volume-trend.ts` — computeVolumeTrend; OLS regression on volumes; normalized slope; direction + confidence
- [x] `compute/buy-sell-pressure.ts` — computeBuySellPressure; takerBuyVolume/takerSellVolume; delta, deltaPercent, dominantSide
- [x] `compute/volume-confirmation.ts` — computeVolumeConfirmation; confirmed, supportsTrend, supportsBreakout, supportsBOS, supportsCHOCH
- [x] `compute/climax.ts` — computeClimax; buyingClimax, sellingClimax, exhaustion; 10-bar lookback
- [x] `compute/accumulation-distribution.ts` — computeAccumulationDistribution; rule-based score −10..+10; accumulation/distribution/neutral
- [x] `compute/obv-analysis.ts` — computeOBVAnalysis; localOBVSeries regression vs price regression; confirmingPrice/diverging
- [x] `compute/vwap-analysis.ts` — computeVWAPAnalysis; distancePercent; respectingVWAP via proximity or 5-candle cross detection
- [x] `compute/strength.ts` — computeOverallStrength; 0–10 composite from 5 components
- [x] `compute/evidence.ts` — buildEvidence; aggregates factual strings from all sub-results
- [x] `index.ts` — computeVolumeAnalysis (public API); merges partial config; all type re-exports
- [x] 72 unit tests passing across 10 test files

### Module 6 — Analysis Engine ✅

- [x] `types.ts` — FullTrendLabel, TrendConditions, FullTrendResult; EMALabel, EMAAlignmentState, EMAConfluenceZone, EMAContextResult; RSIInterpretation, MACDInterpretation, ADXInterpretation, BollingerInterpretation, StochRSIInterpretation, IndicatorSummaryResult; SRContextResult; ClimaxSignalType, VolumeContextResult; EvidenceImpact, ModuleSource, EvidenceItem; PriceSummary; AnalysisConfig; MarketAnalysisResult
- [x] `config.ts` — DEFAULT_ANALYSIS_CONFIG (13 parameters, all documented in ENGINE_RULES.md §14.5)
- [x] `compute/price.ts` — extractPriceSummary; reads MarketData.ticker; projects atrPercent from indicators
- [x] `compute/full-trend.ts` — synthesizeFullTrend; 5 bullish / 5 bearish / 4 neutral condition evaluation; 7-value FullTrendLabel assignment per ENGINE_RULES.md §1; exposes TrendConditions for Module 7
- [x] `compute/ema-context.ts` — computeEMAContext; bullish/bearish/mixed/unavailable stack detection; confluence zone detection (sorted grouping within emaConfluencePercent)
- [x] `compute/indicators.ts` — interpretIndicators; RSI 5-tier classification; MACD bias; ADX 5-tier strength + dominant direction; Bollinger bandwidth state + price vs bands; StochRSI overbought/oversold zone
- [x] `compute/sr-context.ts` — deriveSRContext; distance computation (% from price); approaching flags; strongest active zone by strength score
- [x] `compute/volume-context.ts` — buildVolumeContext; projects all relevant Module 5 fields; resolves climaxSignal enum
- [x] `compute/evidence.ts` — collectEvidence; ~57 canonical evidence items; sorted high → medium → low; all factor names match ENGINE_RULES.md §14.4
- [x] `index.ts` — computeAnalysis (public API); sequential 8-step pipeline; all types re-exported; DEFAULT_ANALYSIS_CONFIG re-exported
- [x] 115 unit tests passing across 8 test files (price×5, full-trend×14, ema-context×12, indicators×27, sr-context×11, volume-context×13, evidence×15, index×18)
- [x] ADR-016 through ADR-019 added to DECISIONS.md
- [x] LIM-023 through LIM-027 added to KNOWN_LIMITATIONS.md
- [x] ENGINE_RULES.md §14 (Analysis Engine) added; §8 volume thresholds corrected

### Module 7 — Validation Engine ✅

- [x] `types.ts` — ValidationSeverity, ValidationCategory, ValidationIssue, ValidationResult, ValidationConfig
- [x] `config.ts` — DEFAULT_VALIDATION_CONFIG (11 parameters)
- [x] `validate/completeness.ts` — checkCompleteness; price > 0; non-empty symbol; evidence count; high-impact evidence warning; condition-met range checks
- [x] `validate/consistency.ts` — checkConsistency; 8 priceAboveEMA* comparisons; 8 priceBelowEMA* comparisons; EMA order booleans; swing structure counts; RSI/MACD/ADX booleans; derived booleans; S/R zone type; 11 volume context fields
- [x] `validate/contradictions.ts` — checkContradictions; priceAboveAllEMAs/priceBelowAllEMAs derivability; mutual exclusivity checks; condition-met count tallies; trend label vs deriveTrendLabel; evidence sort order
- [x] `validate/structural.ts` — checkStructural; zone geometry (lower ≤ center ≤ upper, lower < upper, width consistency); active zone type + broken-flag; BOS/CHOCH detected vs events; last pointer; chronological order of BOS/CHOCH/events arrays
- [x] `index.ts` — validateAnalysis (public API); merges config; calls all four checkers; computes passed/clean/counts/summary; re-exports types
- [x] `__tests__/helpers.ts` — makeIndicators, makeStructure, makePriceZone, makeSupportResistance, makeVolumeAnalysis, makeTrendConditions, makeFullTrend, makeEvidence, makeValidResult
- [x] 84 unit tests passing across 5 test files (completeness×13, consistency×23, contradictions×16, structural×17, index×15)
- [x] ADR-020 added to DECISIONS.md
- [x] LIM-028 and LIM-029 added to KNOWN_LIMITATIONS.md
- [x] ENGINE_RULES.md §15 (Validation Engine) added
- [x] VALIDATION_RULES.md Stage 1 and Stage 3 updated to reflect implementation status

### Module 8 — Confidence Engine ✅

- [x] `types.ts` — ConfidenceGrade, ConfidenceReason, ConfidencePenalty, ConfidenceWarning, ConfidenceResult, ConfidenceConfig
- [x] `config.ts` — DEFAULT_CONFIDENCE_CONFIG (factorWeights map with all ENGINE_RULES.md §11 weights, normalizationDivisor: 10.6, warningScorePenalty: 0.5, criticalScoreCap: 3.0, gradeThresholds)
- [x] `compute/score.ts` — scoreEvidence (walks evidence[], looks up factorWeights, accumulates raw/bullish/bearish points, builds reasons[]); normalize()
- [x] `compute/grade.ts` — scoreToGrade (5-tier grade from normalized score using configurable thresholds)
- [x] `index.ts` — computeConfidence (public API); merges config; applies validation penalties (warning penalty, critical cap); emits advisories; re-exports all types
- [x] `__tests__/helpers.ts` — ev() evidence item factory, makeAnalysis() stub, cleanValidation(), validationWithWarnings(), validationWithCriticals(), validationWithBoth()
- [x] 80 unit tests passing across 1 test file (scoreEvidence×6, normalize×5, scoreToGrade×10, core scoring×7, directional confidence×5, validation penalties×7, warnings×4, config overrides×7, §11 factor weights×19, determinism×1, reasons×2, config integrity×3)
- [x] ENGINE_RULES.md §11 weights confirmed; all 21 factor→weight mappings verified
- [x] ARCHITECTURE.md Module 8 entry updated with implementation details
- [x] ROADMAP.md progress updated to 62%

### Module 9 — AI Writing Engine ✅

- [x] `types.ts` — WriterTemplate, WriterVerbosity, WriterInput, WriterMetadata, GeneratedAnalysis, WriterConfig
- [x] `config.ts` — DEFAULT_WRITER_CONFIG (template: 'full', verbosity: 'standard', maxSummaryLength: 600, maxReportLength: 4000, maxReasonsDisplayed: 3, maxRiskFactors: 3)
- [x] `sections.ts` — buildHeadline, buildSummary, buildTrendSection, buildIndicatorSection, buildMarketStructureSection, buildSupportResistanceSection, buildVolumeSection, buildRiskSection, buildConfidenceSection, buildValidationSection, buildConclusion, buildCriticalStubs
- [x] `compose.ts` — composeFull, composeExecutive, composeSummaryTemplate, composeBullet, composeHeadlineTemplate, composeSocial; composeReport dispatcher; buildAllSections helper
- [x] `index.ts` — generateAnalysis (public API); critical validation gate; metadata builder; all types re-exported
- [x] `__tests__/helpers.ts` — makeConfidence(), makeAnalysis(), makeBullishInput(), makeBearishInput(), makeNeutralInput(), makeWarningInput(), makeCriticalInput()
- [x] 131 unit tests passing across 1 test file
- [x] ENGINE_RULES.md §16 (Writing Engine Rules) added
- [x] ARCHITECTURE.md Module 9 entry updated with full implementation details
- [x] ROADMAP.md progress updated to 69%

---

## Current Task

Module 10 — Content Generator (not yet started).

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
- [x] MODULE 3: Market Structure Engine
- [x] MODULE 4: Support & Resistance Engine
- [x] MODULE 5: Volume Analysis Engine

### Reasoning Layer
- [x] MODULE 6: Analysis Engine
- [x] MODULE 7: Validation Engine
- [x] MODULE 8: Confidence Engine

### Output Layer
- [x] MODULE 9: AI Writing Engine
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

- StochRSI returns 0 when price range is flat (degenerate uptrend reads as "oversold"). Tracked as Medium — no fix in this phase.
- CORS: direct browser calls to Binance API are blocked. Development proxy workaround documented in ARCHITECTURE.md; production proxy deferred to Module 9+ PWA phase.

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
