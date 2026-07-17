import { describe, it, expect } from 'vitest'
import { parseArgs, HELP_TEXT, VERSION_TEXT } from '../args'

describe('parseArgs', () => {
  describe('--version / -v', () => {
    it('returns version command for --version flag', () => {
      const result = parseArgs(['--version'])
      expect(result).toEqual({ ok: true, command: 'version' })
    })

    it('returns version command for -v flag', () => {
      const result = parseArgs(['-v'])
      expect(result).toEqual({ ok: true, command: 'version' })
    })

    it('returns version command when --version appears after other args', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--version'])
      expect(result).toEqual({ ok: true, command: 'version' })
    })
  })

  describe('--help / -h', () => {
    it('returns help command for --help flag', () => {
      const result = parseArgs(['--help'])
      expect(result).toEqual({ ok: true, command: 'help' })
    })

    it('returns help command for -h flag', () => {
      const result = parseArgs(['-h'])
      expect(result).toEqual({ ok: true, command: 'help' })
    })
  })

  describe('missing or unknown command', () => {
    it('returns error with showHelp when no command is provided', () => {
      const result = parseArgs([])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.showHelp).toBe(true)
        expect(result.message).toMatch(/no command/i)
      }
    })

    it('returns error with showHelp for unknown command', () => {
      const result = parseArgs(['trade'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.showHelp).toBe(true)
        expect(result.message).toContain('trade')
      }
    })
  })

  describe('analyze command — positional arguments', () => {
    it('returns error with showHelp when SYMBOL is missing', () => {
      const result = parseArgs(['analyze'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.showHelp).toBe(true)
        expect(result.message).toMatch(/symbol/i)
      }
    })

    it('returns error with showHelp when INTERVAL is missing', () => {
      const result = parseArgs(['analyze', 'BTCUSDT'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.showHelp).toBe(true)
        expect(result.message).toMatch(/interval/i)
      }
    })

    it('returns error without showHelp for invalid INTERVAL', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '99x'])
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.showHelp).toBe(false)
        expect(result.message).toContain('99x')
      }
    })

    it('uppercases the symbol', () => {
      const result = parseArgs(['analyze', 'btcusdt', '1h'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.symbol).toBe('BTCUSDT')
      }
    })

    it('preserves the interval as-is', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '4h'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.interval).toBe('4h')
      }
    })

    it('returns ok:true for a valid analyze command', () => {
      const result = parseArgs(['analyze', 'ETHUSDT', '1h'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.command).toBe('analyze')
        expect(result.symbol).toBe('ETHUSDT')
        expect(result.interval).toBe('1h')
      }
    })
  })

  describe('--candles flag', () => {
    it('parses a valid --candles value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '500'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.candleLimit).toBe(500)
      }
    })

    it('returns error for --candles below 1', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '0'])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/candles/i)
    })

    it('returns error for --candles above 1000', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '1001'])
      expect(result.ok).toBe(false)
    })

    it('returns error for non-integer --candles value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '3.5'])
      expect(result.ok).toBe(false)
    })

    it('returns error when --candles has no value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles'])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/requires a value/i)
    })

    it('accepts boundary value 1', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '1'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.candleLimit).toBe(1)
      }
    })

    it('accepts boundary value 1000', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--candles', '1000'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.candleLimit).toBe(1000)
      }
    })
  })

  describe('--template flag', () => {
    it('parses a valid --template value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--template', 'executive'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.template).toBe('executive')
      }
    })

    it('returns error for an invalid --template value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--template', 'unknown'])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toContain('unknown')
    })

    it('returns error when --template has no value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--template'])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/requires a value/i)
    })

    it('accepts all valid template names', () => {
      const templates = ['full', 'executive', 'summary', 'bullet', 'headline', 'social']
      for (const tmpl of templates) {
        const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--template', tmpl])
        expect(result.ok).toBe(true)
        if (result.ok && result.command === 'analyze') {
          expect(result.flags.template).toBe(tmpl)
        }
      }
    })
  })

  describe('boolean flags', () => {
    it('parses --json flag', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--json'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.json).toBe(true)
      }
    })

    it('parses --pretty flag', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--pretty'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.pretty).toBe(true)
      }
    })

    it('parses --no-color flag', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--no-color'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.noColor).toBe(true)
      }
    })

    it('defaults all flags to false when not supplied', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.json).toBe(false)
        expect(result.flags.pretty).toBe(false)
        expect(result.flags.noColor).toBe(false)
        expect(result.flags.outputFile).toBeUndefined()
        expect(result.flags.template).toBeUndefined()
        expect(result.flags.candleLimit).toBeUndefined()
      }
    })
  })

  describe('--output flag', () => {
    it('parses --output value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--output', 'report.txt'])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.outputFile).toBe('report.txt')
      }
    })

    it('returns error when --output has no value', () => {
      const result = parseArgs(['analyze', 'BTCUSDT', '1h', '--output'])
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.message).toMatch(/requires a value/i)
    })
  })

  describe('combined flags', () => {
    it('parses multiple flags together', () => {
      const result = parseArgs([
        'analyze', 'BTCUSDT', '1h',
        '--json', '--candles', '300', '--template', 'summary',
      ])
      expect(result.ok).toBe(true)
      if (result.ok && result.command === 'analyze') {
        expect(result.flags.json).toBe(true)
        expect(result.flags.candleLimit).toBe(300)
        expect(result.flags.template).toBe('summary')
      }
    })
  })
})

describe('HELP_TEXT', () => {
  it('contains the analyze command description', () => {
    expect(HELP_TEXT).toContain('analyze')
  })

  it('contains all template names', () => {
    expect(HELP_TEXT).toContain('full')
    expect(HELP_TEXT).toContain('executive')
    expect(HELP_TEXT).toContain('summary')
  })

  it('documents the --candles option', () => {
    expect(HELP_TEXT).toContain('--candles')
  })
})

describe('VERSION_TEXT', () => {
  it('contains the word sentinel', () => {
    expect(VERSION_TEXT).toContain('sentinel')
  })

  it('contains a version number', () => {
    expect(VERSION_TEXT).toMatch(/\d+\.\d+\.\d+/)
  })
})
