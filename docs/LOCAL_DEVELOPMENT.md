# Local Development

This project has two independent processes that need to run at the same time
during development:

| Process | Command | Port | Purpose |
|---|---|---|---|
| API server | `npm run start:api` | 3000 | Analysis engine + REST API |
| Frontend | `npm run dev` | 5173 | React dev server (Vite) |

---

## Quick Start

```bash
# Terminal 1 — API server
npm run start:api

# Terminal 2 — frontend dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Environment Variables

Copy `.env.example` to `.env.local` and adjust as needed.
`.env.local` is gitignored and never committed.

```bash
cp .env.example .env.local
```

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000` | Base URL of the API server. Used by the frontend at runtime. |

The Vite dev server also has a built-in proxy at `/api` that forwards requests
to `http://localhost:3000`. If `VITE_API_URL` is not set in `.env.local`, the
frontend defaults to `http://localhost:3000` and communicates with the API
directly (CORS headers are added by `src/server.ts`).

---

## Ports

- **3000** — Sentinel API (`npm run start:api`)
- **5173** — Vite dev server (`npm run dev`)

If port 3000 is taken, override it with the `PORT` environment variable:

```bash
PORT=3001 npm run start:api
```

Then update `.env.local` to match:

```
VITE_API_URL=http://localhost:3001
```

---

## API Endpoints

All endpoints are served relative to the API base URL:

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ status: "ok", version: "..." }` |
| `GET` | `/version` | Current engine version |
| `POST` | `/analyze` | Run market analysis |

### POST /analyze

```json
{
  "symbol": "BTCUSDT",
  "interval": "1h",
  "candleLimit": 200
}
```

Response: `PipelineResult` (see `src/modules/pipeline/types.ts`)

---

## API Status Indicator

The frontend shows a small dot in the top-right corner:

- **Green / API Connected** — `/health` returned 200
- **Red / Offline** — `/health` failed or timed out
- **Pulsing / Checking…** — initial check in progress

The indicator polls every 30 seconds automatically.

---

## Running Tests

```bash
npm test          # run all tests + typecheck
npm run test:watch  # interactive mode
```

The test suite covers the API server (integration), the UI API client
(unit, with mocked fetch), and all analysis engine modules.

---

## Project Structure

```
src/
  api/         # Express API server (Module 12) — do not modify
  cli/         # CLI tool (Module 13) — do not modify
  modules/     # Analysis engine (Modules 1–11) — do not modify
  ui/          # React frontend (Module 14+)
    api.ts           # Centralized API client
    hooks/           # React hooks (useAnalyze, useApiStatus, useLocalStorage)
    components/      # UI components
    utils/           # Formatting and color helpers
    types.ts         # Re-exported engine types + UI-specific types
  server.ts    # API server entry point (starts on port 3000)
  main.tsx     # React app entry point
```
