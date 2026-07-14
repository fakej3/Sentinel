# Sentinel — Pipeline Data Flow

This document traces every stage of the analysis pipeline from raw API data to a
published Binance Square post. Each stage lists the exact source files, its inputs,
and its outputs.

---

## Stage Map

```
Binance REST API
      │
      ▼
  src/modules/binance/         ← fetchMarketData()
      │  MarketData (candles[], ticker, fundingRate?, openInterest?)
      ▼
  src/modules/indicators/      ← computeIndicators()
      │  IndicatorResult (RSI, MACD, EMA, ATR, ADX, VWAP, Bollinger…)
      ▼
  src/modules/market-structure/ ← computeMarketStructure()
      │  MarketStructureResult (trend, swings[], bos, choch, consolidation…)
      ▼
  src/modules/support-resistance/ ← computeSupportResistance()
      │  SupportResistanceResult (zones[], nearestSupport, nearestResistance…)
      ▼
  src/modules/volume-analysis/  ← computeVolumeAnalysis()
      │  VolumeAnalysisResult (relativeVolume, buySellPressure, climax…)
      ▼
  src/modules/analysis/         ← computeAnalysis()
      │  MarketAnalysisResult (fullTrend, emaContext, indicatorSummary,
      │                         srContext, volumeContext, evidence[])
      ▼
  src/modules/validation/       ← validateAnalysis()
      │  ValidationResult (passed, clean, issues[], criticalCount, warningCount)
      ▼
  src/modules/confidence/       ← computeConfidence()
      │  ConfidenceResult (score 0–10, grade, breakdown, trust, analysisQuality)
      ▼
  src/modules/pipeline/         ← computeDecision() + computeTradePlan() + …
      │  TradeDecision, TradePlan, MarketContext, InvalidationScenarios,
      │  ConfidenceExplanation, MarketStory, ContradictionIntelligence,
      │  TraderReview, OpportunityAssessment, ConfidenceSanityResult
      ▼
  src/modules/writer/           ← generateAnalysis()
      │  GeneratedAnalysis (headline, summary, sections[], fullReport, binancePost)
      ▼
  src/modules/ai/               ← provider.enhance()  [optional, never throws]
      │  AI-enhanced summary/conclusion (falls back to deterministic if unsafe)
      ▼
  PipelineResult                ← returned by analyzeMarket() in src/modules/pipeline/index.ts
      │
      ├── src/api/routes.ts     → POST /analyze  (REST API)
      ├── src/cli/index.ts      → sentinel CLI    (terminal)
      └── src/ui/               → React dashboard  (browser)
```

---

## Stage Details

### Stage 1 — Binance Data Engine

| | |
|---|---|
| **Entry point** | `src/modules/binance/index.ts` → `fetchMarketData()` |
| **HTTP client** | `src/modules/binance/client.ts` |
| **Endpoints** | `src/modules/binance/endpoints.ts` |
| **Normalisation** | `src/modules/binance/normalise.ts` |
| **Output type** | `MarketData` in `src/modules/binance/types.ts` |

Fetches raw OHLCV candles and 24h ticker in parallel. Funding rate and open
interest are optional. Returns the data unchanged — no inference, no filtering.

---

### Stage 2 — Technical Indicator Engine

| | |
|---|---|
| **Entry point** | `src/modules/indicators/index.ts` → `computeIndicators()` |
| **Compute files** | `src/modules/indicators/compute/` (one file per indicator) |
| **Helper series** | `src/modules/indicators/utils.ts` (`emaSeries`, `rsiSeries`) |
| **Output type** | `IndicatorResult` in `src/modules/indicators/types.ts` |

Computes all indicators from OHLCV arrays. Each indicator returns `null` when
insufficient candle history is available. No interpretation — only numbers.

Indicators: EMA(20/50/100/200), SMA(20/50/200), RSI(14), MACD, ATR(14),
ADX(14), VWAP, Bollinger Bands(20), StochRSI(14), OBV, MFI(14), CCI(20),
VolumeMA(20).

---

### Stage 3 — Market Structure Engine

| | |
|---|---|
| **Entry point** | `src/modules/market-structure/index.ts` → `computeMarketStructure()` |
| **Swing detection** | `src/modules/market-structure/swings.ts` |
| **Swing labels** | `src/modules/market-structure/labels.ts` (HH/HL/LH/LL/EH/EL) |
| **Trend** | `src/modules/market-structure/trend.ts` |
| **BOS / CHoCH** | `src/modules/market-structure/bos-choch.ts` |
| **Consolidation** | `src/modules/market-structure/consolidation.ts` |
| **Breakout** | `src/modules/market-structure/breakout.ts` |
| **Pullback** | `src/modules/market-structure/pullback.ts` |
| **Confidence** | `src/modules/market-structure/confidence.ts` |
| **Output type** | `MarketStructureResult` in `src/modules/market-structure/types.ts` |

Deterministic — identical candles always produce identical structure. Rules
documented in `docs/ENGINE_RULES.md`.

---

### Stage 4 — Support & Resistance Engine

| | |
|---|---|
| **Entry point** | `src/modules/support-resistance/index.ts` → `computeSupportResistance()` |
| **Zone creation** | `src/modules/support-resistance/zones.ts` |
| **Zone merging** | `src/modules/support-resistance/merge.ts` |
| **Interactions** | `src/modules/support-resistance/interactions.ts` (touches, bounces, retests) |
| **Strength** | `src/modules/support-resistance/strength.ts` |
| **Evidence** | `src/modules/support-resistance/evidence.ts` |
| **Output type** | `SupportResistanceResult` in `src/modules/support-resistance/types.ts` |

Zones are built from swing highs/lows, sized by ATR, then merged if within
`mergeTolerance × ATR`. Strength decays with age since last interaction.
Distance to nearest zones is measured from the zone *edge* (upper for support,
lower for resistance), not the center.

---

### Stage 5 — Volume Analysis Engine

| | |
|---|---|
| **Entry point** | `src/modules/volume-analysis/index.ts` → `computeVolumeAnalysis()` |
| **Compute files** | `src/modules/volume-analysis/compute/` (one file per sub-analysis) |
| **Output type** | `VolumeAnalysisResult` in `src/modules/volume-analysis/types.ts` |

Nine sub-analyses: relative volume, volume trend, buy/sell pressure, volume
confirmation, climax detection, accumulation/distribution, OBV analysis,
VWAP analysis, and overall strength.

---

### Stage 6 — Analysis Engine

| | |
|---|---|
| **Entry point** | `src/modules/analysis/index.ts` → `computeAnalysis()` |
| **Compute files** | `src/modules/analysis/compute/` |
| **Price summary** | `compute/price.ts` |
| **Full trend** | `compute/full-trend.ts` — synthesizes indicator + structure signals |
| **EMA context** | `compute/ema-context.ts` |
| **Indicators** | `compute/indicators.ts` — classifies each indicator's reading |
| **SR context** | `compute/sr-context.ts` — proximity to nearest zones |
| **Volume ctx** | `compute/volume-context.ts` |
| **Evidence** | `compute/evidence.ts` — collects all evidence items |
| **Output type** | `MarketAnalysisResult` in `src/modules/analysis/types.ts` |

This is the central synthesis stage. All upstream outputs converge here into a
single `MarketAnalysisResult` that all downstream stages read from.

---

### Stage 7 — Validation Engine

| | |
|---|---|
| **Entry point** | `src/modules/validation/index.ts` → `validateAnalysis()` |
| **Validators** | `src/modules/validation/validate/` (one file per check type) |
| **Completeness** | `validate/completeness.ts` — required fields must be non-null |
| **Consistency** | `validate/consistency.ts` — RSI/trend/ATR must agree with config |
| **Contradictions** | `validate/contradictions.ts` — detects conflicting signals |
| **Structural** | `validate/structural.ts` — price range, volume sanity, etc. |
| **Config** | `src/modules/validation/config.ts` — thresholds must match `analysis/config.ts` |
| **Output type** | `ValidationResult` in `src/modules/validation/types.ts` |

Raises `critical` issues for definite data problems, `warning` for borderline
cases, and `info` for observations. Critical issues prevent trade signals.

---

### Stage 8 — Confidence Engine

| | |
|---|---|
| **Entry point** | `src/modules/confidence/index.ts` → `computeConfidence()` |
| **Compute files** | `src/modules/confidence/compute/` |
| **Score** | `compute/score.ts` — evidence-weighted 0–10 |
| **Grade** | `compute/grade.ts` — very_strong / strong / moderate / mixed / weak |
| **Breakdown** | `compute/breakdown.ts` — per-source contribution |
| **Quality** | `compute/quality.ts` — contradiction groups, analysis quality |
| **Trust** | `compute/trust.ts` — data reliability score (0–100%) |
| **Reliability** | `compute/reliability.ts` — per-indicator completeness |
| **Config** | `src/modules/confidence/config.ts` |
| **Output type** | `ConfidenceResult` in `src/modules/confidence/types.ts` |

The confidence score reflects how certain Sentinel is that its conclusion is
correct — not how bullish/bearish the market is. Direction-aware: in trending
markets, dominant-side evidence drives the score; opposing evidence applies a
contradiction penalty.

---

### Stage 9 — Pipeline Decision Layer

| | |
|---|---|
| **Entry point** | `src/modules/pipeline/index.ts` |
| **Compute files** | `src/modules/pipeline/compute/` |
| **Trade decision** | `compute/decision.ts` — Buy/Sell/Hold label |
| **Trade plan** | `compute/trade-plan.ts` — entry zone, stop, target, RR, quality |
| **Market context** | `compute/market-context.ts` — phase, regime, momentum |
| **Invalidation** | `compute/invalidation.ts` — scenarios that break the thesis |
| **Confidence expl.** | `compute/confidence-explanation.ts` — plain-language score reason |
| **Market story** | `compute/market-story.ts` — narrative arc |
| **Contradiction int.** | `compute/contradiction-intelligence.ts` — per-category severity |
| **Trader review** | `compute/trader-review.ts` — professional-trader perspective |
| **Opportunity** | `compute/opportunity-assessment.ts` — market quality vs setup quality |
| **Sanity audit** | `compute/sanity-audit.ts` — internal consistency flags |
| **MTF agreement** | `compute/mtf-agreement.ts` — multi-timeframe consensus |
| **Output types** | `src/modules/pipeline/types.ts` |

All sub-computes in Stage 9 read from the outputs of Stages 1–8 only. They
never fetch data or run indicators themselves.

---

### Stage 10 — Writer Engine

| | |
|---|---|
| **Entry point** | `src/modules/writer/index.ts` → `generateAnalysis()` |
| **Sections** | `src/modules/writer/sections.ts` — one build function per section |
| **Composition** | `src/modules/writer/compose.ts` — assembles full report |
| **Binance post** | `src/modules/writer/binance-post.ts` — character-limited post |
| **Config** | `src/modules/writer/config.ts` |
| **Output type** | `GeneratedAnalysis` in `src/modules/writer/types.ts` |

Deterministic — identical inputs produce identical text. No AI, no randomness,
no network calls. Supports two templates (`standard` / `brief`) and three
verbosity levels.

---

### Stage 11 — AI Enhancement (optional)

| | |
|---|---|
| **Entry point** | `src/modules/ai/index.ts` → `createAIProvider()` |
| **Gemini provider** | `src/modules/ai/providers/gemini.ts` |
| **Types** | `src/modules/ai/types.ts` |

Optionally rewrites the `summary` and `conclusion` fields using an LLM. If the
AI output contains hedging language (`"probably"`, `"might suggest"`, etc.) or
the call fails for any reason, the deterministic writer output is used instead.
Never affects analysis, confidence, or trade decisions.

---

## Where Key Values Are Computed

| Value | File |
|---|---|
| Confidence score (0–10) | `src/modules/confidence/compute/score.ts` |
| Confidence grade | `src/modules/confidence/compute/grade.ts` |
| Data trust (0–100%) | `src/modules/confidence/compute/trust.ts` |
| Trade decision (Buy/Sell/Hold) | `src/modules/pipeline/compute/decision.ts` |
| Trade plan (entry/stop/target/RR) | `src/modules/pipeline/compute/trade-plan.ts` |
| Setup quality (excellent…avoid) | `src/modules/pipeline/compute/trade-plan.ts` |
| Full trend label | `src/modules/analysis/compute/full-trend.ts` |
| Zone strength | `src/modules/support-resistance/strength.ts` |
| Binance Square post text | `src/modules/writer/binance-post.ts` |
| Writer full report | `src/modules/writer/compose.ts` |
| Pipeline orchestration | `src/modules/pipeline/index.ts` → `analyzeMarket()` |

---

## Where the UI Gets Its Data

The frontend reads from the REST API at `src/api/routes.ts` → `POST /analyze`,
which returns the full `PipelineResult` as JSON.

| UI component | Data source in PipelineResult |
|---|---|
| Summary tab | `analysis`, `confidence`, `decision`, `tradePlan` |
| Evidence tab | `analysis.evidence` |
| Indicators tab | `analysis.indicatorSummary`, `indicators` |
| Structure tab | `marketStructure` |
| Volume tab | `volumeAnalysis` |
| Trade tab | `tradePlan`, `decision`, `marketContext`, `invalidationScenarios` |
| Writer tab | `generatedAnalysis` |
| Validation tab | `validation` |
| Benchmark tab | via `POST /benchmark` |

---

## Config Files

Each module has its own config file with typed defaults:

| Module | Config file |
|---|---|
| Analysis | `src/modules/analysis/config.ts` |
| Confidence | `src/modules/confidence/config.ts` |
| Market structure | `src/modules/market-structure/config.ts` |
| Support/resistance | `src/modules/support-resistance/config.ts` |
| Volume analysis | `src/modules/volume-analysis/config.ts` |
| Validation | `src/modules/validation/config.ts` |
| Writer | `src/modules/writer/config.ts` |
| Pipeline | `src/modules/pipeline/config.ts` |
| Historical validation | `src/modules/historical-validation/types.ts` (DEFAULT_WALK_CONFIG) |

> **Important:** `validation/config.ts` contains RSI threshold constants that
> **must match** `analysis/config.ts`. If they diverge, the consistency validator
> will raise critical issues.

---

## Historical Validation & Backtesting

| | |
|---|---|
| **Entry point** | `src/modules/historical-validation/index.ts` → `runHistoricalValidation()` |
| **Walk-forward** | `src/modules/historical-validation/walk.ts` — sliding window over candle history |
| **Outcome simulation** | `src/modules/historical-validation/outcome.ts` — TP/SL/MFE/MAE |
| **Reports** | `src/modules/historical-validation/reports.ts` — per-bucket analysis |
| **Dashboard** | `src/modules/historical-validation/dashboard.ts` — aggregate CalibrationDashboard |
| **Text report** | `src/modules/historical-validation/text-report.ts` — human-readable output |

The historical validation runs the complete production pipeline (Stages 1–10)
at every step. Degenerate steps where the pipeline throws are silently skipped.
