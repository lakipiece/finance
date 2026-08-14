export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { isKrwSecurity, lookupPrice, priceLookupKeys, resolveExchangeRate } from '@/lib/portfolio/valuation'

// GET /api/portfolio/prices-at?date=YYYY-MM-DD
// 지정일 이전 최신 가격을 종목별로 반환. 없으면 이후 최초 가격 fallback.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const sql = getSql()

  const securities = await sql<{ id: string; ticker: string; currency: string; country: string | null }[]>`
    SELECT s.id, s.ticker,
           cu.value AS currency,
           co.value AS country
    FROM securities s
    LEFT JOIN option_list cu ON s.currency_id = cu.id
    LEFT JOIN option_list co ON s.country_id  = co.id
  `

  const tickers = [
    ...new Set([
      ...securities.flatMap(s => priceLookupKeys(s.ticker, s.country)),
      'USDKRW=X',
      'KRW=X',
    ]),
  ]

  // 지정일 이전 최신 가격
  const prices = await sql<{ ticker: string; price: number }[]>`
    SELECT DISTINCT ON (ticker) ticker, price
    FROM price_history
    WHERE ticker = ANY(${tickers}) AND date <= ${date}
    ORDER BY ticker, date DESC
  `
  // fallback: 지정일 이전 가격이 없는 티커 → 이후 최초 가격
  const foundTickers = new Set(prices.map(p => p.ticker))
  const missingTickers = tickers.filter(t => !foundTickers.has(t))
  if (missingTickers.length > 0) {
    const fallback = await sql<{ ticker: string; price: number }[]>`
      SELECT DISTINCT ON (ticker) ticker, price
      FROM price_history
      WHERE ticker = ANY(${missingTickers})
      ORDER BY ticker, date ASC
    `
    prices.push(...fallback)
  }

  const priceMap: Record<string, number> = {}
  for (const p of prices) priceMap[p.ticker] = Number(p.price)

  const { rate: exchangeRate } = resolveExchangeRate(priceMap)

  // security_id → KRW 환산 가격
  const secPrices: Record<string, number> = {}
  for (const s of securities) {
    const rawPrice = lookupPrice(priceMap, s.ticker, s.country) ?? 0
    secPrices[s.id] = isKrwSecurity(s) ? rawPrice : rawPrice * exchangeRate
  }

  return NextResponse.json({ secPrices, exchangeRate })
}
