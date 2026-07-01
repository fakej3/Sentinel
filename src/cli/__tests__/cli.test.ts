import { describe, it, expect, vi } from 'vitest'
import { createCli } from '../index'
import { PipelineError } from '../../modules/pipeline/index'
import type { PipelineResult } from '../../modules/pipeline/types'
import type { IoImpl } from '../types'

function makeMockResult(report = '## Analysis\nBullish outlook.'): PipelineResult {
  return {
    candles: [],
    indicators: {} as PipelineResult['indicators'],
    marketStructure: {} as PipelineResult['marketStructure'],
    supportResistance: {} as PipelineResult['supportResistance'],
    volumeAnalysis: {} as PipelineResult['volumeAnalysis'],
    analysis: {} as PipelineResult['analysis'],
    validation: {} as PipelineResult['validation'],
    confidence: {} as PipelineResult['confidence'],
    generatedAnalysis: {
      sections: {},
      fullReport: report,
      template: 'full',
      generatedAt: Date.now(),
    } as unknown as PipelineResult['generatedAnalysis'],
    metadata: {} as PipelineResult['metadata'],
  }
}

function makeIo(): { io: IoImpl; stdout: string[]; stderr: string[]; files: Record<string, string> } {
  const stdout: string[] = []
  const stderr: string[] = []
  const files: Record<string, string> = {}
  const io: IoImpl = {
    stdout: (t) => { stdout.push(t) },
    stderr: (t) => { stderr.push(t) },
    writeFile: async (path, content) => { files[path] = content },
  }
  return { io, stdout, stderr, files }
}

describe('createCli', () => {
  describe('help and version', () => {
    it('prints help text and returns 0 for --help', async () => {
      const { io, stdout } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['--help'])
      expect(code).toBe(0)
      expect(stdout.join('')).toContain('analyze')
    })

    it('prints help text and returns 0 for -h', async () => {
      const { io, stdout } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['-h'])
      expect(code).toBe(0)
      expect(stdout.join('')).toContain('sentinel')
    })

    it('prints version text and returns 0 for --version', async () => {
      const { io, stdout } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['--version'])
      expect(code).toBe(0)
      expect(stdout.join('')).toMatch(/sentinel v\d+\.\d+\.\d+/)
    })

    it('prints version text and returns 0 for -v', async () => {
      const { io, stdout } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['-v'])
      expect(code).toBe(0)
      expect(stdout.join('')).toMatch(/\d+\.\d+\.\d+/)
    })
  })

  describe('invalid arguments', () => {
    it('returns exit code 2 for unknown command', async () => {
      const { io } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['trade'])
      expect(code).toBe(2)
    })

    it('writes error to stderr for unknown command', async () => {
      const { io, stderr } = makeIo()
      const cli = createCli(vi.fn(), io)
      await cli(['trade'])
      expect(stderr.join('')).toContain('Error:')
    })

    it('returns exit code 2 for missing SYMBOL', async () => {
      const { io } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['analyze'])
      expect(code).toBe(2)
    })

    it('returns exit code 2 for invalid INTERVAL', async () => {
      const { io } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['analyze', 'BTCUSDT', 'bad'])
      expect(code).toBe(2)
    })

    it('returns exit code 2 for invalid --candles value', async () => {
      const { io } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['analyze', 'BTCUSDT', '1h', '--candles', '0'])
      expect(code).toBe(2)
    })

    it('returns exit code 2 for invalid --template value', async () => {
      const { io } = makeIo()
      const cli = createCli(vi.fn(), io)
      const code = await cli(['analyze', 'BTCUSDT', '1h', '--template', 'badtemplate'])
      expect(code).toBe(2)
    })

    it('includes help text in stderr when showHelp is true', async () => {
      const { io, stderr } = makeIo()
      const cli = createCli(vi.fn(), io)
      await cli(['analyze'])
      expect(stderr.join('')).toContain('sentinel')
    })
  })

  describe('successful analyze', () => {
    it('calls analyzeFn with correct symbol and interval', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h'])
      expect(mockFn).toHaveBeenCalledOnce()
      const opts = mockFn.mock.calls[0][0]
      expect(opts.symbol).toBe('BTCUSDT')
      expect(opts.interval).toBe('1h')
    })

    it('lowercased symbol is uppercased before passing to analyzeFn', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'ethusdt', '4h'])
      const opts = mockFn.mock.calls[0][0]
      expect(opts.symbol).toBe('ETHUSDT')
    })

    it('passes candleLimit to analyzeFn when --candles is supplied', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--candles', '300'])
      const opts = mockFn.mock.calls[0][0]
      expect(opts.candleLimit).toBe(300)
    })

    it('passes template in config when --template is supplied', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--template', 'executive'])
      const opts = mockFn.mock.calls[0][0]
      expect(opts.config?.writer?.template).toBe('executive')
    })

    it('returns exit code 0 on success', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      const code = await cli(['analyze', 'BTCUSDT', '1h'])
      expect(code).toBe(0)
    })

    it('writes fullReport to stdout by default', async () => {
      const report = '## Analysis\nBullish.'
      const mockFn = vi.fn().mockResolvedValue(makeMockResult(report))
      const { io, stdout } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h'])
      expect(stdout.join('')).toContain('Bullish.')
    })
  })

  describe('--json mode', () => {
    it('outputs JSON when --json flag is set', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io, stdout } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--json'])
      const output = stdout.join('')
      expect(() => JSON.parse(output)).not.toThrow()
    })

    it('JSON output contains generatedAnalysis', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io, stdout } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--json'])
      const parsed = JSON.parse(stdout.join(''))
      expect(parsed).toHaveProperty('generatedAnalysis')
    })
  })

  describe('--pretty mode', () => {
    it('outputs ANSI codes when --pretty is set and --no-color is not', async () => {
      const report = '## Analysis\nContent.'
      const mockFn = vi.fn().mockResolvedValue(makeMockResult(report))
      const { io, stdout } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--pretty'])
      expect(stdout.join('')).toContain('\x1b[')
    })

    it('does not colorize when --no-color is set alongside --pretty', async () => {
      const report = '## Analysis\nContent.'
      const mockFn = vi.fn().mockResolvedValue(makeMockResult(report))
      const { io, stdout } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--pretty', '--no-color'])
      expect(stdout.join('')).not.toContain('\x1b[')
    })
  })

  describe('--output file mode', () => {
    it('writes to the specified file instead of stdout', async () => {
      const report = '## Analysis\nContent.'
      const mockFn = vi.fn().mockResolvedValue(makeMockResult(report))
      const { io, stdout, files } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--output', 'out.txt'])
      expect(stdout).toHaveLength(0)
      expect(files['out.txt']).toContain('Content.')
    })

    it('writes JSON to file when --json and --output are combined', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io, files } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h', '--json', '--output', 'out.json'])
      expect(() => JSON.parse(files['out.json'])).not.toThrow()
    })

    it('returns 0 after writing file successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue(makeMockResult())
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      const code = await cli(['analyze', 'BTCUSDT', '1h', '--output', 'out.txt'])
      expect(code).toBe(0)
    })
  })

  describe('pipeline error handling', () => {
    it('returns exit code 1 on PipelineError', async () => {
      const mockFn = vi.fn().mockRejectedValue(
        new PipelineError('fetch_failure', 'binance', 'network timeout'),
      )
      const { io } = makeIo()
      const cli = createCli(mockFn, io)
      const code = await cli(['analyze', 'BTCUSDT', '1h'])
      expect(code).toBe(1)
    })

    it('writes friendly message to stderr for fetch_failure', async () => {
      const mockFn = vi.fn().mockRejectedValue(
        new PipelineError('fetch_failure', 'binance', 'network timeout'),
      )
      const { io, stderr } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h'])
      expect(stderr.join('')).toContain('network timeout')
    })

    it('writes friendly message to stderr for insufficient_candles', async () => {
      const mockFn = vi.fn().mockRejectedValue(
        new PipelineError('insufficient_candles', 'pipeline', 'need at least 50 candles'),
      )
      const { io, stderr } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h'])
      expect(stderr.join('')).toContain('Insufficient data')
    })

    it('writes friendly message to stderr for configuration_error', async () => {
      const mockFn = vi.fn().mockRejectedValue(
        new PipelineError('configuration_error', 'pipeline', 'bad config'),
      )
      const { io, stderr } = makeIo()
      const cli = createCli(mockFn, io)
      await cli(['analyze', 'BTCUSDT', '1h'])
      expect(stderr.join('')).toContain('Configuration error')
    })

    it('writes generic error message for non-PipelineError', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('unexpected crash'))
      const { io, stderr } = makeIo()
      const cli = createCli(mockFn, io)
      const code = await cli(['analyze', 'BTCUSDT', '1h'])
      expect(code).toBe(1)
      expect(stderr.join('')).toContain('unexpected crash')
    })
  })

  describe('determinism', () => {
    it('produces identical output on two calls with the same input', async () => {
      const report = '## Analysis\nDeterministic output.'
      const mockFn = vi.fn().mockResolvedValue(makeMockResult(report))
      const { io: io1, stdout: out1 } = makeIo()
      const { io: io2, stdout: out2 } = makeIo()
      const cli1 = createCli(mockFn, io1)
      const cli2 = createCli(mockFn, io2)
      await cli1(['analyze', 'BTCUSDT', '1h'])
      await cli2(['analyze', 'BTCUSDT', '1h'])
      expect(out1.join('')).toBe(out2.join(''))
    })
  })
})
