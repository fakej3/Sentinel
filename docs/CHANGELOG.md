# Sentinel — Changelog

All notable changes to this project are documented here.
Format: Date · Version · Summary · Modules Affected · Known Side Effects.

---

## [Unreleased]

Work in progress. No released version yet.

---

## [0.17.0] — 2026-07-02

### Module 17 — Premium UX Polish

Information-density pass on the dashboard. No analysis logic, API, or pipeline changes.

#### Added

- **`src/ui/components/layout/MarketSummaryBar.tsx`**: Compact fixed-height (56px) bar that unifies three prior conditional states (idle / loading / data) into a single always-visible component. Displays: symbol, interval badge, current price, 24h change (color-coded), trend badge, confidence score, last analysis timestamp, execution time, and API status dot (`ApiDot` subcomponent via `useApiStatus`). Responsive: progressive detail visible at sm/md/lg/xl breakpoints.

#### Modified

- **`src/ui/hooks/useResizablePanel.ts`**: Updated panel size constants — `CHART_HEIGHT_DEFAULT` 320→560, `CHART_HEIGHT_MIN` 150→300, `CHART_HEIGHT_MAX` 600→900. Chart now dominates the workspace at default zoom.

- **`src/ui/components/layout/Header.tsx`**: Removed `ApiStatusIndicator` (moved to `MarketSummaryBar`). Height h-12→h-11. All controls unified at h-8. Added visual separator between symbol input and timeframe buttons. Logo icon reduced (w-6→w-5). Analyze button uses explicit inline classes for consistent h-8 sizing.

- **`src/ui/components/layout/LeftSidebar.tsx`**: Width w-56→w-52. Added `recentBySymbol` lookup Map (built via `useMemo`) for O(1) grade score display in watchlist items. Recent analysis grade shown as colored score chip next to each watchlist symbol; replaced by remove button on hover.

- **`src/ui/components/tabs/OverviewTab.tsx`**: Primary card grid changed to `repeat(auto-fill, minmax(180px, 1fr))` for true responsiveness at any card count. All summary cards gain `hover` prop and 150ms shadow elevation transition. Icon containers shrunk (w-8→w-7, size 15→13). ProgressBar heights h-1→h-0.5. Added `Row` helper component for consistent key-value rows. `tabular-nums` class on all mono numeric values.

- **`src/App.tsx`**: `MarketSummaryBar` replaces the old conditional `PriceHeader`/`SkeletonPriceHeader` block. `ChartIllustration` SVG component provides custom empty-state graphic. `EmptyState` and `ErrorState` rebuilt: cleaner inline button styles, fixed-height detail slot in `ErrorState` prevents layout jump on expand/collapse. Removed unused `TrendingUp` import.

- **`src/ui/__tests__/ux.test.ts`**: Three new tests verifying Module 17 constants — default height ≥500px (chart dominance spec), exact values (560/300/900), and clamp behavior across the full new range. Total: 20 tests (↑3 from 17).

#### Architecture

- API status dot migrated from `Header` → `MarketSummaryBar`, consolidating all live-data indicators in one bar and reducing header clutter.
- Empty-state layout jump eliminated via fixed-height wrapper slot (`minHeight` trick) around collapsible error detail block.
- `recentBySymbol` Map built once per `recentAnalyses` change via `useMemo` — O(1) watchlist lookups regardless of history length.

#### Stats

- **Tests:** 1085 (↑3 from 1082) across 62 files — all pass.
- **TypeScript errors:** 0.

---

## [0.16.0] — 2026-07-02

### Module 16 — UX Foundation & Professional Interface

UI/UX improvements transforming the dashboard into a polished, keyboard-accessible interface. Zero changes to analysis logic, API behavior, or PipelineResult.

#### Added

- **`src/ui/utils/timeframes.ts`**: `QUICK_TIMEFRAMES` (10 common timeframes), `EXTRA_TIMEFRAMES` (5 overflow timeframes), `ALL_TIMEFRAMES` (all 15). Single source of truth for timeframe constants across Header and tests.

- **`src/ui/hooks/useResizablePanel.ts`**: Hook for resizable panels. Exported `clampSize(value, min, max)` pure function. `CHART_HEIGHT_DEFAULT` (320), `CHART_HEIGHT_MIN` (150), `CHART_HEIGHT_MAX` (600) constants. Drag mutates DOM directly (no React re-renders during drag), commits to localStorage on mouseup. Cleans up `mousemove`/`mouseup` listeners on completion.

- **`src/ui/components/layout/Header.tsx`**: Global header bar (48px). Contains: sidebar toggle (`PanelLeftOpen`/`PanelLeftClose`), logo, symbol input (monospace, uppercase), 10 timeframe quick-select buttons, overflow `<select>` for 5 additional timeframes, analyze button with spinner, `ApiStatusIndicator`. All controls are keyboard accessible with `focus-visible` rings.

- **`src/ui/components/layout/ResizeDivider.tsx`**: Draggable horizontal resize handle between chart panel and analysis panel. `role="separator"`, `aria-orientation="horizontal"`. Visual indicator (8px wide pill) appears on hover.

- **`src/ui/__tests__/ux.test.ts`**: 17 pure-logic tests covering `clampSize` (7 cases), chart height constants (3 cases), and timeframe coverage (7 cases: array lengths, no duplicates, no overlap, union completeness).

#### Modified

- **`src/ui/components/layout/LeftSidebar.tsx`**: Removed symbol input, timeframe grid, and analyze button (moved to Header). Added `collapsed: boolean` prop — width transitions between `w-56` and `w-0` via `transition-[width] duration-200`. Added `aria-hidden` when collapsed. Added `role="button"` + keyboard handlers (`Enter`/`Space`) to watchlist and recent-analysis items. `onSelectSymbol` now accepts an optional `interval` argument to restore both fields from recent analyses.

- **`src/App.tsx`**: Full restructure. Added global `<Header>` at top. Sidebar uses `collapsed` prop (no longer receives symbol/interval/analyze). Symbol, interval, activeTab, sidebar state, and recent analyses all persisted via `useLocalStorage`. Chart height managed by `useResizablePanel`. `<ResizeDivider>` between chart and analysis panels. All 8 tab components lazy-loaded via `React.lazy()` + `Suspense`. Removed fixed `ApiStatusIndicator` overlay (now in Header). `EmptyState` copy updated to reference the header. `ErrorState` `toggle` button is `aria-expanded`. `setActiveTab` cast preserves `AppTab` type.

- **`src/index.css`**: Added semantic color utilities (`.text-success`, `.text-warning`, `.text-error`, `.text-info`, `.bg-success`, `.bg-warning`, `.bg-error`, `.bg-info`). Added `@media (prefers-reduced-motion: reduce)` block suppressing all animations and transitions. Added global `:focus-visible` rule (2px blue-500 outline). Added `:focus:not(:focus-visible)` to suppress default browser outlines.

#### Architecture

- Sidebar collapse is pure CSS width transition — no JS animation, no conditional rendering.
- Resize drag: direct DOM style mutation at 60 fps, single `setSize` commit on mouseup. No React re-renders during drag.
- `QUICK_TIMEFRAMES` + `EXTRA_TIMEFRAMES` extracted to `src/ui/utils/timeframes.ts` so tests can verify coverage without importing TSX files.

#### Stats

- **Tests:** 1082 (↑17 from 1065) across 62 files — all pass.
- **TypeScript errors:** 0.

---

## [0.15.0] — 2026-07-02

### Module 15 — UI Integration & Local Development

Connected the existing frontend to the real API. No UI redesign. No analysis logic changes.

#### Added

- **`src/ui/api.ts`**: Centralized API client. `SentinelApiError` class with `kind: 'network' | 'timeout' | 'http' | 'parse' | 'abort'`. `analyze()` and `checkHealth()` functions. `VITE_API_URL` environment variable with `http://localhost:3000` fallback. AbortController support on both functions.
- **`src/ui/hooks/useApiStatus.ts`**: `useApiStatus()` hook — polls `checkHealth()` every 30 seconds.
- **`src/ui/components/shared/ApiStatusIndicator.tsx`**: Green/red/pulsing dot indicator.
- **`src/server.ts`**: Express entry point with CORS middleware wrapping `createApp()`. Listens on `PORT` (default 3000).
- **`src/ui/__tests__/api.test.ts`**: 21 tests covering success, HTTP errors, network failure, cancellation, malformed response, and `checkHealth()`.
- **`.env.example`**: Documents `VITE_API_URL`.
- **`docs/LOCAL_DEVELOPMENT.md`**: Two-process setup, environment variables, API endpoints, project structure.

#### Modified

- **`src/ui/hooks/useAnalyze.ts`**: Uses real `analyze()` from `src/ui/api.ts`. `SentinelApiError` friendly/detail fields surfaced. AbortController stored in ref, cancelled on re-run.
- **`src/App.tsx`**: `errorDetail` destructured from `useAnalyze()`, passed to `ErrorState`. `ApiStatusIndicator` added as fixed overlay.
- **`package.json`**: Added `start:api` script (`tsx src/server.ts`).
- **`README.md`**: Quick start, scripts table, architecture overview.

#### Stats

- **Tests:** 1065 (↑21 from 1044) across 61 files — all pass.
- **TypeScript errors:** 0.

---

## [0.12.0] — 2026-07-01

### Module 13 — CLI

Production-ready command-line interface wrapping Module 10. Zero analysis logic — a pure transport layer around `analyzeMarket()`.

#### Added

- **`src/cli/types.ts`**: `CliAnalyzeFn` (dependency-injected pipeline function), `IoImpl` (stdout/stderr/writeFile abstraction for test isolation), `CliFlags` (all parsed option values), `ParseResult` (discriminated union: help | version | analyze | error).

- **`src/cli/config.ts`**: Re-exports `PIPELINE_VERSION`, `VALID_TIMEFRAMES`, and `MAX_CANDLE_LIMIT` from their canonical sources. Defines `VALID_TEMPLATES` as a `Set<string>` of all 6 writer template names.

- **`src/cli/args.ts`**: `parseArgs(argv)` — full argument parser. `HELP_TEXT` — formatted usage string. `VERSION_TEXT` — `sentinel v<version>`. Validates SYMBOL, INTERVAL, `--candles` (1–1000 integer boundary), `--template` (6 valid values). Returns discriminated `ParseResult`.

- **`src/cli/format.ts`**: `formatOutput(result, flags)` — selects between JSON, ANSI-colorized, or plain text output for stdout. `formatFileContent(result, json)` — plain/JSON content for file writes (never colorized). `colorize(text)` — applies ANSI codes to markdown-style headings and separators.

- **`src/cli/index.ts`**: `createCli(analyzeFn?, io?)` — DI factory returning an `(argv) => Promise<number>` function. `pipelineErrorMessage(err)` — exhaustive switch over all 5 `PipelineErrorCode` values. `defaultIo` — production implementation using `process.stdout`, `process.stderr`, and `fs/promises.writeFile`.

- **`src/cli/__tests__/args.test.ts`**: 36 tests covering `--version`, `-v`, `--help`, `-h`, no command, unknown command, missing SYMBOL, missing INTERVAL, invalid INTERVAL, symbol uppercasing, valid analyze, `--candles` (valid, boundary 1, boundary 1000, below 1, above 1000, non-integer, missing value), `--template` (all 6 valid names, invalid name, missing value), boolean flags (`--json`, `--pretty`, `--no-color`), default flag values, `--output` (valid, missing value), combined flags, `HELP_TEXT` content, `VERSION_TEXT` format.

- **`src/cli/__tests__/cli.test.ts`**: 30 tests covering `--help`, `-h`, `--version`, `-v`, exit code 2 for unknown command / missing SYMBOL / invalid INTERVAL / invalid `--candles` / invalid `--template`, help text in stderr, `analyzeFn` call with correct symbol/interval/candleLimit/template config, symbol uppercasing, exit code 0 on success, fullReport to stdout, JSON mode (valid JSON, `generatedAnalysis` property), pretty mode (ANSI present), `--no-color` suppression, `--output` (file written, stdout empty, JSON+file, exit 0), `PipelineError` handling (exit 1, all 5 error messages), generic error handling, determinism.

#### Architecture

- **Pure transport**: `src/cli/` imports nothing from analysis modules except `PipelineError`, `PipelineOptions`, `PipelineResult`, `Timeframe`, `PIPELINE_VERSION`, `VALID_TIMEFRAMES`, and `MAX_CANDLE_LIMIT`. No indicators, no market logic.
- **DI preserved**: `createCli(analyzeFn?, io?)` factory enables full test isolation without process I/O.
- **No `process.exit()` inside the module**: The factory returns a numeric exit code. The real entry point calls `process.exit(code)` externally.
- **File output is never colorized**: ANSI codes are only applied to stdout (`--pretty`), never to file content.

#### Stats

- **Tests:** 1039 (↑66 from 973) across 60 files — all pass.
- **TypeScript errors:** 0.

---

## [0.11.2] — 2026-07-01

### Module 12 — API Layer

Production-ready Express REST API wrapping Module 10. Zero analysis logic — a pure transport layer around `analyzeMarket()`.

#### Added

- **`src/api/types.ts`**: `AnalyzeFn` (dependency-injected pipeline function), `AnalyzeRequest` (POST /analyze body shape), `ApiErrorBody` (consistent error response shape).

- **`src/api/config.ts`**: Re-exports `PIPELINE_VERSION`, `VALID_TIMEFRAMES`, and `MAX_CANDLE_LIMIT` from their canonical Module 10/1 sources. No values duplicated.

- **`src/api/middleware/validation.ts`**: `validateAnalyzeInput` — Express middleware validating `symbol` (non-empty string), `interval` (VALID_TIMEFRAMES), `candleLimit` (positive integer ≤ 1000, optional), `config` (object, optional). Returns `{ error: { code: "invalid_request", message } }` on failure.

- **`src/api/middleware/error-handler.ts`**: `errorHandler` — centralized Express error handler. Maps `PipelineError` codes to HTTP statuses (`configuration_error` → 400, `fetch_failure` → 404, `insufficient_candles` → 422, `validation_failure` → 422, `internal_module_failure` → 500). Detects body-parser `SyntaxError` → 400 `invalid_json`. Unknown errors → 500 `internal_error`. All responses use `{ error: { code, message, module? } }`.

- **`src/api/routes.ts`**: `createRouter(analyzeFn)` — Express Router with:
  - `GET /health` → `{ status: "ok", version: PIPELINE_VERSION }`
  - `GET /version` → `{ version: PIPELINE_VERSION }`
  - `POST /analyze` → validates input, calls `analyzeFn({ symbol: symbol.toUpperCase(), interval, candleLimit, config })`, returns `PipelineResult` unchanged.

- **`src/api/server.ts`**: `createApp(analyzeFn?)` — Express application factory. Registers `express.json()`, timing middleware (`X-Response-Time` header via `res.json` override), router, and error handler. Defaults to real `analyzeMarket` when `analyzeFn` is omitted.

- **`src/api/__tests__/api.test.ts`**: 41 tests covering:
  - `GET /health` (status, body shape, version, X-Response-Time)
  - `GET /version` (status, body shape, version)
  - `POST /analyze` success (200, result passthrough, symbol uppercasing, candleLimit/config forwarding, X-Response-Time, Content-Type, determinism, all 15 valid intervals)
  - Validation: missing symbol, empty symbol, non-string symbol, missing interval, invalid interval, zero/negative/non-integer/over-limit candleLimit, array/string config; error shape
  - PipelineError mapping: all 5 codes to correct HTTP status; module field presence
  - Unexpected errors: generic Error, non-Error thrown value
  - Malformed JSON: 400 + `invalid_json` code
  - Unknown routes: 404

#### Architecture

- **Pure transport**: `src/api/` imports nothing from analysis modules except `PipelineError`, `PipelineOptions`, `PipelineResult`, `PIPELINE_VERSION`, and `VALID_TIMEFRAMES`. No indicators, no market logic.
- **DI preserved**: `createApp(analyzeFn?)` factory enables full test isolation without module mocking.
- **Symbol normalization**: the route handler uppercases the symbol before forwarding, consistent with Module 1 behavior.
- **Timing middleware** overrides `res.json` to set `X-Response-Time` before the response body is flushed — works for both success and error paths.

#### Stats

- **Tests:** 973 (↑41 from 932) across 58 files — all pass.
- **TypeScript errors:** 0.

---

## [0.11.1] — 2026-07-01

### Module 11 — Historical Replay & Benchmark Engine

Deterministic regression framework for the Sentinel analysis engine. Replays historical OHLCV datasets through the full Module 10 pipeline and compares outputs against pinned expected values.

#### Added

- **`src/modules/benchmark/types.ts`**: `BenchmarkDataset`, `ExpectedOutput`, `ABSENT` sentinel (`'$absent'`), `DiffStatus` (`PASS | FAIL | MISSING | EXTRA`), `DiffSeverity`, `FieldComparison`, `BenchmarkMetrics`, `BenchmarkTimings`, `BenchmarkResult`, `ComparisonConfig`, `BenchmarkOptions`.

- **`src/modules/benchmark/config.ts`**: `DEFAULT_COMPARISON_CONFIG` — `numericTolerance: 0.001`, `ignoredPaths` (timestamps, all timing sub-fields, generated IDs, `analysis.analysedAt`).

- **`src/modules/benchmark/compare.ts`**: `compareOutputs(actual, expected, config)` — dot-notation path resolver supports arbitrary nesting and array `.length`; `valuesEqual()` handles numeric tolerance, recursive array comparison, and primitive equality; `ABSENT` sentinel maps to `EXTRA` (field present) or `PASS` (field absent).

- **`src/modules/benchmark/metrics.ts`**: `computeMetrics(comparisons, timings)` — per-status field counts, `accuracy = (passedFields / totalFields) × 100`, `100.0` when no assertions given.

- **`src/modules/benchmark/replay.ts`**: `replayDataset(dataset, pipelineConfig?)` — builds `Ticker24h` from candles via `reduce`, calls `analyzeMarket` with `fetchImpl` returning dataset data. No file I/O, no network calls.

- **`src/modules/benchmark/report.ts`**: `generateReport(result)` — markdown report with overall pass/fail, score, per-stage timing breakdown, and a differences section listing every `FAIL` and `MISSING` field with expected vs actual values.

- **`src/modules/benchmark/index.ts`**: `runBenchmark(options): Promise<BenchmarkResult>` — public entry point. Orchestrates replay → compare → metrics → summary. Re-exports all types, config, and sub-functions.

- **`src/modules/benchmark/__tests__/helpers.ts`**: `makeCandles(count, basePrice)`, `makeDataset(count, opts)`, `makeMockResult(shape)`, `standardMockResult()`, `expectedFromResult(result)`.

- **`src/modules/benchmark/__tests__/benchmark.test.ts`**: 62 tests covering — comparison engine (PASS/FAIL/MISSING/EXTRA/ABSENT sentinel, dot-notation resolution, array `.length`, numeric tolerance, array comparison, ignored paths), metrics (accuracy, empty set, all-fail, all-pass, mixed), replay (DI fetchImpl, dataset passthrough, result shape), report (section presence, timing display, diff section), `runBenchmark` integration (full success, empty expected, schema completeness), and determinism.

- **`test-fixtures/README.md`**: format documentation, how to add datasets, best practices.
- **`test-fixtures/sample/dataset.json`**: 5-candle format illustration (not a real benchmark dataset).
- **`test-fixtures/sample/expected.json`**: expected output format illustration with `_comment` field.
- **`docs/BENCHMARKING.md`**: public documentation covering public API, dataset format, expected output format, comparison results, numeric tolerance, adding new datasets, regression detection, report generation, architecture diagram, and source file index.

#### Architecture

- **Not a backtester**: Module 11 validates whether the analysis engine produces stable, deterministic output for a fixed dataset — it does not evaluate trading strategy profitability.
- **No file I/O**: Dataset objects are passed directly by callers. The module never reads from disk or network.
- **Fully deterministic**: The same dataset + expected always produces the same comparisons (timing fields auto-excluded).
- **`$absent` sentinel**: JSON-serializable string sentinel (not a Symbol) allows fixture files to assert that a field must NOT exist in the output.
- **Re-export-only pattern**: `generateReport` is re-exported from `index.ts` without a local import, avoiding `noUnusedLocals` errors for functions not called by `runBenchmark` itself.

#### Stats

- **Tests:** 932 (↑62 from 870) across 57 files — all pass.
- **TypeScript errors:** 0.

---

## [0.11.0] — 2026-07-01

### Module 10 — Analysis Pipeline Orchestrator

Single public entry point for the full Sentinel analysis stack. Orchestrates Modules 1–9 in strict sequential order and returns one complete `PipelineResult` object.

#### Added

- **`src/modules/pipeline/types.ts`**: `PipelineErrorCode`, `PipelineTimings`, `PipelineMetadata`, `PipelineResult`, `PipelineConfig`, `FetchFn`, `PipelineOptions`.

- **`src/modules/pipeline/config.ts`**: `PIPELINE_VERSION` (`'0.11.0'`) and `DEFAULT_PIPELINE_CONFIG` (minCandleCount=50, all module configs default to `{}`).

- **`src/modules/pipeline/index.ts`**: `analyzeMarket(options): Promise<PipelineResult>` — the single public entry point. Executes all 9 stages sequentially, measures wall-clock timing for each stage, validates inputs upfront, and wraps every module call in a typed `PipelineError` boundary. `PipelineError` (extends `Error`) exposes `code`, `module`, `reason`, and `cause`.

- **`src/modules/pipeline/__tests__/helpers.ts`**: `makeCandles(count, basePrice)` — deterministic synthetic candle generator using `Math.sin`/`Math.cos` for realistic price movement. `mockFetch(candles, fetchedAt)` — returns a `FetchFn` that resolves with well-formed `MarketData` without network I/O. `failingFetch(message)` — returns a `FetchFn` that always rejects.

- **`src/modules/pipeline/__tests__/pipeline.test.ts`**: 33 tests covering — end-to-end success (200-candle and 100-candle paths), fetch failure (`PipelineError` code, module, cause), insufficient candles, empty symbol, `configuration_error`, custom `minCandleCount`, writer config override, `fetchImpl` called with correct args (symbol, interval, candleLimit), no real network calls, deterministic output (all non-timing fields), metadata completeness (symbol uppercase, interval, candleCount, version, timestamp, executionTime), timing structure (all 10 keys present, all ≥ 0, total ≥ stage sum), `PipelineError` is `instanceof Error`, execution order verified via data-flow assertions (EMA20 non-null after fetch, writer receives confidence score from stage 8).

#### Architecture

- **Pure orchestration**: Module 10 adds no domain logic. All calculations remain in Modules 1–9.
- **Dependency injection**: `fetchImpl` replaces `fetchMarketData`; all tests use this interface rather than hitting real APIs.
- **Error model**: five typed `PipelineErrorCode` values; validation failures are non-throwing (included in `PipelineResult.validation`).
- **Configuration**: every downstream module config can be overridden per-call via `PipelineOptions.config`; defaults are shallow-merged.

#### Stats

- **Tests:** 870 (↑33 from 837) across 56 files — all pass.
- **TypeScript errors:** 0.

---

## [0.10.5] — 2026-07-01

### Sprint 3 — Audit Remediation (TypeScript + Production Readiness)

Addressed all findings from PROJECT AUDIT v0.3. No new functionality added.

#### Fixed (Production)

- **`src/modules/analysis/compute/evidence.ts`**: CRIT-001 — `breakout.detected` (nonexistent on `BreakoutResult`) replaced with `breakout.confirmed` for the "Breakout confirmed" evidence item and `breakout.failed` for the "Failed breakout" evidence item. Both items were silently suppressed before this fix regardless of market conditions.

- **`src/modules/analysis/compute/evidence.ts`**: CRIT-002 — `pullback.active` (nonexistent on `PullbackResult`) replaced with `pullback.detected`. The "Active pullback" evidence item was silently suppressed before this fix.

- **`src/modules/analysis/compute/sr-context.ts`**: Removed unused `PriceZone` import flagged by `noUnusedLocals`.

#### Fixed (Test Files — TypeScript Errors)

- **`src/modules/confidence/__tests__/confidence.test.ts`**: Added missing `import type { EvidenceDirection }` from analysis types. The type was used in a parameterised test array but not imported.

- **`src/modules/validation/__tests__/completeness.test.ts`**: Added `direction` field to all raw `EvidenceItem` literals (9 occurrences). Missing field was introduced when `direction` was added to `EvidenceItem` in v0.10.4 without updating these tests.

- **`src/modules/validation/__tests__/index.test.ts`**: Added `direction` field to all raw `EvidenceItem` literals (9 occurrences). Removed unused `DEFAULT_VALIDATION_CONFIG` import.

- **`src/modules/validation/__tests__/consistency.test.ts`**: Removed unused `makeVolumeAnalysis` import.

- **`src/modules/volume-analysis/__tests__/buy-sell-pressure.test.ts`**: Removed unused `flatCandles` import.

#### Added

- **`src/modules/analysis/__tests__/evidence.test.ts`**: 3 regression tests — "emits Breakout confirmed when breakout.confirmed is true", "emits Failed breakout when breakout.failed is true", "emits Active pullback when pullback.detected is true". Each test would fail on the pre-fix code and passes on the fixed code.

- **`package.json`**: `"typecheck": "tsc -b tsconfig.app.json --noEmit"` script. Updated `"test"` to run `vitest run && tsc -b tsconfig.app.json --noEmit`, ensuring TypeScript type errors always fail CI. CRIT-003 resolved.

#### Stats

- **Tests:** 837 (↑3 from 834) across 55 files — all pass.
- **TypeScript errors:** 0 (↓ from 27).

---

## [0.10.4] — 2026-07-01

### Module 9 — AI Writing Engine

New module implementing the template-based report generation layer per ENGINE_RULES.md §16.
All 834 tests pass (131 new tests added). No changes to existing modules.

#### Added

- **`src/modules/writer/types.ts`**: `WriterTemplate` (6 values: full, executive, summary, bullet, headline, social), `WriterVerbosity`, `WriterInput` (wraps MarketAnalysisResult + ValidationResult + ConfidenceResult), `WriterMetadata`, `GeneratedAnalysis` (11 named section fields + fullReport + metadata), `WriterConfig`.

- **`src/modules/writer/config.ts`**: `DEFAULT_WRITER_CONFIG` — template: 'full', verbosity: 'standard', maxSummaryLength: 600, maxReportLength: 4000, includeValidationSection/includeConfidenceSection/includeWarnings: true, maxReasonsDisplayed: 3, maxRiskFactors: 3.

- **`src/modules/writer/sections.ts`**: 12 builder functions — `buildHeadline` (`SYMBOL TF: trend — Confidence N.N/10 @ price`), `buildSummary` (confidence-grade-driven opener + truncated to maxSummaryLength), `buildTrendSection` (trend label + EMA alignment + per-EMA labels + confluence zones + ATR), `buildIndicatorSection` (RSI + MACD + ADX + Bollinger + StochRSI), `buildMarketStructureSection` (trend + BOS/CHoCH + consolidation + breakout + pullback), `buildSupportResistanceSection` (nearest distances + approaching flags + strongest zones + active zone counts), `buildVolumeSection` (relative volume + VWAP + OBV + acc/dist + climax + overall strength), `buildRiskSection` (bearish evidence factors + validation penalties + overbought/oversold + climax signals + approaching S/R), `buildConfidenceSection` (score + grade + sub-scores + top reasons + penalties + warnings), `buildValidationSection` (empty string when clean; critical/warning messages otherwise), `buildConclusion` (hedging phrase + evidence count + "not financial advice"), `buildCriticalStubs` (minimal stubs for all sections when validation is critical).

- **`src/modules/writer/compose.ts`**: 6 template assemblers (`composeFull`, `composeExecutive`, `composeSummaryTemplate`, `composeBullet`, `composeHeadlineTemplate`, `composeSocial`) + `composeReport` dispatcher + `buildAllSections` helper.

- **`src/modules/writer/index.ts`**: `generateAnalysis(input: WriterInput, config?: Partial<WriterConfig>): GeneratedAnalysis` — public API. Merges config, applies critical validation gate (stubs all sections when criticals > 0), truncates fullReport to maxReportLength. All types re-exported.

- **`src/modules/writer/__tests__/helpers.ts`**: `makeConfidence()`, `makeAnalysis()`, `makeBullishInput()`, `makeBearishInput()`, `makeNeutralInput()`, `makeWarningInput()`, `makeCriticalInput()`.

- **`src/modules/writer/__tests__/writer.test.ts`**: 131 tests across 18 describe groups covering: DEFAULT_WRITER_CONFIG integrity, all 11 section builders, generateAnalysis metadata fields, section field presence, critical validation gate, all 6 templates, determinism, banned phrases (per template), config overrides, neutral and bearish inputs.

#### Changed

- **`docs/ENGINE_RULES.md`**: §16 (Writing Engine Rules) added — input contract, evidence-first writing rule, confidence-driven hedging language table, critical validation gate, banned phrases list, template specifications, default configuration table.
- **`docs/ARCHITECTURE.md`**: Module 9 entry fully expanded with implementation details.
- **`docs/ROADMAP.md`**: Module 9 marked complete; overall progress updated to 69%; Module 9 detailed completion checklist added; current task updated to Module 10.
- **`docs/TESTING_STRATEGY.md`**: Test count updated to 834 tests across 55 test files.

---

## [0.10.3] — 2026-07-01

### Module 8 — Confidence Engine

New module implementing evidence-weighted confidence scoring per ENGINE_RULES.md §11.
All 703 tests pass (80 new tests added). No changes to existing modules.

#### Added

- **`src/modules/confidence/types.ts`**: `ConfidenceGrade` (5-tier enum: `weak` / `mixed` / `moderate` / `strong` / `very_strong`), `ConfidenceReason` (factor + points + direction), `ConfidencePenalty` (source + description + scoreReduction), `ConfidenceWarning`, `ConfidenceResult`, `ConfidenceConfig`.

- **`src/modules/confidence/config.ts`**: `DEFAULT_CONFIDENCE_CONFIG` with full `factorWeights` map (21 entries from ENGINE_RULES.md §11, using canonical §14.4 factor names), `normalizationDivisor: 10.6`, `warningScorePenalty: 0.5`, `criticalScoreCap: 3.0`, and grade boundary thresholds.

- **`src/modules/confidence/compute/score.ts`**: `scoreEvidence()` walks `EvidenceItem[]` and accumulates raw points, bullish sub-total, bearish sub-total, and `reasons[]` for every factor matched in `factorWeights`. `normalize()` clamps raw → 0–10 using the configured divisor.

- **`src/modules/confidence/compute/grade.ts`**: `scoreToGrade()` maps normalized score to `ConfidenceGrade` using configurable tier thresholds.

- **`src/modules/confidence/index.ts`**: `computeConfidence(analysis, validation, config?)` — public API. Scores evidence, normalizes, applies warning penalties and critical cap from `ValidationResult`, emits `ConfidenceResult`. Pure, deterministic, no side effects.

- **`src/modules/confidence/__tests__/helpers.ts`**: `ev()`, `makeAnalysis()`, `cleanValidation()`, `validationWithWarnings()`, `validationWithCriticals()`, `validationWithBoth()`.

- **`src/modules/confidence/__tests__/confidence.test.ts`**: 80 tests covering `scoreEvidence`, `normalize`, `scoreToGrade`, core scoring, directional confidence, all 21 ENGINE_RULES.md §11 factor weights, validation penalties, warning emission, config overrides, determinism, and `DEFAULT_CONFIDENCE_CONFIG` integrity.

#### Changed

- **`docs/ARCHITECTURE.md`**: Module 8 entry expanded with full implementation description.
- **`docs/ROADMAP.md`**: Module 8 marked complete; overall progress updated to 62%; Module 8 detailed completion checklist added.
- **`docs/TESTING_STRATEGY.md`**: Test count updated to 703 tests across 54 test files.

---

## [0.10.2] — 2026-07-01

### Stabilization Sprint 2 — Robustness, Configurability, and Documentation (HIGH-01 through MED-01)

Pre-Module-8 sprint focused on correctness hazards, configuration flexibility, and
documentation clarity. No behavioral changes with default config. All 613 previous
tests pass; 10 regression tests added.

#### Fixed

- **HIGH-01 — BOS/CHOCH `last` pointer checked with reference equality**
  (`src/modules/validation/validate/structural.ts`):
  `bos.last !== expectedLast` and `choch.last !== expectedLast` used JavaScript
  reference equality, which always fails after a JSON serialize/deserialize round-trip
  (Module 12 use case). Replaced with `eventsAreEqual()` helper that compares all five
  `StructureEvent` fields structurally: `type`, `index`, `timestamp`, `level`,
  `direction`. Null/undefined cases handled via early reference check.
  Regression tests added: original reference, shallow copy `{ ...event }`, and
  `JSON.parse(JSON.stringify(result))` — all must pass.

#### Changed

- **HIGH-02 — RSI classification boundary comments were ambiguous**
  (`src/modules/analysis/types.ts`):
  Comments used dash notation (`30–45`) which implied both endpoints were inclusive and
  made the boundary at 45 (which appears in two ranges) visually ambiguous. Replaced
  with precise inequality notation: `RSI < 30`, `30 ≤ RSI < 45`, `45 ≤ RSI ≤ 55`,
  `55 < RSI ≤ 70`, `RSI > 70`. Implementation unchanged.

- **HIGH-03 — Bollinger Band squeeze/expansion thresholds were hardcoded**
  (`src/modules/analysis/types.ts`, `src/modules/analysis/config.ts`,
  `src/modules/analysis/compute/indicators.ts`):
  `classifyBandwidth` used hardcoded `4` (squeeze) and `8` (expansion) percent values.
  Moved into `AnalysisConfig` as `bollingerTightThreshold: number` (default 4) and
  `bollingerWideThreshold: number` (default 8). Default behavior is unchanged.
  Regression tests added verifying squeeze, expansion, and normal classification using
  both default and custom thresholds.

- **MED-02 — `EvidenceItem` had no explicit direction field**
  (`src/modules/analysis/types.ts`, `src/modules/analysis/compute/evidence.ts`,
  `src/modules/validation/__tests__/helpers.ts`,
  `src/modules/validation/__tests__/contradictions.test.ts`,
  `src/modules/analysis/__tests__/evidence.test.ts`):
  Added `EvidenceDirection = 'bullish' | 'bearish' | 'neutral'` type and required
  `direction: EvidenceDirection` field to `EvidenceItem`. Updated `item()` factory
  with a 5th `direction` parameter; annotated all ~60 evidence item calls with correct
  directional values. Module 9 must read `direction` directly — never infer direction
  by parsing description text.

#### Documentation

- **MED-05 — `structure` vs `recentStructure` distinction underdocumented**
  (`src/modules/market-structure/types.ts`):
  Expanded JSDoc on both `MarketStructureResult` fields to explain exactly when each
  should be used. `structure` = full lifetime counts (audit/historical use only).
  `recentStructure` = rolling window matching `determineTrend()`'s slice (USE for
  trend condition evaluation). Incorrect use of `structure` for trend conditions
  silently produces wrong labels.

- **MED-01 — Intentional validator duplication undocumented**
  (`docs/DECISIONS.md` — ADR-021):
  Module 7 independently re-derives trend labels instead of importing Module 6 logic.
  Added ADR-021 explaining that this duplication is load-bearing: sharing the exact
  implementation would allow both modules to carry the same bug, causing the validator
  to silently agree with incorrect output.

---

## [0.10.1] — 2026-06-30

### Stabilization Sprint — Critical Bug Fixes (CRIT-01 through CRIT-04)

Pre-Module-8 stabilization sprint. Four bugs in the analysis engine and support/resistance
module that caused incorrect condition evaluation and misleading evidence. All existing
tests continue to pass; regression tests added for each fix.

#### Fixed

- **CRIT-01 — `hasConsistentHHHL`/`hasConsistentLHLL` used cumulative lifetime counts**
  (`src/modules/market-structure/trend.ts`, `src/modules/market-structure/index.ts`,
  `src/modules/analysis/compute/full-trend.ts`, `src/modules/validation/validate/consistency.ts`):
  Added `countRecentStructure()` that mirrors `determineTrend()`'s windowed slice (last
  `minSwingsForTrend × 2 = 8` labeled swings). `MarketStructureResult` now exposes both
  `structure` (full lifetime counts) and `recentStructure` (windowed). Module 6
  `synthesizeFullTrend` and Module 7 `checkConsistency` both consume `recentStructure`
  for HHHL/LHLL. Previously, `full-trend.ts` read `structure` (cumulative), which could
  report HHHL patterns from hundreds of candles ago even when recent price action was flat.

- **CRIT-02 — RSI overlap zone (45–55) undetected and undocumented**
  (`src/modules/validation/validate/contradictions.ts`, `src/modules/analysis/compute/evidence.ts`):
  `rsiBullishMin = 45` and `rsiBearishMax = 55` intentionally overlap; RSI 45–55 satisfies
  both thresholds simultaneously. `checkContradictions` now emits a `warning`-severity issue
  when both `rsiSupportsBullish` and `rsiSupportsBearish` are true. `collectEvidence` now
  emits `'RSI in neutral overlap zone'` (medium impact) explaining the dual contribution.
  The thresholds are unchanged — the overlap is intentional design, now surfaced explicitly.

- **CRIT-03 — MACD condition used only `macdLine > signalLine` (single condition)**
  (`src/modules/indicators/compute/macd.ts`, `src/modules/analysis/compute/full-trend.ts`,
  `src/modules/validation/validate/consistency.ts`):
  Implemented the three-condition MACD rule from ENGINE_RULES.md §4: `macdBullish` requires
  `macdLine > signalLine AND histogram > 0 AND histogram > previousHistogram`. Computed
  `previousHistogram` in `computeMacd` using the penultimate signal EMA value; returns `null`
  when `signalSeries.length < 2` (exactly 34 closes — conservative fallback). `macdBearish`
  requires the symmetric three conditions. Previously, a barely-positive MACD with a flat or
  declining histogram was incorrectly counted as a bullish condition.

- **CRIT-04 — S/R bounce confirmation used wrong boundary**
  (`src/modules/support-resistance/interactions.ts`):
  Resistance bounce confirmation: changed `candles[i+1].high < z.upper` →
  `candles[i+1].high < z.lower`. Support bounce confirmation: changed `candles[i+1].low > z.lower` →
  `candles[i+1].low > z.upper`. Previously, a "confirming" next candle whose high/low was inside
  the zone (between lower and upper) was counted as confirming a bounce — an incorrectly relaxed
  threshold that generated false successful reactions.

#### Changed

- **`src/modules/market-structure/types.ts`** — Added `recentStructure: StructureCounts` to
  `MarketStructureResult` with JSDoc describing the windowed scope.

- **`src/modules/indicators/types.ts`** — Added `previousHistogram: number | null` to `MACDResult`.

- **`src/modules/analysis/types.ts`** — Updated JSDoc for `hasConsistentHHHL`, `hasConsistentLHLL`,
  `macdBullish`, `macdBearish` to document sources and full rule.

- **`src/modules/analysis/compute/evidence.ts`** — Updated HH/HL/LH/LL evidence descriptions
  to reference `recentStructure` counts; unified RSI evidence block to handle overlap case.

- **`docs/ENGINE_RULES.md`** — §4 MACD table updated to full three-condition rule.
  §14.1 table: conditions 3 and 5 updated for `recentStructure` and three-condition MACD.
  §15.4 consistency check: `hasConsistentHHHL`/`LHLL` source updated to `recentStructure`;
  `macdBullish`/`macdBearish` updated to full three-condition derived form.
  §15.5 contradiction check: added RSI overlap warning row.

- **`docs/KNOWN_LIMITATIONS.md`** — Added LIM-030 (MACD `previousHistogram` null at 34
  closes) and LIM-031 (RSI 45–55 overlap zone — intentional design with Module 7 warning).

#### Tests Added (24 regression tests)

| CRIT | File | Tests |
|------|------|-------|
| CRIT-01 | `market-structure/__tests__/index.test.ts` | 3 — recentStructure in empty result; counts never exceed structure; total ≤ window |
| CRIT-01 | `analysis/__tests__/full-trend.test.ts` | 4 — recentStructure vs structure isolation tests |
| CRIT-02 | `validation/__tests__/contradictions.test.ts` | 2 — RSI overlap warning emitted; not emitted when only one condition true |
| CRIT-03 | `indicators/__tests__/macd.test.ts` | 4 — previousHistogram null at 34 closes; non-null at 35; zero when flat; finite in moving series |
| CRIT-03 | `analysis/__tests__/full-trend.test.ts` | 8 — macdBullish/macdBearish three-condition combinations |
| CRIT-04 | `support-resistance/__tests__/interactions.test.ts` | 4 — boundary tests for both zone types (not confirmed inside zone; confirmed strictly outside) |

### Modules Affected

- MODULE 2 — Technical Indicator Engine: `MACDResult.previousHistogram` added.
- MODULE 3 — Market Structure Engine: `MarketStructureResult.recentStructure` added.
- MODULE 4 — Support & Resistance Engine: bounce confirmation boundary corrected.
- MODULE 6 — Analysis Engine: three-condition MACD; `recentStructure` consumption; RSI overlap evidence.
- MODULE 7 — Validation Engine: RSI overlap warning; updated MACD and structure consistency checks.

### Test count: 613 tests passing (589 prior + 24 regression)

### Known Side Effects

- Any caller reading `macdBullish` may observe it switching from `true` to `false` on borderline
  MACD signals where histogram was not increasing. This is the correct behavior.
- `recentStructure` is additive to `MarketStructureResult` — no breaking change to existing callers
  reading `structure`.

---

## [0.10.0] — 2026-06-30

### MODULE 7 — Validation Engine

#### Added

- **`src/modules/validation/types.ts`** — `ValidationSeverity` (`critical | warning | info`), `ValidationCategory` (`completeness | consistency | contradiction | structural`), `ValidationIssue`, `ValidationResult`, `ValidationConfig`.

- **`src/modules/validation/config.ts`** — `DEFAULT_VALIDATION_CONFIG` (11 parameters: `zoneCenterTolerance`, `minEvidenceItems`, `minHighImpactEvidence`, `failOnWarning`, `rsiBullishMin`, `rsiBearishMax`, `adxWeakThreshold`, `rsiNeutralLow`, `rsiNeutralHigh`, `minBullishSwingsForTrend`, `minBearishSwingsForTrend`).

- **`src/modules/validation/validate/completeness.ts`** — `checkCompleteness(result, cfg)`: validates `price.current > 0`, non-empty symbol, `evidence.length >= minEvidenceItems`, high-impact evidence count, `bullishConditionsMet`/`bearishConditionsMet` ∈ [0,5], `neutralConditionsMet` ∈ [0,4].

- **`src/modules/validation/validate/consistency.ts`** — `checkConsistency(result, cfg)`: cross-checks all 19 `TrendConditions` booleans against their raw upstream sources (8 EMA price comparisons, 2 EMA order checks, 2 swing structure counts, 3 RSI checks, 2 MACD checks, 1 ADX check, 2 derived booleans, 2 S/R zone type checks, 11 volume context fields). Uses M6's exact RSI classification boundaries and MACD bias logic.

- **`src/modules/validation/validate/contradictions.ts`** — `checkContradictions(result)`: verifies `priceAboveAllEMAs`/`priceBelowAllEMAs` derivability, mutual exclusivity of above/below and bullish/bearish EMA order, condition-met count tallies (bullish/bearish/neutral), trend label matches `deriveTrendLabel` priority order, evidence sorted high → medium → low.

- **`src/modules/validation/validate/structural.ts`** — `checkStructural(result, cfg)`: zone geometry (`lower ≤ center ≤ upper`, `lower < upper`, optional width consistency warning), active zone type and broken-flag integrity, BOS/CHOCH detected-flag vs event array consistency, `last` pointer accuracy, chronological event ordering for BOS events, CHOCH events, and combined events array.

- **`src/modules/validation/index.ts`** — `validateAnalysis(result, config?)` public API. Merges partial config with `DEFAULT_VALIDATION_CONFIG`. Calls all four checkers in sequence. Computes `criticalCount`, `warningCount`, `infoCount`, `passed` (no critical issues; optionally no warnings when `failOnWarning`), `clean` (no issues at all), `summary` (human-readable one-liner). Re-exports all public types and `DEFAULT_VALIDATION_CONFIG`.

- **`src/modules/validation/__tests__/helpers.ts`** — `makeIndicators()`, `makeStructure()`, `makePriceZone()`, `makeSupportResistance()`, `makeVolumeAnalysis()`, `makeTrendConditions()`, `makeFullTrend()`, `makeEvidence()`, `makeValidResult()` — fully consistent strong-bullish scenario factory with all cross-field values aligned.

- **84 unit tests** across 5 test files: completeness × 13, consistency × 23, contradictions × 16, structural × 17, index × 15.

#### Changed

- **`docs/ARCHITECTURE.md`** — Replaced Module 7 placeholder description with full implementation detail: four validation categories, public API, configuration, test count, ADR reference.

- **`docs/ENGINE_RULES.md`** — Added §15 Validation Engine Rules (§15.1 public API, §15.2 result structure, §15.3 completeness check table, §15.4 consistency check table with all 22 field sources, §15.5 contradiction check table, §15.6 structural check tables for zone geometry + active zone integrity + event consistency, §15.7 default configuration table).

- **`docs/VALIDATION_RULES.md`** — Updated Stage 1 to document Module 7 implementation status and map each check to its checker function. Updated Stage 3 to separate implemented pre-AI checks (Module 7) from deferred post-AI text scanning (Module 9). Updated footer.

- **`docs/DECISIONS.md`** — Added ADR-020 (Validation Engine splits into four independent checkers).

- **`docs/KNOWN_LIMITATIONS.md`** — Added Module 7 section with LIM-028 (Stage 2 post-AI text scanning deferred to Module 9) and LIM-029 (timestamp recency check not implemented — pure function constraint).

- **`docs/ROADMAP.md`** — Progress 46% → 54%. Module 7 status: Not Started → Complete. Updated current task to Module 8.

- **`docs/TESTING_STRATEGY.md`** — Updated test count: 505/48 → 589/53.

### Modules Affected

- MODULE 7 — Validation Engine: **complete**. 84 tests passing.

### Test count: 589 tests passing (505 prior + 84 new)

### Known Side Effects

- None. Module 7 reads from but does not modify Modules 1–6 outputs.

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
