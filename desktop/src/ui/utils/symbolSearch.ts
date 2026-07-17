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
}

// Common base assets that pair with USDT on Binance spot
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
]

const QUOTE_CURRENCIES = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USDC', 'FDUSD']

export interface SymbolSuggestion {
  symbol: string
  base: string
  quote: string
}

/**
 * Given raw user input, return the best normalized symbol (e.g. "eth" → "ETHUSDT")
 * and up to 5 suggestions for a dropdown.
 *
 * Rules:
 * 1. If the input already looks like a full symbol (contains a known quote suffix),
 *    return it as-is (uppercased).
 * 2. If the input matches a known base exactly, suggest base+USDT first.
 * 3. Otherwise do prefix + substring matching against known bases.
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

  // Exact base match
  if (COMMON_BASES.includes(upper)) return `${upper}USDT`

  // Best-guess: append USDT
  return `${upper}USDT`
}

export function searchSymbols(raw: string, max = 5): SymbolSuggestion[] {
  const trimmed = raw.trim()
  if (!trimmed) return []
  const q = trimmed.toUpperCase()
  const lower = trimmed.toLowerCase()

  // If already a full pair, return it alone
  for (const quote of QUOTE_CURRENCIES) {
    if (q.endsWith(quote) && q.length > quote.length) {
      const base = q.slice(0, q.length - quote.length)
      return [{ symbol: q, base, quote }]
    }
  }

  // Check coin name dictionary — exact match yields the mapped ticker
  const coinMatch = COIN_NAMES[lower]
  if (coinMatch) {
    const results: SymbolSuggestion[] = [{ symbol: `${coinMatch}USDT`, base: coinMatch, quote: 'USDT' }]
    // Also include any prefix matches from COMMON_BASES for the mapped ticker
    for (const base of COMMON_BASES) {
      if (base !== coinMatch && base.startsWith(coinMatch) && results.length < max) {
        results.push({ symbol: `${base}USDT`, base, quote: 'USDT' })
      }
    }
    return results.slice(0, max)
  }

  // Partial coin name match (e.g. "bit" → bitcoin → BTC)
  const coinNameMatches: SymbolSuggestion[] = []
  for (const [name, ticker] of Object.entries(COIN_NAMES)) {
    if (name.startsWith(lower) && name !== lower && !COIN_NAMES[lower]) {
      const sym = `${ticker}USDT`
      if (!coinNameMatches.some(s => s.symbol === sym)) {
        coinNameMatches.push({ symbol: sym, base: ticker, quote: 'USDT' })
      }
    }
  }

  // Match bases by prefix first, then substring
  const prefix: SymbolSuggestion[] = []
  const substr: SymbolSuggestion[] = []

  for (const base of COMMON_BASES) {
    if (base.startsWith(q)) {
      prefix.push({ symbol: `${base}USDT`, base, quote: 'USDT' })
    } else if (base.includes(q) && q.length >= 2) {
      substr.push({ symbol: `${base}USDT`, base, quote: 'USDT' })
    }
  }

  // Merge: coin name prefix matches first, then ticker prefix, then substring
  const merged = [...coinNameMatches, ...prefix, ...substr]
  // Deduplicate by symbol
  const seen = new Set<string>()
  const unique: SymbolSuggestion[] = []
  for (const s of merged) {
    if (!seen.has(s.symbol)) {
      seen.add(s.symbol)
      unique.push(s)
    }
  }
  return unique.slice(0, max)
}
