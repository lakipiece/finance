export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { isKrwSecurity, priceLookupKeys, resolvePrice, resolveExchangeRate } from '@/lib/portfolio/valuation'
import { fetchInterestPayments, lastInterestMap } from '@/lib/portfolio/interest'

// GET /api/portfolio/prices-at?date=YYYY-MM-DD
// 지정일 이전 최신 가격을 종목별로 반환. 미래 가격으로 과거를 평가하지 않는다 —
// 가격이 없는 종목은 0으로 두고 unpriced(security_id 목록)로 알린다.
export async function GET(req: Request) {
  const url = new URL(req.url)
  const date = url.searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const sql = getSql()

  const securities = await sql<{
    id: string; ticker: string; currency: string; country: string | null
    fixed_price: string | null; annual_rate: string | null
    accrual_start: unknown; maturity_date: unknown
  }[]>`
    SELECT s.id, s.ticker, s.fixed_price, s.annual_rate, s.accrual_start, s.maturity_date,
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
  const priceMap: Record<string, number> = {}
  for (const p of prices) priceMap[p.ticker] = Number(p.price)

  const { rate: exchangeRate, isFallback: fxFallback } = resolveExchangeRate(priceMap)

  // 미수이자 기산점 — 지정일 이전 마지막 이자 지급일
  const ctx = { asOf: date, lastInterestBySecurity: lastInterestMap(await fetchInterestPayments(), date) }

  // security_id → KRW 환산 가격
  const secPrices: Record<string, number> = {}
  const unpriced: string[] = []
  for (const s of securities) {
    const rawPrice = resolvePrice(priceMap, s, ctx)
    if (rawPrice === null) unpriced.push(s.id)
    secPrices[s.id] = rawPrice === null ? 0 : isKrwSecurity(s) ? rawPrice : rawPrice * exchangeRate
  }

  return NextResponse.json({ secPrices, exchangeRate, unpriced, fxFallback })
}
