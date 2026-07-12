import { invoke } from '@tauri-apps/api/core'
import { HttpTransport } from './HttpTransport'
import type { AnalysisTransport, AnalyzeOptions, HistoryMeta, HistoryEntry } from './types'
import type { PipelineResult } from '../types'

// ── TauriTransport ────────────────────────────────────────────────────────────

/**
 * Tauri desktop implementation of AnalysisTransport.
 *
 * On first use it calls the `get_engine_url` Rust command (implemented in
 * Desktop Module 3) to discover the sidecar's HTTP base URL, then delegates
 * every method to an HttpTransport pointed at that URL.
 *
 * Until Module 3 is in place, the invoke call throws and the fallback URL
 * (localhost:3000) is used instead — keeping `tauri dev` functional when
 * `npm run dev:api` is running alongside `npm run tauri:dev`.
 */
export class TauriTransport implements AnalysisTransport {
  private http: HttpTransport | null = null

  private async getHttp(): Promise<HttpTransport> {
    if (!this.http) {
      let baseUrl = 'http://localhost:3000'
      try {
        // Module 3 implements this Rust command.
        // Until then, invoke throws and we use the fallback URL above.
        baseUrl = await invoke<string>('get_engine_url')
      } catch {
        // get_engine_url not yet available — fall back to dev default
      }
      this.http = new HttpTransport(baseUrl)
    }
    return this.http
  }

  async analyze(
    symbol: string,
    interval: string,
    options?: AnalyzeOptions,
    signal?: AbortSignal,
  ): Promise<PipelineResult> {
    return (await this.getHttp()).analyze(symbol, interval, options, signal)
  }

  async health(signal?: AbortSignal): Promise<boolean> {
    return (await this.getHttp()).health(signal)
  }

  async listHistory(): Promise<HistoryMeta[]> {
    return (await this.getHttp()).listHistory()
  }

  async getHistory(id: string): Promise<HistoryEntry | null> {
    return (await this.getHttp()).getHistory(id)
  }

  async saveHistory(
    result: PipelineResult,
    symbol: string,
    interval: string,
  ): Promise<HistoryMeta | null> {
    return (await this.getHttp()).saveHistory(result, symbol, interval)
  }

  async deleteHistory(id: string): Promise<boolean> {
    return (await this.getHttp()).deleteHistory(id)
  }
}
