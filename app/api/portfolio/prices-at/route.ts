export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

// GET /api/portfolio/prices-at?date=YYYY-MM-DD
// Returns prices closest to (but not after) the given date for all securities
export async function GET(req: Request) {
  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const sql = getSql()

  // Get all securities with their currency/country info
  const securities = await sql<{ id: string; ticker: string; currency: string; country: string | null }[]>`
    SELECT id, ticker, currency, country FROM securities
  `

  // Build yahoo tickers
  const tickers = securities.map(s => {
    const clean = s.ticker.startsWith('KRX:') ? s.ticker.slice(4) : s.ticker
    if (clean.includes('.')) return clean
    const isKrx = s.country === '국내'
    return isKrx ? `${clean}.KS` : clean
  })
  tickers.push('KRW=X')

  // Get latest prices up to date
  const prices = await sql<{ ticker: string; price: number }[]>`
    SELECT DISTINCT ON (ticker) ticker, price
    FROM price_history
    WHERE ticker = ANY(${tickers}) AND date <= ${date}
    ORDER BY ticker, date DESC
  `

  const priceMap: Record<string, number> = {}
  for (const p of prices) {
    priceMap[p.ticker] = Number(p.price)
  }

  const exchangeRate = priceMap['KRW=X'] ?? 1350

  // Build security_id → price in KRW map
  const secPrices: Record<string, number> = {}
  for (const s of securities) {
    const clean = s.ticker.startsWith('KRX:') ? s.ticker.slice(4) : s.ticker
    if (clean.includes('.')) {
      const rawPrice = priceMap[clean] ?? 0
      const isKrw = s.currency === 'KRW'
      secPrices[s.id] = isKrw ? rawPrice : rawPrice * exchangeRate
    } else {
      const isKrx = s.country === '국내'
      const yahooTicker = isKrx ? `${clean}.KS` : clean
      const rawPrice = priceMap[yahooTicker] ?? 0
      const isKrw = isKrx || s.currency === 'KRW'
      secPrices[s.id] = isKrw ? rawPrice : rawPrice * exchangeRate
    }
  }

  return NextResponse.json({ secPrices, exchangeRate })
}
