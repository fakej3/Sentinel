import type { IMarketDataProvider } from './types'
import { BinanceRestProvider } from './BinanceRestProvider'

const _default = new BinanceRestProvider()

const _registry = new Map<string, IMarketDataProvider>([[_default.id, _default]])

let _activeId = _default.id

export function registerProvider(provider: IMarketDataProvider): void {
  _registry.set(provider.id, provider)
}

export function setActiveProvider(id: string): void {
  if (!_registry.has(id)) throw new Error(`Unknown provider: "${id}"`)
  _activeId = id
}

export function getProvider(id?: string): IMarketDataProvider {
  const key = id ?? _activeId
  const p = _registry.get(key)
  if (!p) throw new Error(`Unknown provider: "${key}"`)
  return p
}

export function listProviders(): string[] {
  return Array.from(_registry.keys())
}
