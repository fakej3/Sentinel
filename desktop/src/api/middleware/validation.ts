import type { Request, Response, NextFunction } from 'express'
import { VALID_TIMEFRAMES, MAX_CANDLE_LIMIT } from '../config'

export function validateAnalyzeInput(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as Record<string, unknown>

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({
      error: { code: 'invalid_request', message: 'Request body must be a JSON object' },
    })
    return
  }

  const sym = typeof body.symbol === 'string' ? body.symbol.trim() : ''
  if (!sym || sym.length > 20) {
    res.status(400).json({
      error: { code: 'invalid_request', message: 'symbol is required and must be a non-empty string (max 20 characters)' },
    })
    return
  }

  if (!body.interval || !VALID_TIMEFRAMES.has(String(body.interval))) {
    res.status(400).json({
      error: {
        code: 'invalid_request',
        message: `interval must be one of: ${[...VALID_TIMEFRAMES].sort().join(', ')}`,
      },
    })
    return
  }

  if (body.candleLimit !== undefined) {
    const limit = Number(body.candleLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CANDLE_LIMIT) {
      res.status(400).json({
        error: {
          code: 'invalid_request',
          message: `candleLimit must be an integer between 1 and ${MAX_CANDLE_LIMIT}`,
        },
      })
      return
    }
  }

  if (
    body.config !== undefined &&
    (typeof body.config !== 'object' || Array.isArray(body.config) || body.config === null)
  ) {
    res.status(400).json({
      error: { code: 'invalid_request', message: 'config must be an object' },
    })
    return
  }

  if (body.config !== undefined) {
    const cfg = body.config as Record<string, unknown>
    if (cfg.minCandleCount !== undefined) {
      const mc = Number(cfg.minCandleCount)
      if (!Number.isInteger(mc) || mc < 1) {
        res.status(400).json({
          error: { code: 'invalid_request', message: 'config.minCandleCount must be a positive integer' },
        })
        return
      }
    }
  }

  next()
}
