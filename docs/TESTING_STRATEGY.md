# Sentinel — Testing Strategy

This document is the permanent testing handbook for the project.

It defines the testing philosophy, test categories, naming conventions, folder
structure, mock strategy, factory patterns, and expectations for every future module.

Every engineer adding a module must read this document before writing the first test.

---

## Testing Philosophy

### Correctness Over Coverage

Coverage metrics measure which lines were executed, not whether the output was
correct. A 100% coverage suite can still miss a wrong sign in a formula, an
off-by-one boundary, or a case where `NaN` propagates silently.

The goal of testing in this project is **to verify that calculations are correct**,
not to maximise a coverage number.

Every test must assert a specific, meaningful property of the output. Tests that
only verify "the function did not throw" are insufficient unless the test is
specifically targeting crash-safety.

### Determinism as a First-Class Guarantee

Every analysis function in Modules 1–8 is deterministic: the same input always
produces the same output. Tests enforce this as an explicit contract, not an
implicit assumption. Every module must include a test that calls the function twice
on the same input and asserts the outputs are identical.

### Regression Prevention

When a bug is fixed, a regression test must be added in the same commit. The test
must be named to describe the bug scenario, not the fix. This ensures that the
same bug cannot re-enter the codebase silently.

### Test as Documentation

A well-named test suite is also the most reliable form of algorithm documentation.
Reading the tests for a function should reveal what inputs it handles, what
properties the output satisfies, and what edge cases the author considered. Comments
in source code can drift; passing tests cannot.

---

## Test Categories

### 1. Unit Tests

Test a single exported function in isolation with controlled inputs.

**Purpose:** Verify that the algorithm produces the correct output for known inputs.

**Characteristics:**
- All dependencies are in-process (no network, no filesystem, no randomness).
- Inputs are minimal — just enough to exercise the specific behavior being tested.
- Every meaningful code path through the function has at least one test.

**Naming pattern:** `'<returns/detects/computes> <specific behavior> when <condition>'`

**Example:**
```typescript
it('returns empty array when closes.length < period', () => {
  expect(rsiSeries([1, 2, 3], 14)).toEqual([])
})

it('returns 100 when all closes are increasing', () => {
  const closes = Array.from({ length: 20 }, (_, i) => i + 1)
  expect(rsiSeries(closes, 14).every(v => v === 100)).toBe(true)
})
```

---

### 2. Integration Tests

Test the module's public API (`computeMarketStructure`, `computeIndicators`,
`fetchMarketData`, etc.) with a realistic multi-step candle sequence.

**Purpose:** Verify that the full pipeline produces coherent, self-consistent output
on inputs that resemble real market data.

**Characteristics:**
- Inputs are candle series that represent a recognisable market condition (staircase
  uptrend, staircase downtrend, flat consolidation, etc.).
- Assertions check cross-field consistency: if `trend = 'bullish'`, then
  `structure.higherHighs + structure.higherLows > structure.lowerHighs + structure.lowerLows`.
- The test reads like a market scenario description.

**Example:**
```typescript
it('identifies a staircase uptrend as bullish with positive HH and HL counts', () => {
  const result = computeMarketStructure(buildBullishTrend(5))
  expect(result.trend).toBe('bullish')
  const bullCount = result.structure.higherHighs + result.structure.higherLows
  const bearCount = result.structure.lowerHighs + result.structure.lowerLows
  expect(bullCount).toBeGreaterThan(bearCount)
})
```

---

### 3. Regression Tests

Named test cases that lock a specific past bug fix to ensure it cannot regress.

**Purpose:** Permanent record that a bug existed and can no longer recur.

**Characteristics:**
- The test description names the bug scenario, not the fix.
- The test is added in the same commit that fixes the bug.
- The test must **fail** on the buggy code and **pass** on the fixed code.

**Example:**
```typescript
// Regression: EMPTY_RESULT was a shared object; mutations from one caller
// would corrupt subsequent callers' empty results.
it('two calls to empty result return independent nested objects', () => {
  const r1 = computeMarketStructure([])
  const r2 = computeMarketStructure([])
  r1.bos.events.push({ type: 'BOS', index: 0, timestamp: 0, level: 100, direction: 'bullish' })
  expect(r2.bos.events).toHaveLength(0)
})
```

---

### 4. Boundary Tests

Test behavior at the exact boundaries of thresholds, minimum lengths, and config values.

**Purpose:** Verify that off-by-one errors do not exist and that boundary conditions
are handled consistently.

**Always test:**
- `length === period - 1` → should return empty/null.
- `length === period` → should return exactly one result.
- `value === threshold` → should be confirmed, not rejected (or vice versa, explicitly defined by the rule).
- `value === threshold + ε` and `value === threshold - ε`.

**Example:**
```typescript
it('returns exactly one value when closes.length === period', () => {
  expect(emaSeries([2, 4, 6], 3)).toHaveLength(1)
})

it('returns empty when closes.length === period - 1', () => {
  expect(emaSeries([1, 2], 3)).toEqual([])
})

it('confirms breakout when relVol === breakoutVolumeMultiplier (≥, not >)', () => {
  // relVol exactly at threshold should confirm
  const cs = Array.from({ length: 20 }, (_, i) => candle(105, 1000, i))
  cs.push(candle(112, 1300, 20))  // vol 1.3 × 1000 = threshold
  expect(detectBreakout(cs, consolidation, DEFAULT_CONFIG).confirmed).toBe(true)
})
```

---

### 5. Invalid Input Tests

Test behavior when inputs do not meet the minimum requirements.

**Purpose:** Ensure the function fails gracefully — no `NaN`, no `undefined`, no crash.

**Always test:**
- Empty array `[]`.
- Array shorter than the minimum required length.
- All values identical (zero variance).
- Extremely large values.
- Volume = 0 on every candle.

**Example:**
```typescript
it('returns 0 when input array is empty', () => {
  expect(computeMarketStructure([]).confidence).toBe(0)
})

it('does not produce NaN when all closes are equal', () => {
  const result = computeMarketStructure(Array(50).fill(null).map((_, i) =>
    candle(100, { high: 100, low: 100 }, i)
  ))
  expect(Number.isFinite(result.confidence)).toBe(true)
})
```

---

### 6. Property Tests

Verify mathematical invariants that must hold for all valid inputs.

**Purpose:** Catch classes of bugs that point tests would miss because the bug only
manifests on certain combinations of inputs.

**Common properties to verify:**
- `takerBuyVolume + takerSellVolume === volume` (conservation invariant).
- `confidence ∈ [0, 10]` for all valid inputs.
- Dominant swings always alternate between `'high'` and `'low'` types.
- `HH + HL + LH + LL + EH + EL === total labeled swings`.
- RSI ∈ [0, 100] for all inputs where at least one change exists.

**Example:**
```typescript
it('takerBuyVolume + takerSellVolume equals total volume', () => {
  const c = normaliseCandle(RAW_CANDLE)
  expect(c.takerBuyVolume + c.takerSellVolume).toBeCloseTo(c.volume, 3)
})
```

---

### 7. Performance Tests

Verify that the function completes in acceptable time on large inputs.

**Current standard:** Every function must complete on 1 000 candles within 50 ms
in the Vitest environment. This is a smoke-level benchmark, not a precise SLA.

Performance tests are currently manual. The automated performance test suite is
tracked as a future milestone in `KNOWN_LIMITATIONS.md`.

---

### 8. Future Test Categories (Not Yet Implemented)

The following test categories are planned but deferred. They are tracked in
`KNOWN_LIMITATIONS.md`.

#### Historical Replay Tests

Run each analysis module on a recorded dataset of real OHLC candles and compare
the output against a pre-computed reference snapshot. This verifies that algorithm
changes do not silently alter output for real market conditions.

**Requirements:** A curated historical dataset stored in `test-fixtures/` and a
snapshot comparison mechanism.

#### TradingView Comparison Tests

Compare key indicator values (EMA, RSI, MACD, ATR) against reference values
exported from TradingView for the same candle series. This verifies that the
implementations match the industry-standard reference.

#### TA-Lib Verification Tests

Compare indicator outputs against TA-Lib's C library implementation for the same
inputs. TA-Lib is the closest to a "ground truth" for financial technical indicators.

#### Visual Validation

Render charts from computed indicator values and visually compare them against
TradingView screenshots for the same symbol and timeframe. This catches errors
that numerical tests miss (e.g., an indicator that produces correct individual
values but in the wrong sequence).

---

## Naming Conventions

### Test Files

```
src/modules/<module-name>/__tests__/<sub-module>.test.ts
```

Examples:
- `src/modules/market-structure/__tests__/bos-choch.test.ts`
- `src/modules/indicators/__tests__/rsi.test.ts`

### Test Descriptions

Use full natural-language sentences describing behavior, not code.

| Pattern | Good | Bad |
|---------|------|-----|
| Unit | `'returns empty array when closes.length < period'` | `'test rsiSeries with short input'` |
| Integration | `'identifies a staircase downtrend as bearish'` | `'bearish test'` |
| Regression | `'two calls to empty result return independent nested objects'` | `'fix shared EMPTY_RESULT'` |
| Boundary | `'confirms breakout when relVol equals threshold exactly'` | `'boundary test'` |
| Property | `'confidence is always between 0 and 10'` | `'confidence range test'` |

### `describe` Blocks

Group tests by the function under test:

```typescript
describe('emaSeries', () => {
  it('returns empty array when values.length < period', ...)
  it('first value equals SMA seed when values.length === period', ...)
})

describe('rsiSeries', () => {
  it('returns empty array when closes.length < period + 1', ...)
})
```

---

## Folder Structure

```
src/
  modules/
    binance/
      __tests__/
        normalise.test.ts       # normaliseCandle, normaliseCandles, ...
        endpoints.test.ts       # fetchCandles, fetchTicker24h, ...
        index.test.ts           # fetchMarketData (integration)
    indicators/
      __tests__/
        utils.test.ts           # emaSeries, rsiSeries
        ema.test.ts             # computeEma
        rsi.test.ts             # computeRsi
        macd.test.ts            # computeMacd
        ...
        index.test.ts           # computeIndicators (integration)
    market-structure/
      __tests__/
        helpers.ts              # shared factory functions (not a test file)
        swings.test.ts          # detectRawSwings, filterDominantSwings
        labels.test.ts          # labelSwings
        trend.test.ts           # countStructure, determineTrend
        bos-choch.test.ts       # detectBosChoch
        consolidation.test.ts   # detectConsolidation
        breakout.test.ts        # detectBreakout
        pullback.test.ts        # detectPullback (when implemented separately)
        index.test.ts           # computeMarketStructure (integration)
```

Helper files (`helpers.ts`) inside `__tests__/` must not be named `*.test.ts` —
Vitest will not treat them as test files. They export factory functions only.

---

## Mock Strategy

### Network Calls

Module 1 (`fetchMarketData`) is the only module that makes network calls. Its tests
mock the global `fetch` function using Vitest's `vi.fn()` / `vi.stubGlobal`.

Modules 2–8 are pure computation functions. They must not be tested with mocks.
All inputs are passed directly as function parameters.

### Time

No analysis function uses `Date.now()` or `new Date()`. Timestamps in outputs are
derived from the `openTime`/`closeTime` fields of the input candle array. There is
nothing to mock.

### Randomness

No analysis function uses `Math.random()`. There is nothing to mock.

---

## Test Factories

Every module that processes `Candle` objects must define a factory function in
its `__tests__/helpers.ts` file. Do not repeat raw candle literals across tests.

### Candle Factory — Module 1 Canonical

```typescript
function candle(
  close: number,
  opts: { high?: number; low?: number; volume?: number } = {},
  index = 0,
): Candle {
  const high   = opts.high   ?? close + 0.5
  const low    = opts.low    ?? close - 0.5
  const volume = opts.volume ?? 1000
  return {
    openTime:         index * 3_600_000,
    closeTime:        index * 3_600_000 + 3_599_999,
    open:             close,
    high,
    low,
    close,
    volume,
    quoteVolume:      close * volume,
    trades:           10,
    takerBuyVolume:   volume * 0.5,
    takerSellVolume:  volume * 0.5,
  }
}
```

All modules use this pattern. The `index` parameter controls `openTime` so that
arrays of candles have monotonically increasing timestamps.

### Sequence Factories

For integration tests, build named market scenario sequences:

```typescript
function buildBullishTrend(steps: number): Candle[]   // staircase HH-HL
function buildBearishTrend(steps: number): Candle[]   // staircase LH-LL
function buildRanging(bars: number, center = 100, amplitude = 1): Candle[]
```

These are placed in the integration test file (`index.test.ts`) rather than
`helpers.ts` because they are scenario-specific, not reusable primitives.

---

## Reference Datasets

Real-market reference datasets are planned but not yet created. When introduced:

- Store in `test-fixtures/<symbol>/<timeframe>.json`.
- Include at minimum 500 candles.
- Include pre-computed expected outputs for snapshot comparison.
- Version-control the fixtures; never auto-regenerate them without review.

---

## CI Expectations

The full test suite must pass on every commit to a feature branch and on every
pull request to `main`.

Current suite: **318 tests across 30 test files** (as of v0.7.1).

CI command: `npm test` (`vitest run`).

No test may be skipped (`.skip`) in merged code. Skipped tests must be removed or
converted to pending issues in `KNOWN_LIMITATIONS.md`.

---

*Last updated: Milestone 0.4 — Engineering Standards*
