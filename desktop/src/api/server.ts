import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { analyzeMarket } from '../modules/pipeline/index'
import { createRouter } from './routes'
import { errorHandler } from './middleware/error-handler'
import type { AnalyzeFn } from './types'

function timingMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const start = Date.now()
  const originalJson = res.json.bind(res) as Response['json']
  res.json = (body: unknown) => {
    res.setHeader('X-Response-Time', `${Date.now() - start}ms`)
    return originalJson(body)
  }
  next()
}

export function createApp(analyzeFn: AnalyzeFn = analyzeMarket): express.Application {
  const app = express()

  app.use(express.json({ limit: '1mb' }))
  app.use(timingMiddleware)
  app.use('/', createRouter(analyzeFn))
  app.use(errorHandler)

  return app
}
