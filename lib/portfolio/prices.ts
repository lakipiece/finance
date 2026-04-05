import 'server-only'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()
import { supabase } from '@/lib/supabase'
import { toYahooTicker } from './ticker-utils'
export { isKrxTicker, toYahooTicker } from './ticker-utils'

// price_history에서 최신 가격 조회 (오늘 or 가장 최근 날짜)
export async function getPricesFromHistory(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  if (tickers.length === 0) return {}

  const { data } = await supabase
    .from('price_history')
    .select('ticker, price, currency, date')
    .in('ticker', tickers)
    .order('date', { ascending: false })

  const result: Record<string, { price: number; currency: string }> = {}
  for (const row of data ?? []) {
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
  const { data: securities } = await supabase
    .from('securities')
    .select('ticker')

  if (!securities || securities.length === 0) return { saved: 0, failed: [], results: {} }

  // KRW=X 환율도 포함
  const rawTickers = securities.map(s => s.ticker)
  const yahooTickers = [...new Set([...rawTickers.map(toYahooTicker), 'KRW=X'])]

  const today = new Date().toISOString().slice(0, 10)
  const saved: { ticker: string; date: string; price: number; currency: string }[] = []
  const failed: string[] = []
  const results: Record<string, number> = {}

  await Promise.allSettled(
    yahooTickers.map(async (yahooTicker) => {
      try {
        const quote = await yahooFinance.quote(yahooTicker)
        const price = (quote as any).regularMarketPrice ?? 0
        const currency = (quote as any).currency ?? 'USD'
        if (price > 0) {
          saved.push({ ticker: yahooTicker, date: today, price, currency })
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
    await supabase
      .from('price_history')
      .upsert(saved, { onConflict: 'ticker,date' })
  }

  return { saved: saved.length, failed, results }
}

// 페이지 로딩 시 사용: DB에서 읽기만 함 (Yahoo 호출 없음)
export async function getPrices(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  return getPricesFromHistory(tickers)
}
