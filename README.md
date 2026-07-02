# Sentinel

Crypto market analysis engine and dashboard.

## Local Development

```bash
# Install dependencies
npm install

# Start the API server (port 3000)
npm run start:api

# Start the frontend (port 5173)
npm run dev
```

Open `http://localhost:5173` in your browser.

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md) for full setup instructions,
environment variables, and port configuration.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run start:api` | Start API server on port 3000 |
| `npm run build` | Production build |
| `npm test` | Run all tests + typecheck |
| `npm run typecheck` | TypeScript check only |

## Architecture

- `src/modules/` — Analysis engine (Modules 1–11)
- `src/api/` — Express REST API (Module 12)
- `src/cli/` — CLI tool (Module 13)
- `src/ui/` — React dashboard (Module 14)
- `src/server.ts` — API server entry point
