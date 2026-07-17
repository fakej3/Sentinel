# Sentinel

**Local-first cryptocurrency analysis desktop app.**

Sentinel runs an 11-stage deterministic analysis pipeline — from raw candle data to a trade plan — entirely on your machine. No subscription. No cloud. No data leaves your device.

[![Release](https://img.shields.io/github/v/release/fakej3/Sentinel?include_prereleases&label=release&color=blue)](https://github.com/fakej3/Sentinel/releases)
[![Build](https://img.shields.io/github/actions/workflow/status/fakej3/Sentinel/release.yml?label=release%20build)](https://github.com/fakej3/Sentinel/actions/workflows/release.yml)
[![License](https://img.shields.io/badge/license-MIT-22c55e)](LICENSE)
[![Website](https://img.shields.io/badge/website-fakej3.github.io%2FSentinel-2f7bff)](https://fakej3.github.io/Sentinel/)

---

## Overview

| | |
|---|---|
| **Version** | 1.0.0-rc.1 |
| **Platforms** | Windows · macOS · Linux |
| **Framework** | Tauri v2 + React 18 + TypeScript |
| **Pipeline** | 11 stages, fully deterministic |
| **AI layer** | Optional — Gemini writes prose; never calculates |
| **Privacy** | Zero telemetry · no backend · local storage only |
| **License** | MIT |

> **Website →** [fakej3.github.io/Sentinel](https://fakej3.github.io/Sentinel/)

---

## Screenshot

> _Screenshots will be added once the RC1 installer is published._
>
> The app has nine analysis tabs: Summary · Trade Plan · Evidence · Indicators · Structure · Volume · Validation · Writer · Overview.

---

## Features

- **11-stage pipeline** — candle fetch → indicators → market structure → support/resistance → volume analysis → trend synthesis → evidence builder → validation → confidence scoring → trade plan → writer
- **10+ technical indicators** — EMA 9/21/50/200, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI
- **Evidence-weighted confidence score** — 0–10 with letter grade A–F; cross-module contradiction detection
- **Structured trade plans** — entry zone, stop loss, three targets, risk/reward ratio
- **Market structure** — HH/HL/LH/LL, Break of Structure, Change of Character, pullback detection
- **Volume analysis** — buy/sell pressure, VWAP deviation, OBV divergence, Accumulation/Distribution
- **Optional Gemini AI narration** — receives the finished result and writes prose; never drives analysis
- **Local history** — every analysis stored in AppData; no cloud required
- **Offline-first** — only Binance (candles) and Google (Gemini, if enabled) are called externally
- **Fully deterministic** — same candle data → same output, to the decimal, every time
- **1,521 tests** across 77 test files

---

## Downloads

Installers are published automatically to [**GitHub Releases**](https://github.com/fakej3/Sentinel/releases) when a version tag is pushed.

| Platform | Formats |
|----------|---------|
| **Windows** | `.msi` installer, `.exe` setup |
| **macOS** | `.dmg` universal (Apple Silicon + Intel) |
| **Linux** | `.deb` (Debian/Ubuntu), `.rpm` (Fedora/RHEL), `.AppImage` (universal) |

**[→ Download latest release](https://github.com/fakej3/Sentinel/releases/latest)**

> Installers for RC1 will appear on the Releases page once the first tag is pushed. Until then, build from source using the instructions below.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 20+ |
| Rust | stable (via [rustup](https://rustup.rs)) |
| npm | bundled with Node.js |

### Run the desktop app

```bash
git clone https://github.com/fakej3/Sentinel.git
cd Sentinel/desktop
npm install
npm run tauri:dev      # desktop (Tauri window)
```

### Run in web mode (no Tauri)

```bash
cd desktop
npm install
npm run dev            # frontend: http://localhost:5173 · API: http://localhost:3000
```

### Run the website locally

```bash
cd website
npm install
npm run dev            # http://localhost:5174
```

See [`desktop/docs/LOCAL_DEVELOPMENT.md`](desktop/docs/LOCAL_DEVELOPMENT.md) for the full setup guide including optional Gemini configuration.

---

## Repository Structure

```
Sentinel/
├── desktop/           ← Primary product — Tauri v2 desktop app  ← START HERE
│   ├── src/           ← TypeScript: analysis engine, UI, API, CLI
│   ├── src-tauri/     ← Rust/Tauri desktop shell
│   ├── docs/          ← Technical documentation (architecture, engine rules, roadmap)
│   └── CONTRIBUTING.md ← Detailed contributor guide
│
├── website/           ← Marketing website (React + Vite → GitHub Pages)
│   └── src/           ← Static landing page — does not contain application logic
│
├── mobile/            ← Placeholder — future iOS/Android app (not started)
│   └── README.md
│
├── backend/           ← Placeholder — future cloud sync service (not started)
│   └── README.md
│
├── .github/
│   └── workflows/
│       ├── release.yml  ← Builds and publishes installers on version tags
│       └── deploy.yml   ← Deploys website to GitHub Pages on push to main
│
├── CONTRIBUTING.md    ← Start here if you want to contribute
└── README.md
```

---

## Documentation

All technical docs live under [`desktop/docs/`](desktop/docs/).

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
| [Contributing](desktop/CONTRIBUTING.md) | How to contribute |

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

The AI layer (Gemini) is **opt-in** and runs **after** all computation is complete. It receives a finished `PipelineResult` and writes prose. It never calculates, never decides, and cannot invent a number.

---

## Roadmap

See [`desktop/docs/ROADMAP.md`](desktop/docs/ROADMAP.md) for the full roadmap.

| Phase | Status |
|-------|--------|
| Desktop v1 (11-stage pipeline, Binance, local history) | ✅ RC1 |
| Marketing website (GitHub Pages) | ✅ Complete |
| Mobile app (iOS + Android) | 📋 Planned — Q4 2026 |
| Backend (cloud sync, webhooks, REST API) | 📋 Planned — 2027 |
| API & integrations (TradingView, Bybit, Coinbase) | 🔮 Future — 2027+ |

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for ground rules, branch conventions, and the PR process.

Core rules:
- Every change to analysis logic requires a matching test
- Determinism must be preserved — same input → same output, always
- No AI calls in the analysis path (Gemini is only in the `writer` module)
- Every numeric constant must have a documented rule in [`desktop/docs/ENGINE_RULES.md`](desktop/docs/ENGINE_RULES.md)

---

## License

MIT — see [`LICENSE`](LICENSE).

Copyright © 2026 Sentinel Contributors.
