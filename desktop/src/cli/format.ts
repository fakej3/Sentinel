import type { PipelineResult } from '../modules/pipeline/types'
import type { CliFlags } from './types'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const CYAN = '\x1b[36m'

function colorize(text: string): string {
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('## ')) return `${BOLD}${CYAN}${line}${RESET}`
      if (line.startsWith('### ')) return `${BOLD}${line}${RESET}`
      if (line.startsWith('---')) return `${DIM}${line}${RESET}`
      return line
    })
    .join('\n')
}

export function formatOutput(result: PipelineResult, flags: CliFlags): string {
  if (flags.json) {
    return JSON.stringify(result, null, 2)
  }
  const report = result.generatedAnalysis.fullReport
  if (flags.pretty && !flags.noColor) {
    return colorize(report)
  }
  return report
}

export function formatFileContent(result: PipelineResult, json: boolean): string {
  return json ? JSON.stringify(result, null, 2) : result.generatedAnalysis.fullReport
}
