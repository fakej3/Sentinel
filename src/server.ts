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

// CORS — allows the Vite dev server (port 5173) to reach the API
server.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  if (_req.method === 'OPTIONS') { res.sendStatus(200); return }
  next()
})

// API routes
server.use(createApp(analyzeFn) as express.RequestHandler)

// Production static file serving
// The Vite build uses base: '/Sentinel/', so assets are served from that path.
if (IS_PROD) {
  const dist = path.join(__dirname, '..', 'dist')
  server.use('/Sentinel', express.static(dist))
  server.get('/Sentinel/*', (_req, res) => {
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
