import 'server-only'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()
import { getSql } from '@/lib/db'
import { toYahooTicker } from './ticker-utils'
export { isKrxTicker, toYahooTicker } from './ticker-utils'

// price_history에서 최신 가격 조회 (오늘 or 가장 최근 날짜)
export async function getPricesFromHistory(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  if (tickers.length === 0) return {}

  const sql = getSql()
  const rows = await sql<{ ticker: string; price: number; currency: string; date: string }[]>`
    SELECT ticker, price, currency, date
    FROM price_history
    WHERE ticker = ANY(${tickers})
    ORDER BY date DESC
  `

  const result: Record<string, { price: number; currency: string }> = {}
  for (const row of rows ?? []) {
    if (!result[row.ticker]) {
      result[row.ticker] = { price: row.price, currency: row.currency }
    }
  }
  return result
}

// 모든 securities 티커를 Yahoo Finance에서 가져와 price_history에 저장
export async function refreshAllPrices(): Promise<{
  saved: number
  failed: string[]
  results: Record<string, number>
}> {
  const sql = getSql()
  const securities = await sql<{ ticker: string }[]>`SELECT ticker FROM securities`

  if (!securities || securities.length === 0) return { saved: 0, failed: [], results: {} }

  // KRW=X 환율도 포함
  const rawTickers = securities.map(s => s.ticker)
  const yahooTickers = [...new Set([...rawTickers.map(toYahooTicker), 'KRW=X'])]

  const today = new Date().toISOString().slice(0, 10)
  const saved: { ticker: string; date: string; price: number; currency: string; change_pct: number | null }[] = []
  const failed: string[] = []
  const results: Record<string, number> = {}

  await Promise.allSettled(
    yahooTickers.map(async (yahooTicker) => {
      try {
        const quote = await yahooFinance.quote(yahooTicker)
        const price = (quote as any).regularMarketPrice ?? 0
        const currency = (quote as any).currency ?? 'USD'
        const changePct = (quote as any).regularMarketChangePercent ?? null
        if (price > 0) {
          saved.push({ ticker: yahooTicker, date: today, price, currency, change_pct: changePct })
          results[yahooTicker] = price
        } else {
          failed.push(`${yahooTicker}: price=0`)
        }
      } catch (err: unknown) {
        failed.push(`${yahooTicker}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  )

  if (saved.length > 0) {
    await sql`
      INSERT INTO price_history ${sql(saved, 'ticker', 'date', 'price', 'currency', 'change_pct')}
      ON CONFLICT (ticker, date) DO UPDATE
        SET price = EXCLUDED.price,
            currency = EXCLUDED.currency
    `
  }

  return { saved: saved.length, failed, results }
}

// 페이지 로딩 시 사용: DB에서 읽기만 함 (Yahoo 호출 없음)
export async function getPrices(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  return getPricesFromHistory(tickers)
}
