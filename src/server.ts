import express from 'express'
import { createApp } from './api/server'

const PORT = Number(process.env.PORT ?? 3000)

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

server.use(createApp() as express.RequestHandler)

server.listen(PORT, () => {
  process.stdout.write(`Sentinel API listening on http://localhost:${PORT}\n`)
})
