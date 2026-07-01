import type { Request, Response, NextFunction } from 'express'
import { PipelineError } from '../../modules/pipeline/index'
import type { PipelineErrorCode } from '../../modules/pipeline/types'

function pipelineErrorStatus(code: PipelineErrorCode): number {
  switch (code) {
    case 'configuration_error':
      return 400
    case 'fetch_failure':
      return 404
    case 'insufficient_candles':
      return 422
    case 'validation_failure':
      return 422
    case 'internal_module_failure':
      return 500
  }
}

interface BodyParserError extends SyntaxError {
  status: number
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof SyntaxError && 'status' in (err as object) && (err as BodyParserError).status === 400
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
        module: err.module,
      },
    })
    return
  }

  if (isBodyParserError(err)) {
    res.status(400).json({
      error: {
        code: 'invalid_json',
        message: 'Malformed JSON in request body',
      },
    })
    return
  }

  const message = err instanceof Error ? err.message : 'An unexpected error occurred'
  res.status(500).json({
    error: {
      code: 'internal_error',
      message,
    },
  })
}
