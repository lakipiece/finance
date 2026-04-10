import 'server-only'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()
import { getSql } from '@/lib/db'
import { toYahooTicker } from './ticker-utils'
export { isKrxTicker, toYahooTicker } from './ticker-utils'

// Yahoo Finance exchange code → Google Finance exchange code
const YAHOO_TO_GOOGLE_EXCHANGE: Record<string, string> = {
  PCX: 'NYSEARCA',
  BTS: 'NYSEARCA',
  NMS: 'NASDAQ',
  NGM: 'NASDAQ',
  NCM: 'NASDAQ',
  NIM: 'NASDAQ',
  NYQ: 'NYSE',
  ASE: 'NYSEAMERICAN',
  PNK: 'OTCMKTS',
}

export function toGoogleFinanceUrl(ticker: string, yahooExchange?: string | null): string | null {
  if (!yahooExchange) return null
  const googleExchange = YAHOO_TO_GOOGLE_EXCHANGE[yahooExchange]
  if (!googleExchange) return null
  return `https://www.google.com/finance/quote/${ticker}:${googleExchange}`
}

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

type PriceRow = { ticker: string; date: string; price: number; currency: string; change_pct: number | null; exchange: string | null }

async function fetchYahooPrices(yahooTickers: string[], today: string): Promise<{ saved: PriceRow[]; failed: string[] }> {
  const saved: PriceRow[] = []
  const failed: string[] = []

  await Promise.allSettled(
    yahooTickers.map(async (yahooTicker) => {
      try {
        const quote = await yahooFinance.quote(yahooTicker)
        const price = (quote as any).regularMarketPrice ?? 0
        const currency = (quote as any).currency ?? 'USD'
        const changePct = (quote as any).regularMarketChangePercent ?? null
        const exchange = (quote as any).exchange ?? null
        if (price > 0) {
          saved.push({ ticker: yahooTicker, date: today, price, currency, change_pct: changePct, exchange })
        } else {
          failed.push(`${yahooTicker}: price=0`)
        }
      } catch (err: unknown) {
        failed.push(`${yahooTicker}: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  )

  return { saved, failed }
}

async function fetchCoinGeckoPrices(coinTickers: string[], today: string): Promise<{ saved: PriceRow[]; failed: string[] }> {
  const saved: PriceRow[] = []
  const failed: string[] = []
  if (coinTickers.length === 0) return { saved, failed }

  const ids = coinTickers.map(t => t.toLowerCase()).join(',')
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=krw&include_24hr_change=true`)
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const data = await res.json() as Record<string, { krw: number; krw_24h_change?: number }>
    for (const ticker of coinTickers) {
      const id = ticker.toLowerCase()
      const row = data[id]
      if (row?.krw > 0) {
        saved.push({ ticker, date: today, price: row.krw, currency: 'KRW', change_pct: row.krw_24h_change ?? null, exchange: null })
      } else {
        failed.push(`${ticker}: not found in CoinGecko`)
      }
    }
  } catch (err: unknown) {
    failed.push(`coingecko: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { saved, failed }
}

// 모든 securities 티커를 Yahoo Finance / CoinGecko에서 가져와 price_history에 저장
export async function refreshAllPrices(): Promise<{
  saved: number
  failed: string[]
  results: Record<string, number>
}> {
  const sql = getSql()
  const securities = await sql<{ ticker: string; asset_class: string | null; country: string | null }[]>`SELECT ticker, asset_class, country FROM securities`

  if (!securities || securities.length === 0) return { saved: 0, failed: [], results: {} }

  const today = new Date().toISOString().slice(0, 10)

  // 자산군별 분류
  const coinTickers = securities.filter(s => s.asset_class === '코인').map(s => s.ticker)
  const yahooRaw = securities.filter(s => s.asset_class !== '코인' && s.asset_class !== '현금')
  const yahooTickers = [...new Set([...yahooRaw.map(s => toYahooTicker(s.ticker, s.country)), 'KRW=X'])]

  const [yahooResult, coinResult] = await Promise.all([
    fetchYahooPrices(yahooTickers, today),
    fetchCoinGeckoPrices(coinTickers, today),
  ])

  const allSaved = [...yahooResult.saved, ...coinResult.saved]
  const allFailed = [...yahooResult.failed, ...coinResult.failed]
  const results: Record<string, number> = {}
  for (const row of allSaved) results[row.ticker] = row.price

  if (allSaved.length > 0) {
    await sql`
      INSERT INTO price_history ${sql(allSaved, 'ticker', 'date', 'price', 'currency', 'change_pct', 'exchange')}
      ON CONFLICT (ticker, date) DO UPDATE
        SET price = EXCLUDED.price,
            currency = EXCLUDED.currency,
            change_pct = EXCLUDED.change_pct,
            exchange = EXCLUDED.exchange
    `
  }

  return { saved: allSaved.length, failed: allFailed, results }
}

// 페이지 로딩 시 사용: DB에서 읽기만 함 (Yahoo 호출 없음)
export async function getPrices(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  return getPricesFromHistory(tickers)
}
