# Sentinel

**AI-assisted crypto market analysis platform.**
Produces technically accurate, evidence-backed analysis from live Binance market data.
Available as a desktop app (Tauri), a REST API server, and a CLI tool.

---

## Features

- **11-stage analysis pipeline** — candle data → indicators → market structure → support/resistance → volume → trend synthesis → validation → confidence → trade plan → writer → AI-enhanced report
- **Deterministic engine** — identical inputs always produce identical outputs; every value is traceable to its source candle
- **Confidence scoring** — evidence-weighted 0–10 score with A–E grade and trust level
- **Trade plan generation** — entry zone, stop level, target, risk/reward ratio, and trade maturity score
- **AI writing** — deterministic report in 6 formats; optional Gemini enhancement for narrative polish
- **Desktop app** — Tauri v2; pipeline runs locally in the webview, no backend server required
- **Web dashboard** — 9 analysis tabs (Summary, Trade, Evidence, Indicators, Structure, Volume, Validation, Writer, Overview), TradingView chart, watchlist, history
- **REST API** — Express server wrapping the pipeline; suitable for scripting and integrations
- **CLI** — `analyze BTCUSDT 1h` in your terminal
- **1521 tests** across 77 test files

---

## Screenshots

> Screenshots will be added after the first tagged release.

| Dashboard | Analysis | Chart |
|-----------|----------|-------|
| _(coming soon)_ | _(coming soon)_ | _(coming soon)_ |

---

## Architecture Overview

The pipeline is a sequential chain of pure, deterministic functions. Each stage has one job and produces a typed output that becomes the input for the next stage.

```
Binance REST API
      │
      ▼
binance/          fetchMarketData()       ← raw OHLCV, ticker, funding rate, OI
      │
      ▼
indicators/       computeIndicators()     ← RSI, MACD, EMA×4, ATR, ADX, VWAP, BB…
      │
      ▼
market-structure/ computeMarketStructure() ← swings, HH/HL/LH/LL, BOS, CHoCH
      │
      ▼
support-resistance/ computeSupportResistance() ← ATR-sized zones, interactions, strength
      │
      ▼
volume-analysis/  computeVolumeAnalysis()  ← relative vol, climax, buy/sell pressure
      │
      ▼
analysis/         computeAnalysis()        ← full trend synthesis, evidence collection
      │
      ▼
validation/       validateAnalysis()       ← completeness, consistency, contradiction checks
      │
      ▼
confidence/       computeConfidence()      ← evidence-weighted score (0–10) + grade
      │
      ▼
pipeline/         analyzeMarket()          ← trade decision, trade plan, market context
      │
      ▼
writer/           generateAnalysis()       ← deterministic report (6 formats)
      │
      ▼
ai/               provider.enhance()      ← optional Gemini LLM narrative (falls back safely)
      │
      ▼
PipelineResult   → Desktop UI / Web Dashboard / REST API / CLI
```

The single public entry point is **`analyzeMarket()`** in `src/modules/pipeline/index.ts`.

For a stage-by-stage breakdown with exact file paths and types, see [docs/PIPELINE.md](docs/PIPELINE.md).

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Analysis engine | TypeScript (pure functions, no framework) |
| Desktop app | Tauri v2 + Rust |
| Web frontend | React 18, Vite, Tailwind CSS |
| REST API | Express 5 |
| CLI | tsx (TypeScript runner) |
| Charts | TradingView widget |
| Testing | Vitest |
| Type-checking | TypeScript strict mode |

---

## Folder Structure

```
sentinel/
├── src/
│   ├── modules/                   # Analysis engine
│   │   ├── binance/               # Stage 1: Binance REST API client
│   │   ├── indicators/            # Stage 2: Technical indicators
│   │   ├── market-structure/      # Stage 3: Swing detection, BOS/CHoCH
│   │   ├── support-resistance/    # Stage 4: Price zones
│   │   ├── volume-analysis/       # Stage 5: Volume metrics
│   │   ├── analysis/              # Stage 6: Trend synthesis + evidence
│   │   ├── validation/            # Stage 7: Consistency checks
│   │   ├── confidence/            # Stage 8: Evidence-weighted scoring
│   │   ├── pipeline/              # Stage 9: Orchestrator + decisions
│   │   ├── writer/                # Stage 10: Report generation
│   │   ├── ai/                    # Stage 11: Optional AI enhancement
│   │   ├── historical-validation/ # Walk-forward backtesting engine
│   │   └── benchmark/             # Regression testing against fixtures
│   ├── api/                       # Express REST API
│   ├── cli/                       # CLI tool
│   ├── ui/                        # React dashboard
│   │   ├── components/
│   │   │   ├── layout/            # App shell: Header, Sidebar, BottomNav
│   │   │   ├── shared/            # Badge, Card, ConfidenceMeter, Tabs…
│   │   │   └── tabs/              # Analysis tabs: Summary, Evidence, Trade…
│   │   ├── hooks/                 # useAnalyze, useApiStatus, useLocalStorage…
│   │   ├── pages/                 # Dashboard, Chart, Analysis, Watchlist, History, Settings
│   │   ├── transport/             # TauriTransport, HttpTransport, history stores
│   │   └── utils/                 # colors.ts, format.ts, timeframes.ts…
│   ├── server.ts                  # API server entry point
│   ├── main.tsx                   # React entry point
│   └── App.tsx                    # Root component + page routing
├── src-tauri/                     # Tauri desktop configuration
│   ├── src/                       # Rust source (lib.rs, main.rs)
│   ├── icons/                     # App icons (all sizes)
│   ├── capabilities/              # Tauri v2 permission scopes
│   └── tauri.conf.json            # Bundle config, window settings, CSP
├── test-fixtures/                 # Sample datasets for benchmark engine
├── docs/                          # Documentation
└── .github/workflows/             # CI: build + deploy to GitHub Pages
```

---

## Installation

### Desktop App

Download the latest installer from [Releases](https://github.com/fakej3/Sentinel/releases):

- **Linux:** `Sentinel_x.x.x_amd64.deb` or `Sentinel-x.x.x-1.x86_64.rpm`
- **macOS:** `Sentinel_x.x.x_x64.dmg` _(requires macOS build runner)_
- **Windows:** `Sentinel_x.x.x_x64_en-US.msi` _(requires Windows build runner)_

No API key is required — Sentinel connects to public Binance endpoints without authentication.
An optional [Gemini API key](https://aistudio.google.com/app/apikey) enables AI-enhanced narrative output.

---

## Development Setup

### Prerequisites

- Node.js 20+ and npm
- For desktop builds: Rust via [rustup.rs](https://rustup.rs)
- For desktop builds on Linux:

```bash
sudo apt-get install libgtk-3-dev libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev librsvg2-dev
```

### Clone and install

```bash
git clone https://github.com/fakej3/Sentinel.git
cd sentinel
npm install
```

---

## Build Instructions

### Web mode (server + frontend)

```bash
# Development — starts API server on :3000 and Vite on :5173
npm run dev

# Production frontend build
npm run build

# Production API server
npm run start:api
```

### CLI

```bash
npx tsx src/cli/index.ts analyze BTCUSDT 1h
npx tsx src/cli/index.ts --help
```

---

## Desktop Build Instructions (Tauri)

```bash
# Development — hot reload, wraps Vite dev server
npm run tauri:dev

# Production build — outputs installer in src-tauri/target/release/bundle/
npm run tauri:build
```

**Linux output:** `src-tauri/target/release/bundle/deb/Sentinel_x.x.x_amd64.deb`

**Requirements for cross-platform builds:**
- macOS `.dmg` requires a macOS runner
- Windows `.msi` requires a Windows runner
- AppImage requires outbound access to download `AppRun` from GitHub

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for the full setup guide.

---

## Testing

```bash
npm test              # all 1521 tests + TypeScript type-check
npm run test:watch    # interactive watch mode
npm run typecheck     # type-check only (no tests)
```

Tests cover every analysis engine module, the REST API, the CLI, the UI transport layer, and the benchmark engine. See [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) for the full strategy.

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | API server base URL (web mode) |
| `PORT` | `3000` | API server port |
| `GEMINI_API_KEY` | _(none)_ | Optional — enables AI narrative enhancement (server mode) |
| `CORS_ORIGIN` | `http://localhost:5173` (dev) | Comma-separated list of allowed CORS origins; empty disables CORS |
| `SENTINEL_DEBUG` | _(none)_ | Set to `true` to enable debug endpoints (`/api/debug-confidence`, `/api/debug-pipeline`) |

In **desktop mode**, the Gemini key is set in the UI (Settings → Gemini AI Key) and stored locally.

---

## Project Philosophy

**The AI only writes. It never calculates, decides, or invents.**

Every number in a Sentinel analysis has a deterministic source:

- Indicators come from published formulas applied to raw candles
- Evidence comes from rule-defined conditions documented in `docs/ENGINE_RULES.md`
- Confidence comes from those evidence items, weighted by documented factors
- Trade decisions come from confidence thresholds and validation results
- The AI writer gets a fully computed `PipelineResult` and formats it into prose

Nothing in the analysis is estimated, inferred by a model, or hallucinated.
If a value cannot be computed from available data, the pipeline either produces a safe null or fails with a typed error code.

---

## Current Status

**RC1 — Release Candidate 1**

| Component | Status |
|-----------|--------|
| Analysis engine | ✅ Production-ready |
| REST API | ✅ Production-ready |
| CLI | ✅ Production-ready |
| Web dashboard | ✅ Production-ready |
| Desktop app (Linux) | ✅ RC1 — `.deb` and `.rpm` produced |
| Desktop app (macOS/Windows) | ⚠️ Requires platform-specific build runner |
| Historical validation engine | ✅ Production-ready |

---

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for the full roadmap.

Near-term priorities:
- Performance tracker (evaluate past signals at 24h/3d/7d)
- Multi-coin comparison view
- macOS and Windows installers via CI
- TradingView indicator parity verification

---

## Known Limitations

See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) for the complete list.

Key limitations:

- VWAP is cumulative, not session-based — values differ from TradingView on longer timeframes
- Indicator values have not been empirically verified against TradingView reference outputs
- The Escape key cancels the UI state but the underlying Binance fetch runs to its 10s internal timeout (desktop)
- Icons require visual verification on each target platform before a final release

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

In brief:
1. Every change to `src/modules/` must have a matching test
2. New thresholds or constants must be documented in `docs/ENGINE_RULES.md`
3. Architecture decisions must be recorded in `docs/DECISIONS.md`
4. `npm test` must pass before a PR is submitted

---

## License

MIT — see [LICENSE](LICENSE).
