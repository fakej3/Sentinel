# Sentinel — Test Fixtures

Benchmark datasets and expected output files for the Historical Replay & Benchmark Engine.

---

## Directory Structure

```
test-fixtures/
  README.md               (this file)
  sample/
    dataset.json          Dataset format illustration (5 synthetic candles)
    expected.json         Expected output format illustration
```

---

## Dataset Format

A benchmark dataset is a JSON object with the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `symbol` | `string` | Yes | Trading pair (e.g. `"BTCUSDT"`) |
| `interval` | `Timeframe` | Yes | Candle interval (e.g. `"1h"`, `"4h"`, `"1d"`) |
| `candles` | `Candle[]` | Yes | Historical OHLCV data |
| `metadata` | `object` | No | Arbitrary metadata (fetchedAt, description, etc.) |

### Candle Object

```json
{
  "openTime":       1700000000000,
  "closeTime":      1700003599999,
  "open":           49500.00,
  "high":           50200.00,
  "low":            49300.00,
  "close":          50100.00,
  "volume":         1250.5,
  "quoteVolume":    62500000,
  "trades":         4200,
  "takerBuyVolume": 700.0,
  "takerSellVolume":550.5
}
```

---

## Expected Output Format

An expected output is a flat JSON object where **keys are dot-notation paths into `PipelineResult`** and **values are the expected scalar values** at those paths.

### Stable Fields (Recommended)

Only include fields whose values are stable across equivalent market conditions.
**Never include** timestamp fields, execution times, generated IDs, or timing data.

```json
{
  "analysis.fullTrend.trend":                    "strong bullish",
  "analysis.indicatorSummary.rsi.classification":"neutral",
  "analysis.emaContext.emaAlignment":            "bullish_stack",
  "confidence.grade":                            "moderate",
  "confidence.score":                            5.2,
  "validation.passed":                           true,
  "validation.criticalCount":                    0,
  "validation.warningCount":                     0,
  "generatedAnalysis.headline":                  "BTC holds key support level",
  "metadata.symbol":                             "BTCUSDT",
  "metadata.interval":                           "1h",
  "metadata.candleCount":                        200
}
```

### Absent Assertions

Use `"$absent"` as the value to assert that a field must NOT be present in the output:

```json
{
  "confidence.someRemovedField": "$absent"
}
```

---

## Minimum Candle Count

The pipeline requires a minimum of 50 candles by default (`minCandleCount: 50`).
Datasets with fewer candles will cause the benchmark to throw a `PipelineError('insufficient_candles')`.

For full indicator coverage (EMA200 non-null), provide at least 200 candles.

---

## How to Run Benchmarks

```typescript
import { runBenchmark } from './src/modules/benchmark/index'
import dataset from './test-fixtures/sample/dataset.json'
import expected from './test-fixtures/sample/expected.json'

const result = await runBenchmark({ dataset, expected })
console.log(result.passed ? 'PASS' : 'FAIL')
console.log(result.summary)
```

---

## Adding a New Dataset

1. Collect historical candle data for the symbol/interval you want to benchmark.
2. Format it as a `BenchmarkDataset` object and save as `test-fixtures/<name>/dataset.json`.
3. Run the pipeline once to generate the expected output:
   ```typescript
   const result = await runBenchmark({ dataset, expected: {} })
   // capture result.analysis fields you want to pin
   ```
4. Save the captured stable fields as `test-fixtures/<name>/expected.json`.
5. Re-run `npm test` to confirm the benchmark passes.

---

## Best Practices

- **Only pin stable fields.** Avoid comparing raw numeric indicators that vary with floating-point precision.
- **Use `numericTolerance`** in `ComparisonConfig` for confidence scores and other floats.
- **Never pin timestamps**, IDs, `analysedAt`, `fetchedAt`, or execution timings.
- **Keep datasets minimal.** 100–200 candles is enough for full pipeline coverage.
- **Document each dataset** with a `metadata.description` field explaining its purpose.
- **Regenerate expected files** after intentional algorithm changes; treat unexpected changes as regressions.
