import express from 'express'
import { createApp } from './api/server'
import { analyzeMarket } from './modules/pipeline/index'
import type { PipelineOptions } from './modules/pipeline/types'

// Load .env.local for local development (no-op if the file is absent)
try { process.loadEnvFile('.env.local') } catch { /* ignore */ }

const PORT = Number(process.env.PORT ?? 3000)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? ''

// When GEMINI_API_KEY is set, wrap analyzeMarket to inject AI config.
// The request body's config.ai can still override this at the route level.
const analyzeFn = GEMINI_API_KEY
  ? (opts: PipelineOptions) => analyzeMarket({
      ...opts,
      config: { ai: { provider: 'gemini', apiKey: GEMINI_API_KEY }, ...opts.config },
    })
  : analyzeMarket

// Wrap the API app to add CORS headers before routes are evaluated.
// This enables the Vite dev server (port 5173) to reach the API directly.
const server = express()

server.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (_req.method === 'OPTIONS') {
    res.sendStatus(200)
    return
  }
  next()
})

server.use(createApp(analyzeFn) as express.RequestHandler)

server.listen(PORT, () => {
  process.stdout.write(`Sentinel API listening on http://localhost:${PORT}\n`)
})
