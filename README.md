# Sentinel

AI-assisted cryptocurrency market analysis platform.

---

## Projects

| Project | Location | Status |
|---------|----------|--------|
| [Desktop App](#desktop) | `desktop/` | RC1 — active development |
| [Website](#website) | `website/` | Live |
| [Mobile](#mobile) | `mobile/` | Planned |
| [Backend](#backend) | `backend/` | Planned |

---

## Desktop

**`desktop/`** — The primary product. A local-first desktop application powered by Tauri v2 and React 18.

The analysis engine runs entirely in-process inside the Tauri webview renderer. No backend server is required. No data leaves the user's machine.

**Stack:** Tauri v2 · React 18 · TypeScript · Vite · Express (API/web mode) · Tailwind CSS

**Highlights:**
- 11-stage deterministic analysis pipeline: candle fetch → indicators → market structure → support/resistance → volume → trend synthesis → evidence → validation → confidence → trade plan → writer
- 10+ technical indicators (EMA, RSI, MACD, ATR, ADX, Bollinger Bands, StochRSI, OBV, MFI, CCI)
- Evidence-weighted confidence scoring (0–10)
- Optional AI narrative via Gemini (the AI writes, never calculates)
- 9-tab analysis dashboard
- Local history, CLI, REST API for server-mode deployment
- 1521 tests across 77 test files

**Getting started:**
```bash
cd desktop
npm install
npm run dev          # Web mode (frontend + API)
npm run tauri:dev    # Desktop mode (Tauri)
```

See [`desktop/docs/LOCAL_DEVELOPMENT.md`](desktop/docs/LOCAL_DEVELOPMENT.md) for full setup instructions.

---

## Website

**`website/`** — Marketing site for the Sentinel platform. Independent project with its own build and deployment.

**Stack:** React 18 · TypeScript · Vite · Tailwind CSS

**Getting started:**
```bash
cd website
npm install
npm run dev
```

Deploys automatically to GitHub Pages on push to `main` when files under `website/` change.

---

## Mobile

**`mobile/`** — Reserved for the future Sentinel mobile application.

Not yet started. See [`mobile/README.md`](mobile/README.md) for the planned roadmap.

---

## Backend

**`backend/`** — Reserved for future backend services (cloud history sync, webhooks, performance tracker).

Not yet started. See [`backend/README.md`](backend/README.md) for the planned roadmap.

---

## Repository Structure

```
Sentinel/
├── desktop/        ← Desktop application (Tauri v2 + React)
│   ├── src/        ← TypeScript source (pipeline, UI, API, CLI)
│   ├── src-tauri/  ← Rust/Tauri layer
│   ├── docs/       ← Technical documentation
│   └── ...
│
├── website/        ← Marketing website (React + Vite)
│   ├── src/
│   └── ...
│
├── mobile/         ← Placeholder (future mobile app)
│   └── README.md
│
├── backend/        ← Placeholder (future backend services)
│   └── README.md
│
└── README.md       ← This file
```

---

## License

MIT — see [`LICENSE`](LICENSE).
