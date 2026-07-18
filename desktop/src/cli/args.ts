import type { WriterTemplate } from '../modules/writer/types'
import { VALID_TIMEFRAMES, MAX_CANDLE_LIMIT, VALID_TEMPLATES, APP_VERSION } from './config'
import type { ParseResult } from './types'

export const HELP_TEXT = `
Usage: sentinel <command> [options]

Commands:
  analyze <SYMBOL> <INTERVAL>    Analyze a trading pair

Options:
  --candles <number>             Candle count to fetch (1–${MAX_CANDLE_LIMIT}, default: 200)
  --json                         Output complete PipelineResult as JSON
  --pretty                       Colorized terminal output
  --output <file>                Save output to a file
  --template <name>              Writer template: full|summary|executive|bullet|headline|social
  --no-color                     Disable color output
  --version, -v                  Print version and exit
  --help, -h                     Show this help message

Examples:
  sentinel analyze BTCUSDT 1h
  sentinel analyze ETHUSDT 4h --json
  sentinel analyze SOLUSDT 15m --template executive
  sentinel analyze BTCUSDT 1d --output report.txt
`.trim()

export const VERSION_TEXT = `sentinel v${APP_VERSION}`

const OPTIONS_WITH_VALUES = new Set(['candles', 'output', 'template'])

export function parseArgs(argv: string[]): ParseResult {
  if (argv.includes('--version') || argv.includes('-v')) {
    return { ok: true, command: 'version' }
  }
  if (argv.includes('--help') || argv.includes('-h')) {
    return { ok: true, command: 'help' }
  }

  const [command, ...rest] = argv

  if (!command) {
    return { ok: false, message: 'No command specified.', showHelp: true }
  }

  if (command !== 'analyze') {
    return {
      ok: false,
      message: `Unknown command: "${command}". Available: analyze`,
      showHelp: true,
    }
  }

  const positionals: string[] = []
  const flags = new Map<string, string | boolean>()
  let i = 0

  while (i < rest.length) {
    const arg = rest[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      if (OPTIONS_WITH_VALUES.has(key)) {
        const val = rest[i + 1]
        if (val === undefined || val.startsWith('-')) {
          return {
            ok: false,
            message: `Option --${key} requires a value.`,
            showHelp: false,
          }
        }
        flags.set(key, val)
        i += 2
      } else {
        flags.set(key, true)
        i += 1
      }
    } else {
      positionals.push(arg)
      i += 1
    }
  }

  const [symbol, interval] = positionals

  if (!symbol) {
    return {
      ok: false,
      message: 'Missing required argument: SYMBOL (e.g. BTCUSDT)',
      showHelp: true,
    }
  }

  if (!interval) {
    return {
      ok: false,
      message: 'Missing required argument: INTERVAL (e.g. 1h)',
      showHelp: true,
    }
  }

  if (!VALID_TIMEFRAMES.has(interval)) {
    return {
      ok: false,
      message: `Invalid INTERVAL: "${interval}". Valid values: ${[...VALID_TIMEFRAMES].sort().join(', ')}`,
      showHelp: false,
    }
  }

  let candleLimit: number | undefined
  const candlesRaw = flags.get('candles')
  if (candlesRaw !== undefined && candlesRaw !== true) {
    const n = Number(candlesRaw)
    if (!Number.isInteger(n) || n < 1 || n > MAX_CANDLE_LIMIT) {
      return {
        ok: false,
        message: `Invalid --candles value: "${candlesRaw}". Must be an integer between 1 and ${MAX_CANDLE_LIMIT}.`,
        showHelp: false,
      }
    }
    candleLimit = n
  }

  let template: WriterTemplate | undefined
  const templateRaw = flags.get('template')
  if (typeof templateRaw === 'string') {
    if (!VALID_TEMPLATES.has(templateRaw)) {
      return {
        ok: false,
        message: `Invalid --template: "${templateRaw}". Valid values: ${[...VALID_TEMPLATES].join(', ')}`,
        showHelp: false,
      }
    }
    template = templateRaw as WriterTemplate
  }

  const outputRaw = flags.get('output')

  return {
    ok: true,
    command: 'analyze',
    symbol: symbol.trim().toUpperCase(),
    interval,
    flags: {
      json: flags.has('json'),
      pretty: flags.has('pretty'),
      noColor: flags.has('no-color'),
      outputFile: typeof outputRaw === 'string' ? outputRaw : undefined,
      template,
      candleLimit,
    },
  }
}
