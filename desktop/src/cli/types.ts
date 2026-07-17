import type { PipelineOptions, PipelineResult } from '../modules/pipeline/types'
import type { WriterTemplate } from '../modules/writer/types'

export type CliAnalyzeFn = (options: PipelineOptions) => Promise<PipelineResult>

export interface IoImpl {
  stdout(text: string): void
  stderr(text: string): void
  writeFile(path: string, content: string): Promise<void>
}

export interface CliFlags {
  json: boolean
  pretty: boolean
  noColor: boolean
  outputFile?: string
  template?: WriterTemplate
  candleLimit?: number
}

export type ParseResult =
  | { ok: true; command: 'help' }
  | { ok: true; command: 'version' }
  | { ok: true; command: 'analyze'; symbol: string; interval: string; flags: CliFlags }
  | { ok: false; message: string; showHelp: boolean }
