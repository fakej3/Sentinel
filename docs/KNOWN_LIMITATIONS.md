# Sentinel — Known Limitations

This document is the permanent record of intentional limitations, deferred
enhancements, architectural tradeoffs, and accepted technical debt.

**This is not a bug tracker.** Every entry here represents a conscious engineering
decision — either to defer work to a future milestone, or to accept a tradeoff
in exchange for a benefit.

**Maintenance rule:** Whenever a limitation is intentionally accepted instead of
fixed, it must be added here before the module is merged. If a limitation is
later resolved, its entry is moved to the "Resolved" section at the bottom of
this document with the version it was resolved in.

---

## Indicator Engine (Module 2)

---

### LIM-001 — VWAP Uses Cumulative Calculation (Not Session-Based)

**Description:**
`computeVwap` calculates a rolling cumulative VWAP from the first candle in the
input array to the last. It does not reset at the start of each trading session
(midnight UTC, or market open for traditional assets).

**Why it exists:**
Binance does not provide session timestamps for crypto assets, which trade 24/7.
A session boundary must be inferred or defined externally. Implementing a
configurable session-reset VWAP requires additional design work that is out of
scope for Module 2.

**Current impact:**
VWAP values will differ from TradingView's session-based VWAP, particularly on
longer timeframes where multiple sessions span the input candle series. On
shorter timeframes (1h, 4h with < 24h of data), the difference is negligible.

**Risk level:** Medium

**Planned resolution:**
Introduce `computeSessionVwap` with configurable session boundary (`'midnight-utc'`
or `'custom'`) when the platform is validated against TradingView reference values.

**Target:** v1.x.x (post-1.0.0, when TradingView comparison tests are implemented)

---

### LIM-002 — Indicator Parity with TradingView Not Verified

**Description:**
Indicator values (EMA, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, etc.)
have not been compared against TradingView reference outputs for the same symbol
and timeframe. The implementations follow published formulas and match each other
internally, but cross-platform agreement has not been verified empirically.

**Why it exists:**
Building a TradingView comparison test suite requires a recorded dataset of real
candles paired with TradingView-exported values. This dataset collection and the
comparison infrastructure are deferred to a dedicated validation milestone.

**Current impact:**
Indicator values are likely very close to TradingView for most indicators. The
known divergence is VWAP (LIM-001). Other potential divergence sources: seeding
method for EMA (SMA vs first-value), Wilder's smoothing period for RSI/ATR,
and ATR calculation for the first bar.

**Risk level:** Medium

**Planned resolution:**
Implement a `test-fixtures/` reference dataset with TradingView-exported values.
Add `__tests__/tradingview-compat.test.ts` for each indicator.

**Target:** v0.10.0 or a dedicated validation milestone before v1.0.0.

---

### LIM-003 — StochRSI Returns 0 on Flat Price Series

**Description:**
When all closes in the StochRSI window are identical (zero RSI range), the
denominator of the Stochastic formula is `0`. The implementation guards against
division by zero by returning `{ k: 0, d: 0 }`. This produces an "oversold"
reading in a market that is perfectly flat or in an extreme uptrend where RSI is
consistently at 100.

**Why it exists:**
The degenerate case (`max(RSI) === min(RSI)`) has no mathematically meaningful
StochRSI value. Returning `0` is a safe default that prevents `NaN` from
propagating through the pipeline.

**Current impact:**
An analysis during a strong uninterrupted uptrend may show a StochRSI "oversold"
reading when the indicator is in fact saturated. This is a misleading signal.
The Evidence Engine (Module 6) should detect the degenerate condition and suppress
the StochRSI evidence line.

**Risk level:** Low (affects edge case; real market data rarely sustains zero-range RSI)

**Planned resolution:**
Expose a `degenerate: boolean` flag from `computeStochRsi`. Module 6 uses this flag
to suppress the StochRSI evidence line when the range is degenerate.

**Target:** Module 6 implementation

---

## Support & Resistance Engine (Module 4)

---

### LIM-015 — Zone Width Uses Module 2's ATR Implementation

**Description:**
Zone boundaries are computed as `center ± ATR × atrMultiplier`. The ATR value
is computed by Module 2's `computeAtr` function (exported from
`src/modules/indicators`). Module 4 extracts `highs[]`, `lows[]`, and `closes[]`
from the candle array and calls `computeAtr` directly. Module 4 does not contain
its own ATR implementation.

If Module 4 is called with insufficient candle data (< 15 candles for 14-period
ATR), `computeAtr` returns `null` and zone widths fall back to `center × 0.003`
(0.3% of price).

**Why it exists:**
ATR is a Module 2 concept. Sharing the canonical implementation avoids
duplication and ensures all modules compute ATR identically.

**Current impact:**
Zone widths in synthetic test scenarios with flat candles (zero ATR) use the
fallback width. The fallback produces valid zones — just less adaptive to
current volatility.

**Risk level:** Low (documented; test factories can inject ATR values via the `atr` parameter)

**Planned resolution:**
When the full platform pipeline is assembled, Module 4 will receive real candles
from Module 1 and produce realistic ATR-based widths automatically.

**Target:** Platform integration (Module 9+).

---

### LIM-017 — Merge-Before-Interactions May Double-Count Constituent Swing Touches

**Description:**
The Module 4 pipeline merges zones before applying candle interactions (Create →
Merge → Interactions). After a merge, the merged zone inherits a `touchCount`
of `N` from its `N` constituent swing points. When `applyInteractions` then scans
the candle history, a candle near one of those constituent swings may re-enter the
merged zone's (now wider) boundaries and be counted as an additional touch.

**Why it exists:**
The merge-before-interactions order is intentional. The alternative (Create →
Interactions → Filter → Merge) caused interactions to be detected against each
zone's narrow pre-merge boundaries, missing interactions that fell inside the
merged zone area. The current order produces correct interaction history at the
cost of potential minor overcounting.

**Current impact:**
At most `N − 1` extra touches for `N` merged constituent swings. In real market
data, constituent swing candles genuinely interacted with the merged price area,
so the overcounting reflects real market activity. In unit tests with synthetic
flat candles the constituent swing candles are far from zone boundaries, so no
overcounting occurs.

**Risk level:** Low (accepted tradeoff; strength score impact is bounded — at most +1.0 per extra touch)

**Planned resolution:**
Track constituent swing candle indices and skip them in `applyInteractions`.
Deferred because the benefit is minor and the implementation adds complexity.

**Target:** Post-v1.0.0.

---

### LIM-018 — Look-Ahead Bias in `didReverseWithin3`

**Description:**
The `didReverseWithin3` helper in `interactions.ts` reads up to 3 candles ahead
of the current position to determine whether a potential break reversed back into
the zone. This is a form of look-ahead bias: the classification of candle `i` as
a "break" depends on what happens at candles `i+1`, `i+2`, and `i+3`.

**Why it exists:**
A break confirmed at candle `i` that reverses at candle `i+1` is not a real
break — it is a wick-through or a failed break attempt. Look-ahead is needed
to distinguish genuine breaks from transient excursions.

**Current impact:**
The engine is designed for batch analysis (a complete candle history). In a
streaming context where candles arrive one at a time, `i+1` through `i+3` are not
yet available, and the break classification must be deferred until they arrive.
The current implementation is not compatible with streaming without modification.

**Risk level:** Low (batch analysis only; streaming is not yet implemented)

**Planned resolution:**
When streaming analysis is introduced, implement a deferred classification queue
that holds potential breaks for 3 candles before finalising.

**Target:** When streaming analysis is introduced.

---

### LIM-019 — VolumeMA Uses Prior Bars Only (Minimum Input: period + 1)

**Description:**
`computeVolumeMa(volumes, period)` computes the moving average of the **prior**
`period` bars, excluding the current bar. This means `relativeVolume` compares
the current bar's volume against a baseline that does not include it.

As a consequence, the minimum input length is `period + 1` (not `period`). With
the default period of 20, at least 21 volume bars are required for a non-null result.

**Why it exists:**
Including the current bar in its own moving average inflates the MA during
high-volume candles and suppresses the `relativeVolume` reading. Excluding the
current bar provides a true comparison: current bar vs. prior history.

**Current impact:**
Any caller passing exactly `period` bars will receive `null` instead of a result.
The prior implementation (before v0.7.1) accepted `period` bars and included the
current bar in the MA.

**Risk level:** Low (breaking change from v0.7.0; all internal callers updated)

**Planned resolution:**
No change planned. Prior-bars-only is the correct convention.

**Target:** N/A — this is intentional behavior.

---

### LIM-016 — Classical Pivot Points Not Modeled as Zones

**Description:**
Classical pivot points (Pivot, R1, R2, S1, S2) from the previous session's
High/Low/Close are not included in the zone architecture. They were documented
in the original `ENGINE_RULES.md §12` but were superseded by the zone-based design.

**Why it exists:**
Classical pivots are mathematical constructs with no connection to where price
actually reacted. They are useful as secondary reference points in traditional
equity markets but are less reliable in 24/7 crypto markets that have no session
boundary. They would require a new `ZoneOrigin` type (`'classical-pivot'`) and
session-boundary logic.

**Current impact:**
None during Module 4 development.

**Risk level:** Low

**Planned resolution:**
Add classical pivots as an optional zone origin type when the full evidence engine
is assembled and we can measure whether pivot levels have predictive value in the
tested symbols.

**Target:** Post-v1.0.0.

---

## Market Structure Engine (Module 3)

---

### LIM-004 — Historical Replay Validation Not Implemented

**Description:**
Module 3 (`computeMarketStructure`) has not been run against recorded real-market
candle data and the outputs have not been compared against manual charting or a
reference system. The algorithm has been tested with synthetic candle sequences
(staircase trends, flat series, controlled edge cases) but not against real
historical BTC/ETH data.

**Why it exists:**
A historical replay test suite requires a recorded dataset, a reference labeling
method (manual or from a trusted charting tool), and a comparison framework. This
is planned but deferred.

**Current impact:**
Parameter choices (`swingLookback: 2`, `consolidationThreshold: 3.0%`, etc.) are
based on `ENGINE_RULES.md` specifications, not empirically tuned on real data.
The engine may over-detect or under-detect swings on real market data.

**Risk level:** Medium

**Planned resolution:**
Build a `test-fixtures/` suite with real OHLC data for BTC, ETH, and SOL across
multiple timeframes. Run `computeMarketStructure` on each and compare output
against manual chart annotations.

**Target:** Before v1.0.0

---

### LIM-005 — Structural Bias ≠ Full Trend (Module 3 `trend` Field)

**Description:**
`MarketStructureResult.trend` reflects the directional lean of swing patterns
(HH/HL vs LH/LL) only. It does not incorporate EMA alignment, RSI level, or
MACD bias as required by the full trend definition in `ENGINE_RULES.md §1`.

**Why it exists:**
Module 3 operates on candle data only and does not receive indicator data from
Module 2. Full trend synthesis requires cross-module input and belongs in the
Evidence Engine (Module 6). See ADR-005.

**Current impact:**
A caller reading `result.trend === 'bullish'` should understand this means the
swing structure is bullish, not that the full trend confirmation has been completed.
The evidence string array describes the limitation.

**Risk level:** Low (well-documented; downstream callers have not been built yet)

**Planned resolution:**
Module 6 will produce a synthesized `trend` field that incorporates Module 2 and
Module 3 outputs. The naming of `MarketStructureResult.trend` will be reviewed
at that point.

**Target:** Module 6 implementation

---

## Infrastructure

---

### LIM-006 — Binance API Requires Server-Side Proxy in Production

**Description:**
Direct browser requests to `api.binance.com` are blocked by CORS. A server-side
proxy is required for production deployment. During local development, a Vite
`server.proxy` configuration is used. See ADR-004 and `ARCHITECTURE.md` (CORS section).

**Why it exists:**
Browser security (Same-Origin Policy + CORS) prevents direct cross-origin
requests from a web app to a third-party API that does not opt in with
`Access-Control-Allow-Origin` headers. Binance does not opt in for browser clients.

**Current impact:**
Module 1 tests pass because `fetch` is mocked. In the browser, `fetchMarketData`
will fail with a CORS error unless the Vite dev proxy or a production proxy is
in place. The platform cannot fetch live data in production without the proxy.

**Risk level:** High (blocks production deployment of any browser-based feature)

**Planned resolution:**
Implement a thin server-side proxy (Node.js/Express or a serverless function) as
part of the PWA hosting infrastructure. Spec documented in `ARCHITECTURE.md`.

**Target:** When Module 9 (PWA shell) development begins.

---

### LIM-007 — No API Rate Limiting Implementation

**Description:**
Module 1 (`client.ts`) does not implement any client-side Binance API rate
limiting. It fires requests as requested by the caller. The Binance REST API
enforces a weight limit of 1,200 per minute on the spot API. Exceeding this
limit results in a 429 response and a temporary IP ban.

**Why it exists:**
The current usage (one `fetchMarketData` call at a time, triggered by a user
button click) is well within Binance's rate limits. Implementing a rate limiter
before it is needed would add premature complexity.

**Current impact:**
In the current single-user, single-button-click model, rate limiting is not a
practical concern. If the platform ever runs batch analysis (multiple symbols
in parallel, scheduled runs), this becomes a significant risk.

**Risk level:** Low now; Medium when batch analysis is added.

**Planned resolution:**
Implement a token-bucket rate limiter in `client.ts` configured with Binance's
documented weight limits. Weight values per endpoint to be documented in
`constants.ts`.

**Target:** When batch analysis or scheduled analysis is introduced.

---

### LIM-008 — No Retry Strategy for Network Failures

**Description:**
Module 1's fetch functions throw `BinanceApiError` or `Error` on first failure.
There is no automatic retry with backoff for transient network errors (e.g., a
momentary connectivity drop).

**Why it exists:**
Retry logic adds significant complexity (backoff timing, maximum attempts, error
classification) and is only valuable in a reliable network environment with known
transient failure rates. For a single-user browser app triggered by a button click,
asking the user to click again is an acceptable alternative.

**Current impact:**
A single transient network error causes the fetch to fail and surfaces an error
message to the user. The user must retry manually.

**Risk level:** Low

**Planned resolution:**
Add configurable retry-with-exponential-backoff to `client.ts` when the system
supports automated analysis runs where user retries are not feasible.

**Target:** When scheduled or automated analysis is implemented.

---

## Performance

---

### LIM-009 — No Caching or Memoization

**Description:**
Every call to `computeMarketStructure` or `computeIndicators` runs the full
computation pipeline from scratch. There is no memoization, no result cache, and
no incremental update when a new candle is appended to an existing series.

**Why it exists:**
Memoization requires a cache key strategy (candle array identity or hash) and
invalidation logic. For the current single-analysis-at-a-time model, full
recomputation is instantaneous (< 5 ms for 1 000 candles) and adds no perceptible
latency.

**Current impact:**
No performance impact at current scale. If the platform renders live updating
charts at tick-level resolution (sub-second updates), full recomputation on every
tick would be too expensive.

**Risk level:** Low now; Medium when real-time streaming is added.

**Planned resolution:**
Implement an incremental append mode where a new candle is appended and only the
affected tail of the series is recomputed.

**Target:** When live streaming is introduced.

---

### LIM-010 — Multi-Market Optimization Not Implemented

**Description:**
Computing indicators and market structure for multiple symbols simultaneously
(e.g., a 10-coin dashboard) requires independent calls to all computation
functions per symbol. There is no batching, parallelism, or shared sub-result
reuse across symbols.

**Why it exists:**
The current architecture is single-symbol. Multi-symbol optimization would require
a stateful computation coordinator that is out of scope for the current milestone.

**Current impact:**
A 10-coin dashboard would require 10 independent full-pipeline runs. On a modern
browser this is feasible (10 × ~5 ms = ~50 ms) but not optimal.

**Risk level:** Low

**Planned resolution:**
If multi-coin analysis is introduced, evaluate a Web Worker pool that runs each
symbol's pipeline in parallel on a separate thread.

**Target:** Multi-symbol dashboard feature (not yet scheduled).

---

## AI Layer

---

### LIM-011 — AI Writing Engine Not Implemented

**Description:**
Modules 9 (AI Writing Engine) and 10 (Content Generator) do not yet exist. The
deterministic analysis pipeline (Modules 1–8) produces a JSON payload, but no
prose content is generated.

**Why it exists:**
The AI writing layer depends on a complete and validated analysis payload. Building
it before the upstream modules are stable would produce unreliable content.
The sequencing rule is: deterministic analysis first, AI writing second.

**Current impact:**
The platform cannot produce the Binance Square articles that are the intended end
product.

**Risk level:** N/A (planned future work, not a tradeoff)

**Planned resolution:**
Module 9 will use the Claude API (model: claude-sonnet-4-6 or equivalent) with a
structured prompt format, strict evidence injection, and output validation through
Module 7.

**Target:** After Module 8 is complete (target: v1.5.0).

---

### LIM-012 — Hallucination Benchmarking Not Implemented

**Description:**
No systematic test exists that measures how often the AI Writing Engine introduces
factual claims not present in the input JSON. This is planned as part of Module 7
(Validation Engine) quality assurance.

**Why it exists:**
Hallucination benchmarking requires a ground truth dataset of input JSONs and
expected outputs, plus an automated claim-extraction mechanism. This is a
significant research and infrastructure investment.

**Current impact:**
None until Module 9 is implemented.

**Risk level:** High (production risk once AI writing is active)

**Planned resolution:**
Define a benchmark dataset of 50 input payloads with known expected outputs.
Measure rejection rate across 10 generation attempts per payload. Target: < 5%
sentence rejection rate.

**Target:** v1.5.0 release criteria.

---

## Testing

---

### LIM-013 — No Historical Replay Test Suite

**Description:**
The test suite uses synthetic candle sequences (mathematically constructed trends,
controlled edge cases). No test verifies module behavior on real recorded
historical data from Binance.

**Why it exists:**
Real historical data requires a data collection mechanism, storage, and a
reference-labeling process. Collecting a high-quality fixture dataset takes
meaningful calendar time.

**Current impact:**
Algorithm parameter values (`swingLookback`, `consolidationThreshold`, etc.) are
chosen from `ENGINE_RULES.md` specifications, not empirically validated. They may
need adjustment when tested on real data.

**Risk level:** Medium

**Planned resolution:**
Create `test-fixtures/` with at minimum:
- BTCUSDT 4h (500 candles, capturing at least one full bull/bear cycle)
- ETHUSDT 4h (500 candles)
- SOLUSDT 1d (200 candles)

Pre-compute reference outputs and freeze them as snapshots.

**Target:** Before v1.0.0.

---

### LIM-014 — No Performance Benchmark Suite

**Description:**
There is no automated benchmark that measures the execution time of analysis
functions and fails if time exceeds a threshold. Performance has been manually
verified to be fast enough for current usage but is not continuously monitored.

**Why it exists:**
Vitest does not include built-in benchmarking by default (it is available via
`vitest bench` but not configured). Benchmark configuration is deferred.

**Current impact:**
A performance regression (e.g., an O(n²) algorithm introduced inadvertently)
would not be caught by CI until a user notices UI lag.

**Risk level:** Low

**Planned resolution:**
Configure `vitest bench` for critical-path functions (`computeMarketStructure`,
`computeIndicators`) with a 1 000-candle input and a 50 ms timeout.

**Target:** Before v1.0.0.

---

## Future Analysis Features (Not Yet Implemented)

The following analysis features are mentioned in `ROADMAP.md` under Future Ideas.
They are recorded here as deferred items so that their absence is explicit and
intentional.

---

## Volume Analysis Engine (Module 5)

---

### LIM-020 — VWAP Cross Detection Uses Current VWAP Against Historical Closes

**Description:**
`computeVWAPAnalysis` detects whether price crossed the VWAP within the last 5 candles by comparing each close against the single `indicators.vwap` value. This is an approximation: the true rolling VWAP changes with each candle, so a past close may have been above/below the VWAP that existed at that point in time, not the current one.

**Why it exists:**
Module 5 receives only the current snapshot `IndicatorResult`. Historical VWAP values per candle are not stored or passed down. Recomputing the full VWAP for each historical candle would require raw candle data and additional computation not in scope for this function.

**Current impact:**
The cross detection may produce false positives or miss true crosses when the VWAP has moved significantly over the lookback window. For small windows (≤5 candles) and stable VWAP values, this approximation is acceptable.

**Risk level:** Low

**Planned resolution:**
If historical VWAP per candle is ever stored in `IndicatorResult` (as an array), upgrade to exact per-candle comparison.

**Target:** Post-1.0.0

---

### LIM-021 — Climax Multi-Bar High/Low Uses Last 10 Candles Only

**Description:**
Buying climax requires `current.close === highestClose` over the last 10 candles. Selling climax requires `current.close === lowestClose`. The lookback window of 10 is hardcoded.

**Why it exists:**
A configurable lookback was considered but rejected in favor of simplicity. Ten candles represents approximately 2.5 sessions on the 1h timeframe — a reasonable "recent high/low" window for most timeframes.

**Current impact:**
May miss climax signals on longer timeframes where 10 candles is insufficient context. May over-trigger on short timeframes where price frequently makes new 10-bar highs/lows.

**Risk level:** Low

**Planned resolution:**
Add `climaxLookback` to `VolumeAnalysisConfig` if users report sensitivity issues.

**Target:** TBD

---

## Analysis Engine (Module 6)

---

### LIM-023 — RSI Divergence Not Detectable (No RSI Series from Module 2)

**Description:**
Detecting RSI divergence requires comparing RSI values at two swing points of the
same type. This requires a candle-indexed RSI series. Module 2 exposes only the
current scalar `indicators.rsi` value.

**Why it exists:**
RSI series storage was not included in `IndicatorResult` during Module 2 design.
The series is computed internally but discarded.

**Current impact:**
ENGINE_RULES.md §3 RSI divergence factors cannot be included in Module 6 evidence.
ENGINE_RULES.md §11 lists these as scoring factors (+15 bullish, −20 bearish) —
these weights are present in the factor table but will never be triggered until
this limitation is resolved.

**Risk level:** Medium

**Planned resolution:**
Add `rsiSeries: number[]` (or `rsiAtSwings: number[]`) to `IndicatorResult`.
This is a non-breaking addition to Module 2.

**Target:** v1.x.x

---

### LIM-024 — MACD Crossover on Current Candle Not Detectable

**Description:**
Detecting a current-candle MACD crossover requires comparing `histogram[n-1]` and
`histogram[n]`. Module 2 exposes only the current histogram value.

**Why it exists:**
Previous-bar storage was not included in `IndicatorResult` during Module 2 design.

**Current impact:**
Module 6 uses `histogram > 0 / < 0` as a proxy for MACD bias direction. This is
less precise than a crossover signal — a histogram that has been positive for 20
bars is treated identically to one that just crossed above zero.

**Risk level:** Low

**Planned resolution:**
Add `indicators.macd.crossover: 'bullish' | 'bearish' | 'none'` to `MACDResult`.
One-line addition to `computeMacd`.

**Target:** v1.x.x

---

### LIM-025 — ATR Percentile vs Historical Range Not Available

**Description:**
ENGINE_RULES.md §6 defines volatility classification by ATR percentile (vs 30-day
average). Module 2 exposes `atrPercent` (ATR as % of current price) but no
percentile ranking versus its own history.

**Why it exists:**
Percentile computation requires storing a rolling ATR history, which was not
included in Module 2 scope.

**Current impact:**
Module 6 cannot classify whether current ATR is elevated, normal, or compressed
relative to recent history. Bollinger bandwidth serves as a partial proxy.

**Risk level:** Low

**Planned resolution:**
Add `atrPercentile: number | null` (0–100, computed over a configurable window)
to `IndicatorResult`.

**Target:** TBD

---

### LIM-026 — StochRSI K/D Crossover Not Detectable

**Description:**
StochRSI crossover detection requires comparing K and D values across two
consecutive candles. Module 2 exposes only current-bar K and D.

**Why it exists:**
Previous-bar storage not included in `StochRSIResult` during Module 2 design.

**Current impact:**
Module 6 detects overbought/oversold zones but cannot detect the K-crosses-D
signal. ENGINE_RULES.md §10 crossover rules (Bullish/Bearish Crossover signals)
are not emitted in evidence.

**Risk level:** Low

**Planned resolution:**
Add `stochRsi.crossover: 'bullish' | 'bearish' | 'none'` to `StochRSIResult`.

**Target:** TBD

---

### LIM-030 — MACD `previousHistogram` Unavailable at Minimum Candle Count (34 Closes)

**Description:**
`computeMacd` requires at least 34 closes (EMA26 = 26 candles + signal EMA9 = 9 values − 1 overlap = 34).
At exactly 34 closes, the signal EMA series has exactly one value, so `previousHistogram` (the histogram
one bar earlier) cannot be computed and is returned as `null`.

The full MACD bullish/bearish three-condition rule (`macdLine > signalLine AND histogram > 0 AND
histogram > previousHistogram`) requires a non-null `previousHistogram`. When null, `macdBullish`
and `macdBearish` are both `false` — a conservative fallback that avoids a spurious signal on the
very first bar MACD is available.

With 35 or more closes, `previousHistogram` is always non-null.

**Why it exists:**
The three-condition rule (implemented in CRIT-03) is safer than the old single-condition rule
(`macdLine > signalLine`), but requires two consecutive histogram values. At minimum candle count,
only one exists.

**Current impact:**
On the first bar MACD is available (exactly 34 closes), neither `macdBullish` nor `macdBearish`
is true. A symbol with exactly 34 candles in the input loses one MACD condition point. In practice,
callers pass 200+ candles, so this is never triggered.

**Risk level:** Low (degenerate edge case; real callers always pass ≥ 200 candles)

**Planned resolution:**
No change planned. The conservative null fallback is correct behavior.

**Target:** N/A — intentional.

---

### LIM-031 — RSI Overlap Zone: 45–55 Satisfies Both Bullish and Bearish Thresholds

**Description:**
`rsiBullishMin = 45` and `rsiBearishMax = 55` create an intentional overlap zone. Any RSI
value in the range [45, 55] simultaneously satisfies both `rsiSupportsBullish (rsi ≥ 45)` and
`rsiSupportsBearish (rsi ≤ 55)`, contributing one point to each condition count.

**Why it exists:**
The thresholds reflect genuine market ambiguity at neutral RSI levels. An RSI of 50 is not
clearly bullish or bearish; allowing it to contribute a weak point in both directions prevents
the engine from forcing a definitive bias on an ambiguous signal. The overlapping design is
intentional (ENGINE_RULES.md §1 and §3).

**Current impact:**
When both conditions are simultaneously true:
- Module 6 evidence emits `'RSI in neutral overlap zone'` (medium impact) with an explicit note
  that RSI contributes one point to each direction.
- Module 7 (`checkContradictions`) emits a `warning`-severity `contradiction` issue for
  `fullTrend.conditions` mentioning `rsiSupportsBullish and rsiSupportsBearish`.
- The validation result still `passed: true` (warnings do not fail unless `failOnWarning: true`).

**Risk level:** Low (documented behavior; warning surfaced in Module 7 output)

**Planned resolution:**
No change to thresholds planned. The overlap zone and warning are the intended design.

**Target:** N/A — intentional.

---

### LIM-027 — Volume Trend Acceleration Not Available

**Description:**
Module 6 cannot distinguish an accelerating volume trend from a steady one.
Module 5 exposes `volumeTrend.direction` (OLS slope direction) and `confidence`
(R²), but not a second derivative or two-window comparison.

**Why it exists:**
Volume trend acceleration was out of Module 5's initial scope.

**Current impact:**
`increasing` volume trend could mean slowly increasing or rapidly spiking.
Both produce the same evidence item.

**Risk level:** Low

**Planned resolution:**
Add `volumeTrend.acceleration: 'accelerating' | 'decelerating' | 'steady'` to
`VolumeAnalysisResult` using a two-window OLS comparison.

**Target:** TBD

---

### LIM-022 — Accumulation/Distribution Score Uses Fixed Signal Weights

**Description:**
Each ACC/DIST signal contributes a hardcoded weight (+1, +2, −1, or −2). The weights are not configurable.

**Why it exists:**
A configurable weight table would add significant interface complexity. The current weights reflect reasonable signal importance rankings based on conventional market analysis (e.g., CHoCH is weighted +2 as it signals a structural shift, while buy pressure is +1 as it is more noise-sensitive).

**Current impact:**
Different market participants weight signals differently. The fixed weights may not match all use cases.

**Risk level:** Low

**Planned resolution:**
Add `accDistWeights` config map if user feedback indicates misaligned weights.

**Target:** TBD

---

## Deferred Features

| Feature | Reason Deferred | Target |
|---------|-----------------|--------|
| Multi-timeframe confluence | Requires cross-timeframe data model (not in Module 1 API) | Post-1.0.0 |
| Order Blocks | Detection algorithm not yet defined in ENGINE_RULES.md | TBD |
| Fair Value Gaps (FVG) | Detection algorithm not yet defined | TBD |
| Liquidity Sweeps | Requires order book data (not available from REST API) | TBD |
| Volume Profile | Requires tick-level or bucketed volume data | TBD |
| Anchored VWAP | Session-based VWAP (LIM-001) must be resolved first | Post-LIM-001 |
| Fibonacci Confluence | Algorithm not yet defined in ENGINE_RULES.md | TBD |
| Elliott Wave | Highly subjective; no deterministic rule set exists | Unlikely |
| Wyckoff Analysis | Requires precise definition of Wyckoff phases | TBD |
| Order Book Analysis | Requires WebSocket data; outside current REST API scope | Post-2.0.0 |
| On-Chain Metrics | Requires third-party on-chain data API | Post-2.0.0 |

---

## Resolved Limitations

Entries moved here were open limitations that have since been fixed. Recorded for
audit trail purposes.

| ID | Description | Resolved in |
|----|-------------|-------------|
| — | `EMPTY_RESULT` was a shared object; mutations corrupted subsequent callers. Replaced with `makeEmptyResult()`. | v0.5.0 |
| — | `computeConfidence` returned 0–100; docs specified 0–10. Fixed to return 0–10. | v0.5.0 |
| — | `detectBreakout` included the breakout candle in its own volume MA. Fixed to use prior candles only. | v0.5.0 |
| — | `ARCHITECTURE.md` JSON schema showed boolean booleans for `higherHighs`/`bos`. Updated to match actual types. | v0.5.0 |
| — | `VALIDATION_RULES.md` referenced `marketStructure.higherHighs must be true` (boolean). Updated to `structure.higherHighs > 0`. | v0.5.0 |
| — | `VALIDATION_RULES.md` referenced `"neutral"` trend value. Removed; only `"ranging"` exists in `TrendDirection`. | v0.5.0 |

---

---

## Validation Engine (Module 7)

---

### LIM-028 — Stage 2 Post-AI Text Scanning Deferred to Module 9

**Description:**
`VALIDATION_RULES.md` defines three validation stages. Stage 2 (post-AI output
scanning: numeric claims, indicator state claims, market structure claims, trend
claims, S/R claims, confidence claims) and the remaining post-AI Stage 3 text
contradiction checks are not implemented in Module 7.

Module 7 implements pre-AI validation only: completeness, consistency, contradiction
detection in the computed `MarketAnalysisResult`, and structural integrity of zones
and market structure events.

**Why it exists:**
Stage 2 and post-AI Stage 3 require the AI-generated text to exist before validation
can run. They are inherently coupled to Module 9 (AI Writing Engine), which does not
yet exist. Implementing a text scanner without a text generator would produce no
testable behavior.

**Current impact:**
The Validation Engine (`validateAnalysis`) only validates the computed JSON payload.
Once Module 9 is implemented, AI-generated prose is not yet validated against the
source data. Any factual error introduced by the AI during prose generation will not
be caught until Module 9 integrates with a post-generation validation pass.

**Risk level:** High (production risk once AI writing is active; no impact during
Modules 1–8 development)

**Planned resolution:**
Module 9 implementation must include a post-generation validation loop that
re-uses `validateAnalysis` for data-accuracy checks and adds text-scanning logic
for Stage 2 claims (as documented in `VALIDATION_RULES.md §Stage 2`).

**Target:** Module 9 — AI Writing Engine.

---

### LIM-029 — Timestamp Recency Check Not Implemented

**Description:**
`VALIDATION_RULES.md` Stage 1 specifies that the analysis timestamp must be within
5 minutes of the current time to prevent stale data from reaching the AI writer.
Module 7 does not perform this check.

**Why it exists:**
Modules 1–8 are pure computation functions with no access to the system clock.
`validateAnalysis` is a deterministic pure function; calling `Date.now()` inside
it would violate the determinism requirement (ADR-001) because the result would
differ depending on when the function was called.

**Current impact:**
A stale `MarketAnalysisResult` (e.g., from a cached analysis computed hours ago)
will pass Module 7 validation. No mechanism currently prevents stale data from
reaching Module 9.

**Risk level:** Medium (stale data is misleading; not a critical correctness failure)

**Planned resolution:**
Implement timestamp recency as an optional check in Module 9's orchestration layer,
where the caller knows the current time and can pass a `maxAgeMs` threshold as
context. Alternatively, expose a `checkTimestamp(result, currentTime)` utility
in Module 7 for callers that can supply the current time.

**Target:** Module 9 integration.

---

*Last updated: Module 7 — Validation Engine (v0.10.0)*
