// Coin name → ticker mapping for natural-language search
const COIN_NAMES: Record<string, string> = {
  bitcoin:     'BTC',
  btc:         'BTC',
  ethereum:    'ETH',
  ether:       'ETH',
  eth:         'ETH',
  binance:     'BNB',
  bnb:         'BNB',
  solana:      'SOL',
  sol:         'SOL',
  ripple:      'XRP',
  xrp:         'XRP',
  cardano:     'ADA',
  ada:         'ADA',
  dogecoin:    'DOGE',
  doge:        'DOGE',
  avalanche:   'AVAX',
  avax:        'AVAX',
  polkadot:    'DOT',
  dot:         'DOT',
  polygon:     'MATIC',
  matic:       'MATIC',
  chainlink:   'LINK',
  link:        'LINK',
  uniswap:     'UNI',
  uni:         'UNI',
  litecoin:    'LTC',
  ltc:         'LTC',
  cosmos:      'ATOM',
  atom:        'ATOM',
  shiba:       'SHIB',
  shib:        'SHIB',
  pepe:        'PEPE',
  floki:       'FLOKI',
  aptos:       'APT',
  apt:         'APT',
  arbitrum:    'ARB',
  arb:         'ARB',
  optimism:    'OP',
  sui:         'SUI',
  injective:   'INJ',
  inj:         'INJ',
  celestia:    'TIA',
  tia:         'TIA',
  jupiter:     'JUP',
  jup:         'JUP',
  worldcoin:   'WLD',
  wld:         'WLD',
  near:        'NEAR',
  algorand:    'ALGO',
  algo:        'ALGO',
  vechain:     'VET',
  vet:         'VET',
  hedera:      'HBAR',
  hbar:        'HBAR',
  stellar:     'XLM',
  xlm:         'XLM',
  monero:      'XMR',
  xmr:         'XMR',
  aave:        'AAVE',
  maker:       'MKR',
  mkr:         'MKR',
  toncoin:     'TON',
  ton:         'TON',
  tron:        'TRX',
  trx:         'TRX',
  kaspa:       'KAS',
  kas:         'KAS',
  render:      'RENDER',
  fetch:       'FET',
  fet:         'FET',
  sandbox:     'SAND',
  sand:        'SAND',
  axie:        'AXS',
  axs:         'AXS',
  sushi:       'SUSHI',
  curve:       'CRV',
  crv:         'CRV',
  convex:      'CVX',
  cvx:         'CVX',
  pendle:      'PENDLE',
  gmx:         'GMX',
  stacks:      'STX',
  stx:         'STX',
  immutable:   'IMX',
  imx:         'IMX',
  eigenlayer:  'EIGEN',
  eigen:       'EIGEN',
  gold:        'XAU',
  xau:         'XAU',
  silver:      'XAG',
  xag:         'XAG',
  platinum:    'XPT',
  xpt:         'XPT',
}

// Static fallback list used while the dynamic cache is loading or if the API is unavailable.
const COMMON_BASES = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'LTC', 'ATOM', 'ICP', 'FIL', 'APT', 'ARB', 'OP', 'SUI',
  'INJ', 'TIA', 'SEI', 'JUP', 'WIF', 'BONK', 'PEPE', 'SHIB', 'FLOKI', 'FTM',
  'NEAR', 'ALGO', 'VET', 'HBAR', 'XLM', 'EGLD', 'THETA', 'FET', 'RENDER',
  'WLD', 'MANTA', 'PYTH', 'STRK', 'DYM', 'ALT', 'PIXEL', 'PORTAL', 'MEME',
  'ACE', 'XAI', 'ETHFI', 'BOME', 'NOT', 'IO', 'ZK', 'LISTA', 'ZRO', 'EIGEN',
  'NEIRO', 'HMSTR', 'SCR', 'DOGS', 'CATI', 'PNUT', 'ACT', 'GRASS', 'GOAT',
  'ENA', 'AEVO', 'BB', 'BICO', 'BLUR', 'CAKE', 'CFX', 'CHZ', 'CKB', 'COMP',
  'CRV', 'CTSI', 'CVX', 'DYDX', 'ENS', 'FXS', 'GAL', 'GNO', 'GRT', 'IOTA',
  'JASMY', 'KAS', 'KSM', 'LIDO', 'LDO', 'MAGIC', 'MKR', 'NEO', 'OCEAN',
  'ONT', 'PENDLE', 'QNT', 'RPL', 'RSR', 'RVN', 'SAND', 'SNX', 'SPELL',
  'SSV', 'STORJ', 'STX', 'SXP', 'SUSHI', 'TON', 'TRX', 'TUSD', 'UMA',
  'WAVES', 'XMR', 'YFI', 'ZEC', 'ZIL', 'AXS', 'CYBER', 'GMX', 'AAVE',
  'BAL', 'BAND', 'BAT', 'BCH', 'CELO', 'CLV', 'DASH', 'EOS', 'ETC', 'FLOW',
  'HFT', 'HOT', 'IMX', 'KAVA', 'KLIMA', 'MANA', 'MOVR', 'PERP', 'REEF',
  'SKL', 'SUPER', 'TLM', 'TOMO', 'UNFI', 'VOLT', 'XEM', 'XTZ', 'ZEN',
  'XAU', 'XAG', 'XPT',
]

const QUOTE_CURRENCIES = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USDC', 'FDUSD']

export interface SymbolSuggestion {
  symbol: string
  base: string
  quote: string
}

import { symbolRegistry } from '../../modules/binance/registry'

/** Eagerly prime the symbol cache. Call once at app startup. */
export function primeSymbolCache(): void {
  symbolRegistry.prime()
}

function staticList(): SymbolSuggestion[] {
  return COMMON_BASES.map(base => ({ symbol: `${base}USDT`, base, quote: 'USDT' }))
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given raw user input, return the best normalized symbol (e.g. "eth" → "ETHUSDT").
 */
export function resolveSymbol(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  // Check coin name dictionary first (case-insensitive)
  const coinMatch = COIN_NAMES[trimmed.toLowerCase()]
  if (coinMatch) return `${coinMatch}USDT`

  const upper = trimmed.toUpperCase()

  // Already looks like a full pair
  for (const q of QUOTE_CURRENCIES) {
    if (upper.endsWith(q) && upper.length > q.length) return upper
  }

  // Exact base match in static list
  if (COMMON_BASES.includes(upper)) return `${upper}USDT`

  // Best-guess: append USDT
  return `${upper}USDT`
}

/**
 * Search for symbol suggestions matching the raw input string.
 * Returns up to `max` suggestions. Uses the dynamic Binance cache when
 * available, falling back to the static list during initial load.
 */
export function searchSymbols(raw: string, max = 8): SymbolSuggestion[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  const q     = trimmed.toUpperCase()
  const lower = trimmed.toLowerCase()

  // If already a full pair, return it alone
  for (const quote of QUOTE_CURRENCIES) {
    if (q.endsWith(quote) && q.length > quote.length) {
      const base = q.slice(0, q.length - quote.length)
      return [{ symbol: q, base, quote }]
    }
  }

  const registryEntries = symbolRegistry.getAll()
  const list: SymbolSuggestion[] = registryEntries.length > 0 ? registryEntries : staticList()

  // Coin name exact match → the mapped ticker first, then prefix matches
  const coinMatch = COIN_NAMES[lower]
  if (coinMatch) {
    const results: SymbolSuggestion[] = [{ symbol: `${coinMatch}USDT`, base: coinMatch, quote: 'USDT' }]
    for (const entry of list) {
      if (entry.base !== coinMatch && entry.base.startsWith(coinMatch) && results.length < max) {
        results.push({ symbol: entry.symbol, base: entry.base, quote: entry.quote })
      }
    }
    return results.slice(0, max)
  }

  // Partial coin name prefix match (e.g. "bit" → bitcoin → BTC)
  const nameMatches: SymbolSuggestion[] = []
  for (const [name, ticker] of Object.entries(COIN_NAMES)) {
    if (name.startsWith(lower) && name !== lower && !COIN_NAMES[lower]) {
      const sym = `${ticker}USDT`
      if (!nameMatches.some(s => s.symbol === sym)) {
        nameMatches.push({ symbol: sym, base: ticker, quote: 'USDT' })
      }
    }
  }

  // Match bases by prefix then substring; sort prefix by length (shorter = more relevant)
  const prefix: SymbolSuggestion[] = []
  const substr: SymbolSuggestion[] = []

  for (const entry of list) {
    if (entry.base.startsWith(q)) {
      prefix.push({ symbol: entry.symbol, base: entry.base, quote: entry.quote })
    } else if (entry.base.includes(q) && q.length >= 2) {
      substr.push({ symbol: entry.symbol, base: entry.base, quote: entry.quote })
    }
  }

  prefix.sort((a, b) => a.base.length - b.base.length)

  const merged = [...nameMatches, ...prefix, ...substr]
  const seen   = new Set<string>()
  const unique: SymbolSuggestion[] = []
  for (const s of merged) {
    if (!seen.has(s.symbol)) {
      seen.add(s.symbol)
      unique.push(s)
    }
  }
  return unique.slice(0, max)
}
