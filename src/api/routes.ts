import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { PIPELINE_VERSION } from './config'
import { validateAnalyzeInput } from './middleware/validation'
import type { AnalyzeFn, AnalyzeRequest } from './types'
import type { Timeframe } from '../modules/binance/types'
import type { PipelineConfig } from '../modules/pipeline/types'

export function createRouter(analyzeFn: AnalyzeFn): Router {
  const router = Router()

  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: PIPELINE_VERSION })
  })

  router.get('/version', (_req: Request, res: Response) => {
    res.json({ version: PIPELINE_VERSION })
  })

  router.post(
    '/analyze',
    validateAnalyzeInput,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { symbol, interval, candleLimit, config } = req.body as AnalyzeRequest
        const result = await analyzeFn({
          symbol: symbol.trim().toUpperCase(),
          interval: interval as Timeframe,
          candleLimit: candleLimit !== undefined ? Number(candleLimit) : undefined,
          config: config as Partial<PipelineConfig>,
        })
        res.json(result)
      } catch (err) {
        next(err)
      }
    },
  )

  return router
}
