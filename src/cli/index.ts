import { writeFile } from 'fs/promises'
import { analyzeMarket, PipelineError } from '../modules/pipeline/index'
import type { Timeframe } from '../modules/market/types'
import { parseArgs, HELP_TEXT, VERSION_TEXT } from './args'
import { formatOutput, formatFileContent } from './format'
import type { CliAnalyzeFn, IoImpl } from './types'

const defaultIo: IoImpl = {
  stdout: (text: string) => { process.stdout.write(text + '\n') },
  stderr: (text: string) => { process.stderr.write(text + '\n') },
  writeFile: (path: string, content: string) => writeFile(path, content, 'utf8'),
}

function pipelineErrorMessage(err: PipelineError): string {
  switch (err.code) {
    case 'configuration_error':
      return `Configuration error: ${err.reason}`
    case 'fetch_failure':
      return `Could not fetch data: ${err.reason}`
    case 'insufficient_candles':
      return `Insufficient data: ${err.reason}`
    case 'internal_module_failure':
      return `Internal error in module '${err.module}': ${err.reason}`
    case 'validation_failure':
      return `Validation failed: ${err.reason}`
  }
}

export function createCli(
  analyzeFn: CliAnalyzeFn = analyzeMarket,
  io: IoImpl = defaultIo,
): (argv: string[]) => Promise<number> {
  return async (argv: string[]): Promise<number> => {
    const parsed = parseArgs(argv)

    if (!parsed.ok) {
      io.stderr(`Error: ${parsed.message}`)
      if (parsed.showHelp) io.stderr('\n' + HELP_TEXT)
      return 2
    }

    if (parsed.command === 'version') {
      io.stdout(VERSION_TEXT)
      return 0
    }

    if (parsed.command === 'help') {
      io.stdout(HELP_TEXT)
      return 0
    }

    const { symbol, interval, flags } = parsed

    try {
      const result = await analyzeFn({
        symbol,
        interval: interval as Timeframe,
        candleLimit: flags.candleLimit,
        config: flags.template ? { writer: { template: flags.template } } : undefined,
      })

      if (flags.outputFile) {
        const fileContent = formatFileContent(result, flags.json)
        await io.writeFile(flags.outputFile, fileContent)
      } else {
        io.stdout(formatOutput(result, flags))
      }

      return 0
    } catch (err) {
      if (err instanceof PipelineError) {
        io.stderr(pipelineErrorMessage(err))
      } else {
        io.stderr(`Error: ${err instanceof Error ? err.message : String(err)}`)
      }
      return 1
    }
  }
}
