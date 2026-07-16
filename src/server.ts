import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createApp } from './api/server'
import { analyzeMarket } from './modules/pipeline/index'
import type { PipelineOptions } from './modules/pipeline/types'

// Load .env.local for local development (no-op if the file is absent)
try { process.loadEnvFile('.env.local') } catch { /* ignore */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT      = Number(process.env.PORT ?? 3000)
const IS_PROD   = process.env.NODE_ENV === 'production'
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''

// When GEMINI_API_KEY is set, wrap analyzeMarket to inject AI config.
const analyzeFn = GEMINI_API_KEY
  ? (opts: PipelineOptions) => analyzeMarket({
      ...opts,
      config: { ai: { provider: 'gemini', apiKey: GEMINI_API_KEY }, ...opts.config },
    })
  : analyzeMarket

const server = express()

// CORS — restrict to an explicit origin allowlist.
// In production the frontend is served by this same process (same origin), so no
// CORS header is needed.  In development the Vite dev server runs on a different
// port.  Set CORS_ORIGIN=<origin> to override for non-standard setups.
const rawCorsOrigins = process.env.CORS_ORIGIN ?? (IS_PROD ? '' : 'http://localhost:5173')
const CORS_ORIGINS = new Set(rawCorsOrigins.split(',').map(s => s.trim()).filter(Boolean))

server.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && CORS_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

// API routes
server.use(createApp(analyzeFn) as express.RequestHandler)

// Production static file serving
// The Vite build uses base: '/Sentinel/', so assets are served from that path.
if (IS_PROD) {
  const dist = path.join(__dirname, '..', 'dist')
  server.use('/Sentinel', express.static(dist))
  // SPA fallback: serve index.html for any /Sentinel route not matched by static files.
  // Using server.use instead of server.get with a wildcard avoids Express 5's
  // requirement that wildcard path segments must be named (path-to-regexp v8).
  server.use('/Sentinel', (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
  server.get('/', (_req, res) => res.redirect(301, '/Sentinel/'))
}

server.listen(PORT, () => {
  if (IS_PROD) {
    process.stdout.write(`Sentinel running in production on http://localhost:${PORT}\n`)
    process.stdout.write(`  App: http://localhost:${PORT}/Sentinel/\n`)
    process.stdout.write(`  API: http://localhost:${PORT}/analyze\n`)
  } else {
    process.stdout.write(`Sentinel API listening on http://localhost:${PORT}\n`)
  }
})
