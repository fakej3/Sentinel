# Local Development

Sentinel has three modes: **desktop** (Tauri), **web server** (Express + React), and **CLI**.
This document covers all three.

---

## Prerequisites

- **Node.js 20+** and npm
- **Rust toolchain** (for desktop builds only) — install via [rustup.rs](https://rustup.rs)
- **Linux desktop deps** (for desktop builds on Linux):
  ```bash
  sudo apt-get install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libgtk-3-dev libssl-dev
  ```

---

## Desktop App (Tauri)

The desktop app runs the full analysis pipeline in the webview renderer — no API server needed.

```bash
npm install
npm run tauri:dev        # launch with hot reload
npm run tauri:build      # build installer (.deb / .rpm on Linux)
```

The `tauri:dev` command starts a Vite dev server and wraps it with Tauri.
Changes to `src/` hot-reload automatically; changes to `src-tauri/` require a full restart.

### Gemini AI Key (desktop)

Open the app → Settings → Gemini AI Key. Enter your key and click Save.
The key is stored in browser localStorage inside the Tauri webview.
It is never sent anywhere except directly to the Gemini API.

---

## Web Server Mode

Two processes must run simultaneously during development:

| Process | Command | Port | Purpose |
|---------|---------|------|---------|
| API server | `npm run dev:api` | 3000 | Analysis engine + REST API |
| Frontend | `npm run dev:frontend` | 5173 | React UI (Vite dev server) |

The single convenience command starts both:

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment Variables

Copy `.env.example` to `.env.local` and adjust as needed.

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3000` | API server base URL used by the frontend |
| `PORT` | `3000` | Port the API server listens on |

To run the API on a different port:

```bash
PORT=3001 npm run dev:api
# Then set VITE_API_URL=http://localhost:3001 in .env.local
```

### Production Server

```bash
npm run build          # build the frontend into dist/
npm run start:api      # start the API server (port 3000)
```

The production API server (`npm run start:api` or `npm start`) does not serve the
frontend. Host the `dist/` folder separately (Nginx, GitHub Pages, etc.) and point
`VITE_API_URL` at the API server.

### Gemini AI Key (server mode)

Set `GEMINI_API_KEY` in `.env.local`. The server reads it at startup and uses it for
AI-enhanced analysis. If unset, the deterministic writer runs without AI commentary.

---

## CLI

```bash
npm install
npx tsx src/cli/index.ts analyze BTCUSDT 1h
npx tsx src/cli/index.ts analyze ETHUSDT 4h --template json
npx tsx src/cli/index.ts analyze SOLUSDT 15m --output report.txt
```

---

## API Endpoints

All endpoints are served on `http://localhost:3000` (web server mode):

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Returns `{ status: "ok", version: "..." }` |
| `GET` | `/version` | Current engine version |
| `POST` | `/analyze` | Run market analysis |

```json
POST /analyze
{
  "symbol": "BTCUSDT",
  "interval": "1h",
  "candleLimit": 200
}
```

Response: `PipelineResult` — see `src/modules/pipeline/types.ts`.

---

## Running Tests

```bash
npm test              # all tests + typecheck
npm run test:watch    # interactive watch mode
npm run typecheck     # TypeScript type-check only
```

The test suite covers all 10 analysis engine modules, the REST API, and the UI transport layer.

---

## API Status Indicator

The web frontend shows a small dot in the top-right corner:

- Green — API `/health` returned 200
- Red — API unreachable or timed out
- Pulsing — initial check in progress

In desktop mode, this is replaced by "Engine running locally" (always green).
