import type { Request, Response, NextFunction } from 'express'
import { PipelineError } from '../../modules/pipeline/index'
import type { PipelineErrorCode } from '../../modules/pipeline/types'

function pipelineErrorStatus(code: PipelineErrorCode): number {
  switch (code) {
    case 'configuration_error':
      return 400
    case 'fetch_failure':
      return 502
    case 'insufficient_candles':
      return 422
    case 'validation_failure':
      return 422
    case 'internal_module_failure':
      return 500
  }
}

interface HttpError extends Error {
  status: number
  type?: string
}

function isHttpError(err: unknown): err is HttpError {
  return err instanceof Error && typeof (err as HttpError).status === 'number'
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof PipelineError) {
    res.status(pipelineErrorStatus(err.code)).json({
      error: {
        code: err.code,
        message: err.reason,
      },
    })
    return
  }

  if (isHttpError(err)) {
    if (err.status === 400 && err instanceof SyntaxError) {
      res.status(400).json({ error: { code: 'invalid_json', message: 'Malformed JSON in request body' } })
      return
    }
    if (err.status === 413) {
      res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } })
      return
    }
  }

  const internalMessage = err instanceof Error ? err.message : String(err)
  console.error('[sentinel] Unhandled error:', internalMessage)
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'An unexpected error occurred.',
    },
  })
}
