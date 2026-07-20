import type { Candle } from '../../market/types'

export function makeCandles(count: number, basePrice = 50_000): Candle[] {
  const candles: Candle[] = []
  let price = basePrice
  for (let i = 0; i < count; i++) {
    const move = Math.sin(i * 0.2) * (basePrice * 0.002)
    price = Math.max(basePrice * 0.5, price + move)
    const range = Math.abs(Math.cos(i * 0.3)) * (basePrice * 0.001) + basePrice * 0.0005
    const high = price + range
    const low = Math.max(0.01, price - range)
    const volume = 1000 + Math.abs(Math.sin(i * 0.15)) * 500
    const takerBuy = volume * (0.5 + Math.sin(i * 0.1) * 0.1)
    candles.push({
      openTime: i * 3_600_000,
      closeTime: i * 3_600_000 + 3_599_999,
      open: Math.max(0.01, price - move / 2),
      high,
      low,
      close: price,
      volume,
      quoteVolume: price * volume,
      trades: 100,
      takerBuyVolume: takerBuy,
      takerSellVolume: volume - takerBuy,
    })
  }
  return candles
}
