# Sentinel — Benchmarking Guide

## Purpose

Module 11 (Historical Replay & Benchmark Engine) allows Sentinel to:

- **Replay** historical OHLCV datasets through the complete analysis pipeline (Modules 1–10).
- **Compare** generated outputs against pinned expected values.
- **Detect regressions** when analysis logic changes unexpectedly.
- **Produce** reproducible benchmark reports.

This is **not a trading strategy backtester**. It is a deterministic validation framework for the analysis engine itself. It answers the question: "Did the same market data produce the same analysis as before?"

---

## Public API

```typescript
import { runBenchmark } from './src/modules/benchmark/index'

const result = await runBenchmark({
  dataset,         // BenchmarkDataset
  expected,        // ExpectedOutput (dot-notation paths → expected values)
  pipelineConfig,  // Partial<PipelineConfig> — optional pipeline overrides
  comparisonConfig // Partial<ComparisonConfig> — optional comparison config
})

console.log(result.passed)     // true | false
console.log(result.score)      // 0–100 (same as accuracy)
console.log(result.summary)    // human-readable one-liner
```

### BenchmarkResult fields

| Field | Type | Description |
|-------|------|-------------|
| `symbol` | `string` | Trading pair from dataset |
| `interval` | `Timeframe` | Candle interval from dataset |
| `datasetMetadata` | `Record<string, unknown>` | Pass-through of `dataset.metadata` |
| `analysis` | `PipelineResult` | Full pipeline output for this dataset |
| `expected` | `ExpectedOutput` | The expected values you provided |
| `comparisons` | `FieldComparison[]` | Per-field comparison results |
| `metrics` | `BenchmarkMetrics` | Accuracy, counts, timings |
| `passed` | `boolean` | True when failedFields = 0 and missingFields = 0 |
| `score` | `number` | 0–100 accuracy percentage |
| `summary` | `string` | Human-readable status line |

---

## Dataset Format

Datasets are plain JavaScript objects (or JSON files) conforming to `BenchmarkDataset`:

```typescript
interface BenchmarkDataset {
  symbol:    string        // e.g. "BTCUSDT"
  interval:  Timeframe     // e.g. "1h", "4h", "1d"
  candles:   Candle[]      // OHLCV + taker volume data
  metadata?: Record<string, unknown>  // optional (fetchedAt, description, etc.)
}
```

### Candle fields

| Field | Type | Description |
|-------|------|-------------|
| `openTime` | `number` | Unix ms — candle open time |
| `closeTime` | `number` | Unix ms — candle close time |
| `open` | `number` | Open price |
| `high` | `number` | High price |
| `low` | `number` | Low price |
| `close` | `number` | Close price |
| `volume` | `number` | Base asset volume |
| `quoteVolume` | `number` | Quote asset volume |
| `trades` | `number` | Number of trades |
| `takerBuyVolume` | `number` | Taker buy base volume |
| `takerSellVolume` | `number` | Taker sell base volume |

### Minimum candle count

The pipeline requires at least `minCandleCount` candles (default: **50**). Datasets with fewer candles cause a `PipelineError('insufficient_candles')`.

For full indicator coverage (EMA200 non-null, full MACD, etc.), provide **200+ candles**.

---

## Expected Output Format

Expected output is a flat object where **keys are dot-notation paths into `PipelineResult`**:

```json
{
  "analysis.fullTrend.trend":                    "strong bullish",
  "analysis.indicatorSummary.rsi.classification":"neutral",
  "analysis.emaContext.emaAlignment":            "bullish_stack",
  "analysis.marketStructure.trend":              "bullish",
  "analysis.marketStructure.strength":           "strong",
  "confidence.grade":                            "moderate",
  "confidence.score":                            5.2,
  "validation.passed":                           true,
  "validation.criticalCount":                    0,
  "validation.warningCount":                     0,
  "generatedAnalysis.headline":                  "BTC holds key support",
  "metadata.symbol":                             "BTCUSDT",
  "metadata.interval":                           "1h",
  "metadata.candleCount":                        200,
  "metadata.version":                            "0.11.0",
  "analysis.evidence.length":                    12
}
```

### Path resolution rules

- **Dot notation** navigates nested properties: `"confidence.grade"` → `result.confidence.grade`
- **Array `.length`** is accessible: `"analysis.evidence.length"` → `result.analysis.evidence.length`
- Paths that do not exist in actual produce `MISSING` status.

### Absent assertion

Use `"$absent"` to assert a field must NOT exist in the output:

```json
{ "someOldField.thatWasRemoved": "$absent" }
```

If the field is present, status is `EXTRA`. If absent, status is `PASS`.

### What NOT to include

| Excluded field pattern | Reason |
|------------------------|--------|
| `metadata.timestamp` | Changes every run |
| `metadata.executionTime` | Varies with hardware |
| `metadata.timings.*` | All timing sub-fields |
| `analysis.analysedAt` | Changes every run |
| Generated IDs | Non-deterministic |

These paths are in `DEFAULT_COMPARISON_CONFIG.ignoredPaths` and are skipped automatically.

---

## Comparison Results

Each field produces a `FieldComparison`:

| Status | Meaning | Severity |
|--------|---------|----------|
| `PASS` | Values match (within tolerance) | `info` |
| `FAIL` | Path found, values do not match | `error` |
| `MISSING` | Path not found in actual output | `error` |
| `EXTRA` | Field present but expected `$absent` | `info` |

`passed = (failedFields === 0 && missingFields === 0)`

---

## Numeric Tolerance

Floating-point values are compared with an absolute tolerance (`numericTolerance`, default `0.001`). Override per benchmark:

```typescript
await runBenchmark({
  dataset,
  expected: { 'confidence.score': 5.2 },
  comparisonConfig: { numericTolerance: 0.1 },
})
```

---

## Adding a New Benchmark Dataset

1. **Collect candles** — export historical OHLCV data for your symbol/interval.

2. **Format as `BenchmarkDataset`** — include all required candle fields plus `takerBuyVolume` and `takerSellVolume`.

3. **Run once with empty expected** — to capture actual stable outputs:
   ```typescript
   const result = await runBenchmark({ dataset, expected: {} })
   console.log(result.analysis.confidence.grade)
   console.log(result.analysis.analysis.fullTrend.trend)
   // etc.
   ```

4. **Pin the stable fields** — create your `expected.json` with the values you want to monitor.

5. **Re-run with expected** — confirm `result.passed === true`.

6. **Save dataset + expected** — commit both to `test-fixtures/<name>/`.

7. **Add a benchmark test** — import and run in your test suite or CI.

---

## Regression Detection

When pipeline logic changes (intentionally or accidentally), re-running the benchmark against a pinned expected file detects regressions:

- **FAIL fields** — a previously stable output value changed.
- **MISSING fields** — a field that previously existed was removed from the output.

Use `generateReport(result)` to produce a human-readable markdown diff report.

---

## Generating a Report

```typescript
import { runBenchmark, generateReport } from './src/modules/benchmark/index'

const result = await runBenchmark({ dataset, expected })
const report = generateReport(result)
console.log(report)
```

The report includes:
- Pass/fail status and score
- Per-stage timing breakdown
- All mismatched fields with expected vs. actual values

---

## Architecture

```
runBenchmark(options)
  │
  ├── replayDataset(dataset, pipelineConfig)
  │     └── analyzeMarket({ fetchImpl: () => dataset.candles, ... })
  │           └── Modules 1–9 (full pipeline)
  │
  ├── compareOutputs(analysis, expected, config)
  │     └── For each key in expected:
  │           resolvePath(analysis, dotNotationKey) → PASS / FAIL / MISSING / EXTRA
  │
  ├── computeMetrics(comparisons, timings)
  │
  └── BenchmarkResult
```

**No file I/O** inside the module. Dataset loading is dependency-injected — callers provide the dataset object directly. The module itself never reads from disk or network.

**Fully deterministic** — the same dataset + expected always produces the same comparisons (timing fields excluded).

---

## Source

```
src/modules/benchmark/
  types.ts      BenchmarkDataset, ExpectedOutput, FieldComparison, BenchmarkResult, ...
  config.ts     DEFAULT_COMPARISON_CONFIG, ignored paths
  compare.ts    compareOutputs() — dot-notation field comparison engine
  metrics.ts    computeMetrics() — accuracy + count calculations
  replay.ts     replayDataset() — feeds dataset through analyzeMarket()
  report.ts     generateReport() — markdown benchmark report
  index.ts      runBenchmark() — main entry point + all re-exports
```
