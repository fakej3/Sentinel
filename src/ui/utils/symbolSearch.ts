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
  const upper = raw.trim().toUpperCase()
  if (!upper) return upper

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
  const q = raw.trim().toUpperCase()
  if (!q) return []

  // If already a full pair, return it alone
  for (const quote of QUOTE_CURRENCIES) {
    if (q.endsWith(quote) && q.length > quote.length) {
      const base = q.slice(0, q.length - quote.length)
      return [{ symbol: q, base, quote }]
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

  return [...prefix, ...substr].slice(0, max)
}
