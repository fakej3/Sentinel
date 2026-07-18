# Sentinel

**Crypto analysis. On your machine.**

Sentinel runs a deterministic 11-stage pipeline — from raw Binance candles to a trade plan — entirely on your device. No subscription, no cloud, no data leaving your machine.

[![Release](https://img.shields.io/github/v/release/fakej3/Sentinel?include_prereleases&label=release&color=blue)](https://github.com/fakej3/Sentinel/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/fakej3/Sentinel/release.yml?label=release%20build)](https://github.com/fakej3/Sentinel/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![Website](https://img.shields.io/badge/website-fakej3.github.io%2FSentinel-2f7bff)](https://fakej3.github.io/Sentinel/)

**[→ Download Desktop App](https://github.com/fakej3/Sentinel/releases/latest)** &nbsp;·&nbsp; **[→ Try Online](https://fakej3.github.io/Sentinel/)** &nbsp;·&nbsp; **[→ Website](https://fakej3.github.io/Sentinel/)** &nbsp;·&nbsp; **[→ Docs](desktop/docs/)**

---

## Download

| Platform | Formats |
|----------|---------|
| **Windows** | [`.msi` installer · `.exe` setup](https://github.com/fakej3/Sentinel/releases/latest) |
| **macOS** | [`.dmg` universal (Apple Silicon + Intel)](https://github.com/fakej3/Sentinel/releases/latest) |
| **Linux** | [`.deb` · `.rpm` · `.AppImage`](https://github.com/fakej3/Sentinel/releases/latest) |

> **Don't want to install?** Use the web version at **[fakej3.github.io/Sentinel](https://fakej3.github.io/Sentinel/)** — same pipeline, runs in your browser.

---

## Website

**[fakej3.github.io/Sentinel](https://fakej3.github.io/Sentinel/)** — full feature tour, pipeline walkthrough, download links, and roadmap.

[![Sentinel website](docs/screenshots/website.png)](https://fakej3.github.io/Sentinel/)

| | Web version | Desktop app |
|--|-------------|-------------|
| **Analysis engine** | Full 11-stage pipeline | Full 11-stage pipeline |
| **Binance data** | Live fetch | Live fetch |
| **Local history** | Browser storage | AppData (persistent) |
| **Gemini AI narration** | — | Optional |
| **Offline** | Requires browser | After first fetch |
| **Install** | None | One-time |

---

## Features

- **11-stage pipeline** — candle fetch → indicators → market structure → support/resistance → volume analysis → trend synthesis → evidence builder → validation → confidence scoring → trade plan → writer
- **10+ technical indicators** — EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI — computed from first principles
- **Evidence-weighted confidence score** — 0–10 with letter grade A–F; cross-module contradiction detection
- **Structured trade plans** — entry zone, stop loss, three targets, risk/reward ratio, maturity score
- **Market structure detection** — HH/HL/LH/LL, Break of Structure, Change of Character, pullback identification
- **Volume analysis** — buy/sell pressure ratios, VWAP deviation, OBV divergence, Accumulation/Distribution
- **Support & resistance zones** — pivot-based detection, strength scoring, EMA/VWAP confluence
- **Optional Gemini AI narration** — writes prose after the deterministic pipeline completes; never calculates
- **Local history** — every analysis stored in AppData; no cloud required
- **Fully deterministic** — same candle data → same output, to the decimal, every time
- **1,500+ tests** across 77 test files
- **MIT licensed** — audit every line of analysis logic

---

## Screenshots

**Dashboard**

![Sentinel dashboard](docs/screenshots/dashboard.png)

**Watchlist**

![Sentinel watchlist](docs/screenshots/watchlist.png)

---

## Architecture

```
Binance REST API
      │
      ▼
  Candle Fetch         ← raw OHLCV data
      │
      ▼
  Indicators           ← EMA, RSI, MACD, ATR, ADX, Bollinger, StochRSI, OBV, MFI, CCI
      │
      ▼
  Market Structure     ← HH/HL/LH/LL, BOS, CHoCH, pullbacks
      │
      ▼
  Support & Resistance ← pivot zones, strength scoring, confluence
      │
      ▼
  Volume Analysis      ← buy/sell pressure, VWAP, A/D, OBV divergence
      │
      ▼
  Trend Synthesis      ← full trend label from 9 bull/bear/neutral conditions
      │
      ▼
  Evidence Builder     ← typed evidence items: direction · impact · source
      │
      ▼
  Validation           ← cross-module consistency, data quality gates
      │
      ▼
  Confidence Scoring   ← 0–10 score · letter grade A–F
      │
      ▼
  Trade Plan           ← entry zone · stop · 3 targets · risk/reward
      │
      ▼
  Writer               ← deterministic prose + optional Gemini AI narration
```

The AI layer (Gemini) is **opt-in** and runs **after** all computation is complete. It receives a finished result and writes prose. It never calculates, never decides, and cannot invent a number.

---

## Installation

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Rust | stable ([rustup](https://rustup.rs)) |
| npm | bundled with Node.js |

### Desktop app

```bash
git clone https://github.com/fakej3/Sentinel.git
cd Sentinel/desktop
npm install
npm run tauri:dev
```

### Web mode (no Tauri)

```bash
cd desktop
npm install
npm run dev            # frontend: http://localhost:5173  ·  API: http://localhost:3000
```

### Website (local)

```bash
cd website
npm install
npm run dev            # http://localhost:5174
```

See [`desktop/docs/LOCAL_DEVELOPMENT.md`](desktop/docs/LOCAL_DEVELOPMENT.md) for full setup including optional Gemini configuration.

---

## Development

```
Sentinel/
├── desktop/           ← Primary product — Tauri v2 desktop app  ← START HERE
│   ├── src/           ← TypeScript: analysis engine, UI, API, CLI
│   ├── src-tauri/     ← Rust/Tauri desktop shell
│   └── docs/          ← Technical documentation
│
├── website/           ← Marketing site (React + Vite → GitHub Pages)
│
├── mobile/            ← Placeholder — iOS/Android (not started)
├── backend/           ← Placeholder — cloud sync (not started)
│
└── .github/workflows/
    ├── release.yml    ← Builds installers on version tags
    └── deploy.yml     ← Deploys website to GitHub Pages
```

**Technical docs** in [`desktop/docs/`](desktop/docs/):

| Document | Description |
|----------|-------------|
| [Architecture](desktop/docs/ARCHITECTURE.md) | Pipeline design, module contracts, data flow |
| [Pipeline](desktop/docs/PIPELINE.md) | Stage-by-stage breakdown with inputs and outputs |
| [Engine Rules](desktop/docs/ENGINE_RULES.md) | Every threshold and weight with its documented rule |
| [Roadmap](desktop/docs/ROADMAP.md) | Planned features and delivery timeline |
| [Changelog](desktop/docs/CHANGELOG.md) | Release history |
| [Versioning](desktop/docs/VERSIONING.md) | Release process and tagging convention |
| [Local Development](desktop/docs/LOCAL_DEVELOPMENT.md) | Setup guide |
| [Testing Strategy](desktop/docs/TESTING_STRATEGY.md) | Test structure and quality gates |

---

## Roadmap

| Phase | Status |
|-------|--------|
| Desktop v1 (11-stage pipeline, Binance, local history) | ✅ RC1 |
| Marketing website (GitHub Pages) | ✅ Complete |
| Mobile app (iOS + Android) | 📋 Planned — H2 2026 |
| Backend (cloud sync, webhooks, REST API) | 📋 Planned — 2027 |
| API & integrations (TradingView, Bybit, Coinbase) | 🔮 Future — 2027+ |

See [`desktop/docs/ROADMAP.md`](desktop/docs/ROADMAP.md) for the full roadmap.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for ground rules, branch conventions, and the PR process. The full guide with test conventions, code style, and the PR checklist is at [`desktop/CONTRIBUTING.md`](desktop/CONTRIBUTING.md).

Core rules:
- Every change to analysis logic requires a matching test
- Determinism must be preserved — same input → same output, always
- No AI calls in the analysis path (Gemini is writer-only)
- Every numeric constant must have a documented rule in [`desktop/docs/ENGINE_RULES.md`](desktop/docs/ENGINE_RULES.md)

---

## License

MIT — see [`LICENSE`](LICENSE).

Copyright © 2026 Sentinel Contributors.
