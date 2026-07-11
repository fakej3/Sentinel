# Sentinel

Professional crypto market analysis engine and dashboard. Produces technically
accurate, evidence-backed content for Binance Square from live Binance market data.

## Quick Start

```bash
npm install

# Terminal 1 — API server (port 3000)
npm run start:api

# Terminal 2 — React dashboard (port 5173)
npm run dev
```

Open `http://localhost:5173`. See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)
for environment variables, port configuration, and the Gemini API key setup.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server (frontend) |
| `npm run start:api` | Express API server on port 3000 |
| `npm run build` | Production build |
| `npm test` | Run all tests + typecheck |
| `npm run typecheck` | TypeScript type-check only |

## Repository Structure

```
src/
├── modules/                    # Analysis engine — all pipeline stages
│   ├── binance/                # Stage 1: Fetch raw OHLCV from Binance REST API
│   ├── indicators/             # Stage 2: Technical indicators (RSI, MACD, EMA…)
│   ├── market-structure/       # Stage 3: Swing detection, BOS/CHoCH, trend
│   ├── support-resistance/     # Stage 4: Price zones, strength, interactions
│   ├── volume-analysis/        # Stage 5: Relative volume, buy/sell pressure, climax
│   ├── analysis/               # Stage 6: Synthesis — trend, evidence, SR/volume context
│   ├── validation/             # Stage 7: Completeness, consistency, contradiction checks
│   ├── confidence/             # Stage 8: Evidence-weighted confidence score (0–10)
│   ├── pipeline/               # Stage 9–10: Decision, trade plan, writer orchestration
│   ├── writer/                 # Stage 10: Report generation (sections → full report)
│   ├── ai/                     # Stage 11: Optional LLM enhancement (Gemini)
│   ├── historical-validation/  # Walk-forward backtesting + CalibrationDashboard
│   └── benchmark/              # Field-by-field regression testing against fixtures
│
├── api/                        # Express REST API — routes.ts wraps analyzeMarket()
├── cli/                        # CLI tool — index.ts wraps analyzeMarket()
├── ui/                         # React dashboard
│   ├── components/
│   │   ├── layout/             # App shell: Header, Sidebar, panels
│   │   ├── shared/             # Reusable: Badge, Card, ConfidenceMeter, Tabs…
│   │   └── tabs/               # Analysis tabs: Summary, Evidence, Trade, Writer…
│   ├── hooks/                  # useAnalyze, useApiStatus, useLocalStorage…
│   ├── pages/                  # AnalysisPage, DashboardPage, HistoryPage…
│   ├── utils/                  # colors.ts, format.ts, timeframes.ts…
│   └── types.ts                # UI-layer type re-exports
├── server.ts                   # API server entry point (CORS + Express app)
├── main.tsx                    # React app entry point
└── App.tsx                     # React router root
```

## Pipeline Overview

```
Binance API → indicators → market-structure → support-resistance
    → volume-analysis → analysis → validation → confidence
    → pipeline decisions → writer → PipelineResult
```

The single public entry point is `analyzeMarket()` in
`src/modules/pipeline/index.ts`. It runs all stages sequentially and returns
a `PipelineResult` containing every intermediate and final output.

See [docs/Pipeline.md](docs/Pipeline.md) for a stage-by-stage breakdown with
exact file paths, inputs, and outputs.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions and
module responsibilities.

## Key Design Rules

- **AI only writes** — it never calculates, decides, or invent analysis
- **Every value is traceable** — from raw candle to final text, every number
  has a deterministic source
- **Validation gates confidence** — critical validation issues prevent trade signals
- **Confidence ≠ direction** — the score reflects certainty, not bullishness
- **RSI thresholds must match** — `analysis/config.ts` and `validation/config.ts`
  use the same `rsiBullishMin` / `rsiBearishMax` values; divergence causes critical validation errors
