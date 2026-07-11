# Sentinel — System Architecture

## Overview

Sentinel is a professional crypto market analysis platform designed to produce technically accurate, data-backed content for Binance Square. It is not a trading signal generator and not a trading bot.

The system separates data collection, mathematical analysis, reasoning, validation, and writing into fully independent modules. The AI only writes. It never calculates, decides, or invent.

---

## Analysis Pipeline

> For the stage-by-stage breakdown with exact file paths, inputs, and outputs
> see [Pipeline.md](Pipeline.md).

```
Official Binance API
        │
        ▼
src/modules/binance/            — fetchMarketData()
  Raw market data (OHLC, price, volume, 24H stats, funding rate, OI)
        │
        ▼
src/modules/indicators/         — computeIndicators()
  Mathematically calculated indicators (RSI, MACD, EMA, ATR, etc.)
        │
        ▼
src/modules/market-structure/   — computeMarketStructure()
  Deterministic structure detection (HH/HL/LH/LL, BOS, CHOCH)
        │
        ▼
src/modules/support-resistance/ — computeSupportResistance()
  Price zones from swing points — touch count, interactions, strength
        │
        ▼
src/modules/volume-analysis/    — computeVolumeAnalysis()
  Relative volume, trend, climax, buy/sell pressure, A/D, OBV, VWAP
        │
        ▼
src/modules/analysis/           — computeAnalysis()
  Full trend synthesis, EMA/indicator/S&R/volume context, evidence collection
        │
        ▼
src/modules/validation/         — validateAnalysis()
  Rejects unsupported, incorrect, or contradictory claims
        │
        ▼
src/modules/confidence/         — computeConfidence()
  Evidence-weighted Confidence Score (0–10) + grade + trust
        │
        ▼
src/modules/pipeline/           — computeDecision() + computeTradePlan() + …
  Trade decision, trade plan, market context, contradiction intelligence, etc.
        │
        ▼
src/modules/writer/             — generateAnalysis()
  Deterministic report generation from structured data
        │
        ▼
src/modules/ai/                 — provider.enhance()  [optional]
  LLM enhancement of summary/conclusion (falls back if unsafe or unavailable)
        │
        ▼
PipelineResult  →  src/api/routes.ts  /  src/cli/  /  src/ui/
```

---

## Module Responsibilities

### `src/modules/binance/` — Binance Data Engine
- Source of truth for all market data.
- Only fetches. Never transforms. Never infers.
- All data comes directly from the official Binance REST API.
- Outputs raw, structured data objects.

### `src/modules/indicators/` — Technical Indicator Engine
- Pure mathematical calculations.
- No AI. No interpretation. No decisions.
- Each indicator is independently calculable from raw candle data.
- Outputs typed numerical results.

### `src/modules/market-structure/` — Market Structure Engine
- Applies predefined deterministic rules to detect market structure.
- Rules are documented in `ENGINE_RULES.md`.
- Outputs structured labels (e.g. `"trend": "bullish"`, `"structure": "HH-HL"`).

### `src/modules/support-resistance/` — Support & Resistance Engine
- Detects price zones (not lines) from swing points in the candle series.
- Every zone has a center, width derived from ATR, touch count, reaction history, and lifecycle state.
- Nearby zones are merged to avoid redundant overlapping signals.
- Zone strength and confidence are computed from touch quality, reaction count, and age.
- Rules documented in `ENGINE_RULES.md §12`.
- See also: "Price Zone Architecture" section below.

### `src/modules/volume-analysis/` — Volume Analysis Engine
- Classifies volume against historical averages (relative volume: very_low → very_high).
- Determines volume trend direction and confidence from OLS linear regression over a configurable window.
- Computes buy/sell pressure from Binance taker trade data (`takerBuyVolume` / `takerSellVolume`).
- Detects climax and exhaustion candles based on volume spikes and body/range ratios.
- Computes accumulation/distribution state via a rule-based composite score (−10 to +10).
- Analyzes local OBV trend and its relationship to price movement (confirming vs. diverging).
- Assesses VWAP proximity and crossing behaviour.
- Outputs an overall volume strength score (0–10) and full evidence strings.
- Rules documented in `ENGINE_RULES.md §13`.
- No AI, no ML, no probability guessing. Fully deterministic and configurable.

### `src/modules/analysis/` — Analysis Engine
- **Synthesis layer**: first module to see all 5 upstream outputs simultaneously.
- Determines the **full trend** (`FullTrendResult`) by evaluating 5 bullish + 5 bearish + 4 neutral conditions per ENGINE_RULES.md §1. This is authoritative; `MarketStructureResult.trend` (Module 3) is structural bias only.
- Computes `EMAContextResult`: stack alignment (bullish/bearish/mixed), confluence zones.
- Computes `IndicatorSummaryResult`: RSI tier, MACD bias, ADX strength, Bollinger state, StochRSI zone.
- Derives `SRContextResult`: distance to nearest zones, approaching flags, strongest active zones.
- Projects `VolumeContextResult` from Module 5 output.
- Collects `EvidenceItem[]`: ~57 canonical evidence items sorted by impact. Factor names match ENGINE_RULES.md §14.4 — Module 8 uses them for point-weight lookup.
- Outputs `MarketAnalysisResult` containing all derived fields plus pass-through raw results (Modules 2–5) for Module 7 validation.
- Public API: `computeAnalysis(marketData, indicators, marketStructure, supportResistance, volumeAnalysis, config?)`
- Rules documented in `ENGINE_RULES.md §14`. ADRs: 016–019.
- 115 tests passing across 8 test files.

### `src/modules/validation/` — Validation Engine
- **Gatekeeper layer**: Runs after Module 6 and before Module 8. Validates the complete `MarketAnalysisResult` produced by Module 6 against the raw upstream data embedded in that result.
- Performs four independent validation categories:
  - **Completeness** (`checkCompleteness`): price > 0, non-empty symbol, minimum evidence count, valid condition-met ranges.
  - **Consistency** (`checkConsistency`): each `TrendConditions` boolean matches its raw upstream source (RSI, MACD, EMA values, market structure swing counts, S/R zone type, volume context fields).
  - **Contradictions** (`checkContradictions`): `priceAboveAllEMAs`/`priceBelowAllEMAs` consistency, EMA order exclusivity, condition-met counts match the boolean tally, trend label matches the `deriveTrendLabel` priority order, evidence sorted high → medium → low.
  - **Structural** (`checkStructural`): price zone geometry (lower ≤ center ≤ upper, lower < upper), active zone type and broken-flag correctness, BOS/CHOCH detected-flag vs event array consistency, `last` pointer accuracy, chronological event order.
- Returns `ValidationResult`: `passed`, `clean`, `issues[]`, `criticalCount`, `warningCount`, `infoCount`, `summary`.
- Public API: `validateAnalysis(result, config?)` — deterministic, pure, no side effects.
- Configuration: `ValidationConfig` with `DEFAULT_VALIDATION_CONFIG` (thresholds for evidence counts, zone geometry tolerance, etc.).
- Rules documented in `VALIDATION_RULES.md` and `ENGINE_RULES.md §15`.
- 84 tests passing across 5 test files. ADR: ADR-020.

### `src/modules/confidence/` — Confidence Engine
- **Evidence-weighted scoring layer**: Reads `MarketAnalysisResult.evidence` (assembled by Module 6) and sums point weights assigned to each canonical factor name (ENGINE_RULES.md §11).
- Raw points normalized to 0–10: `score = min(10, max(0, rawPoints / 10.6))`.
- Computes separate `bullishConfidence` and `bearishConfidence` sub-scores from positive and negative weight totals respectively.
- Applies validation penalties from Module 7's `ValidationResult`: each warning reduces the normalized score by a configurable amount (`warningScorePenalty`); any critical issue caps the score at `criticalScoreCap`.
- Emits a `ConfidenceGrade` label (5 tiers: `weak` / `mixed` / `moderate` / `strong` / `very_strong`) matching ENGINE_RULES.md §11 score interpretation table.
- All factor weights, normalization divisor, penalty amounts, and grade thresholds live in `DEFAULT_CONFIDENCE_CONFIG` — no magic numbers in compute code.
- Pure, deterministic, no side effects, no AI, no network calls.
- Public API: `computeConfidence(analysis: MarketAnalysisResult, validation: ValidationResult, config?)`.
- Rules documented in `ENGINE_RULES.md §11`. 80 tests passing (2 test files).

### `src/modules/writer/` — Writer Engine
- **Template engine**, not an LLM. Pure TypeScript, no AI API calls, no network requests, no randomness, no timestamps.
- Accepts `WriterInput` containing `MarketAnalysisResult` (Module 6), `ValidationResult` (Module 7), and `ConfidenceResult` (Module 8). Never reads raw candles.
- Produces `GeneratedAnalysis`: 11 named section fields + `fullReport` + `WriterMetadata`.
- Supports 6 output templates: `full` (markdown headers), `executive` (flowing prose), `summary` (single paragraph), `bullet` (5–7 key facts), `headline` (single line), `social` (post-format).
- All 6 templates reuse the same section builders — only assembly differs.
- **Critical validation gate**: when `validation.criticalCount > 0`, all section content is replaced with minimal stubs; `fullReport` contains only the validation warning text.
- Confidence-grade-driven hedging language: 5 tiers map to opening phrases (e.g. `very_strong` → "The available evidence strongly supports"). No invented analysis.
- Banned phrases enforced: "will", "going to", "guaranteed", "certain", "definitely", "buy", "sell", "moon", "dump", "pump".
- Every report ends with "This is not financial advice."
- Public API: `generateAnalysis(input: WriterInput, config?: Partial<WriterConfig>): GeneratedAnalysis`.
- Configuration: `WriterConfig` with `DEFAULT_WRITER_CONFIG`; all limits (maxSummaryLength 600, maxReportLength 4000, maxReasonsDisplayed 3, maxRiskFactors 3) are configurable.
- 131 tests passing (1 test file). Pure, deterministic, independently testable.
- Source: `src/modules/writer/`. Files: `types.ts`, `config.ts`, `sections.ts`, `compose.ts`, `index.ts`.

### `src/modules/pipeline/` — Pipeline Orchestrator
- **Single public entry point** for the entire Sentinel analysis stack.
- Orchestrates Modules 1–9 in strict sequential order with no out-of-order execution.
- Accepts `PipelineOptions`: `symbol`, `interval`, `candleLimit`, per-module config overrides, and an optional `fetchImpl` for dependency injection (testing without network).
- Returns `PipelineResult`: typed outputs from all 9 modules + `PipelineMetadata` (symbol, interval, candle count, version, timestamp, per-stage timings, total execution time).
- Validates inputs upfront: throws `PipelineError('configuration_error', ...)` for a missing symbol before any I/O occurs.
- Enforces a configurable `minCandleCount` (default 50): throws `PipelineError('insufficient_candles', ...)` when the fetch returns too few candles.
- Wraps every module call in a typed error boundary: unexpected module throws become `PipelineError('internal_module_failure', ...)` with the originating module name and original cause.
- Measures wall-clock time for each stage (`fetch`, `indicators`, `marketStructure`, `supportResistance`, `volume`, `analysis`, `validation`, `confidence`, `writer`, `total`) and exposes them in `metadata.timings`.
- Exposes `PIPELINE_VERSION` constant and `DEFAULT_PIPELINE_CONFIG` for external configuration.
- Pure orchestration — no new calculations, no domain logic. All analysis comes from Modules 1–9.
- Public API: `analyzeMarket(options: PipelineOptions): Promise<PipelineResult>`
- Source: `src/modules/pipeline/`. Files: `types.ts`, `config.ts`, `index.ts`.
- 33 tests passing (1 test file). Version `0.11.0`.

### `src/modules/benchmark/` — Benchmark Engine
- **Deterministic validation framework** for the analysis engine — not a trading strategy backtester.
- Answers the question: "Did the same market data produce the same analysis as before?"
- Accepts a `BenchmarkDataset` (symbol, interval, candles) and an `ExpectedOutput` (dot-notation paths → expected values).
- Replays the dataset through the full Module 10 pipeline via dependency-injected `fetchImpl` — no network calls.
- Compares actual `PipelineResult` against expected values using a dot-notation path resolver that supports nested objects, array `.length`, and the `'$absent'` sentinel (assert a field must NOT exist).
- Produces `FieldComparison[]` with `PASS / FAIL / MISSING / EXTRA` status per field.
- Computes `BenchmarkMetrics`: accuracy (0–100%), per-status counts, and per-stage timings.
- Generates markdown benchmark reports via `generateReport(result)`: pass/fail, score, timing breakdown, all mismatched fields with expected vs actual.
- `passed = (failedFields === 0 && missingFields === 0)`.
- No file I/O — dataset loading is fully dependency-injected; callers provide the dataset object.
- Public API: `runBenchmark(options): Promise<BenchmarkResult>`, `generateReport(result): string`.
- Configuration: `ComparisonConfig` (`numericTolerance: 0.001`, `ignoredPaths`: timestamps, timings, generated IDs).
- Source: `src/modules/benchmark/`. Files: `types.ts`, `config.ts`, `compare.ts`, `metrics.ts`, `replay.ts`, `report.ts`, `index.ts`.
- 62 tests passing (1 test file). Dataset fixtures in `test-fixtures/`. Documentation in `docs/BENCHMARKING.md`.

### `src/ui/` — React Dashboard
- **Presentation layer only** — zero analysis logic, zero pipeline calls, zero data transformations.
- Renders `PipelineResult` returned by the API across 8 tab views: Overview, Evidence, Indicators, Structure, Volume, Validation, Writer, Benchmark.
- Key components: `TradingViewChart` (embeds TradingView widget), `PriceHeader`, `LeftSidebar`, `RightPanel`, tab content components.
- Shared component library: `Card`, `Badge`, `Skeleton`, `Tabs`, `ConfidenceMeter`, `ProgressBar`, `NumberTicker`, `CopyButton`.
- Utility modules: `src/ui/utils/format.ts` (number/price/time formatting), `src/ui/utils/colors.ts` (grade and direction color helpers), `src/ui/utils/timeframes.ts` (timeframe constants).
- Source: `src/ui/`. React 18, TypeScript, Vite, TailwindCSS v3.4.

### `src/ui/api.ts` — UI API Client
- **Client API layer** — `src/ui/api.ts` centralizes all HTTP communication with the backend.
- `SentinelApiError` class: `kind: 'network' | 'timeout' | 'http' | 'parse' | 'abort'`, plus `friendly`, `detail`, `status`, `code` fields.
- `analyze(symbol, interval, options?, signal?)` — `POST /analyze`, AbortController support.
- `checkHealth(signal?)` — `GET /health`, returns boolean.
- `VITE_API_URL` env var with `http://localhost:3000` fallback.
- `useApiStatus()` hook polls every 30 seconds; `ApiStatusIndicator` component shows green/red/pulse dot.
- `useAnalyze()` hook manages loading state, AbortController lifecycle, friendly error messages.
- 21 unit tests (mocked `fetch`).

### `src/ui/components/layout/` — Layout & UX Foundation
- **Layout and interaction layer** — global header, collapsible sidebar, resizable panels, keyboard accessibility.
- `Header` component: sidebar toggle, symbol input, 10 timeframe quick-buttons + 5-item overflow `<select>`, analyze button.
- `LeftSidebar` collapses via CSS width transition (`transition-[width] duration-200`, `w-0` → `w-52`). Watchlist and recent-analysis items are keyboard navigable.
- `ResizeDivider` + `useResizablePanel`: chart panel height resizable via drag. Direct DOM mutation during drag (no React re-renders at 60 fps); single state commit on mouseup. Persisted to localStorage.
- All interactive state persisted: symbol, interval, active tab, sidebar collapsed, chart height.
- All tab components lazy-loaded via `React.lazy()` + `Suspense`.
- `prefers-reduced-motion` respected — all animations suppressed when set.
- `:focus-visible` keyboard focus rings (2px blue-500).
- Semantic color utilities: `.text-success`, `.text-warning`, `.text-error`, `.text-info`.

### `src/ui/components/` — UI Polish & Information Density
- **Information-density pass** — reduces visual noise, improves hierarchy, eliminates wasted space. Zero analysis logic changes.
- `MarketSummaryBar` (56px): single always-visible bar replacing the old conditional PriceHeader. Shows symbol, interval, price, 24h change, trend badge, confidence, last analysis time, execution time, and `ApiDot` status. `ApiDot` consumes `useApiStatus()` — API status migrated here from Header.
- `useResizablePanel` constants updated: `CHART_HEIGHT_DEFAULT` 560px (was 320), `CHART_HEIGHT_MIN` 300px (was 150), `CHART_HEIGHT_MAX` 900px (was 600). Chart dominates at default.
- `LeftSidebar` grade scores: `recentBySymbol` Map (built once per `recentAnalyses` via `useMemo`) enables O(1) lookups. Each watchlist symbol shows its most-recent confidence score using `scoreColor`; removed by hover → remove-button reveal.
- `OverviewTab` primary grid: `repeat(auto-fill, minmax(180px, 1fr))` — fills available width at any card count. All cards gain 150ms shadow elevation on hover (`shadow-card-hover`). `Row` helper component for consistent key-value pair layout.
- `App.tsx` `EmptyState`: `ChartIllustration` inline SVG (no external assets). `ErrorState` fixed-height detail slot prevents layout jump on collapsible details toggle.
- All transitions 120–180ms (Tailwind `duration-150`); `prefers-reduced-motion` suppresses all via `index.css`.
- 17 pure-logic tests for `clampSize`, chart height bounds, and timeframe completeness.

### `src/api/` — REST API Layer
- **Transport layer only** — zero analysis logic, zero indicator calculations, zero pipeline duplication.
- Wraps `analyzeMarket()` (Module 10) in a production-ready Express REST API.
- Three endpoints:
  - `GET /health` → `{ status: "ok", version: "0.11.0" }`
  - `GET /version` → `{ version: "0.11.0" }`
  - `POST /analyze` → accepts `{ symbol, interval, candleLimit?, config? }`, calls `analyzeMarket()`, returns the complete `PipelineResult` unchanged.
- Input validation middleware: `symbol` non-empty string, `interval` in `VALID_TIMEFRAMES`, `candleLimit` positive integer ≤ 1000, `config` object if provided.
- Centralized error handler maps `PipelineError` codes to HTTP status codes: `configuration_error` → 400, `fetch_failure` → 404, `insufficient_candles` → 422, `validation_failure` → 422, `internal_module_failure` → 500. Malformed JSON → 400. Unknown errors → 500.
- Timing middleware adds `X-Response-Time` header to every response.
- Consistent error response shape: `{ error: { code, message, module? } }`.
- Dependency injection preserved: `createApp(analyzeFn?)` accepts an optional `AnalyzeFn` for testing without network calls.
- Public API: `createApp(analyzeFn?: AnalyzeFn): express.Application`.
- Source: `src/api/`. Files: `types.ts`, `config.ts`, `routes.ts`, `server.ts`, `middleware/validation.ts`, `middleware/error-handler.ts`.
- 41 tests passing (1 test file).

### `src/cli/` — CLI Tool
- **Transport layer only** — zero analysis logic, zero indicator calculations, zero pipeline duplication.
- Wraps `analyzeMarket()` (Module 10) in a production-ready command-line interface.
- Entry point: `createCli(analyzeFn?, io?)` factory — fully dependency-injected for testing.
- Commands: `sentinel analyze <SYMBOL> <INTERVAL>`
- Options: `--candles <n>`, `--json`, `--pretty`, `--output <file>`, `--template <name>`, `--no-color`, `--version / -v`, `--help / -h`
- Exit codes: 0 = success, 1 = operational failure (pipeline error), 2 = invalid arguments.
- `PipelineError` codes mapped to friendly messages: `fetch_failure`, `insufficient_candles`, `configuration_error`, `internal_module_failure`, `validation_failure`.
- Output modes: default (writer engine fullReport), `--json` (complete `PipelineResult`), `--pretty` (ANSI-colorized report), `--output` (write to file instead of stdout).
- Argument parsing in `src/cli/args.ts` validates symbol, interval, candle count, and template independently.
- Source: `src/cli/`. Files: `types.ts`, `config.ts`, `args.ts`, `format.ts`, `index.ts`.
- 66 tests passing (2 test files: `args.test.ts`, `cli.test.ts`).

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
