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
  const securities = await sql<{ ticker: string; asset_class: string | null; country: string | null; currency: string | null }[]>`
    SELECT s.ticker,
           ac.value AS asset_class,
           co.value AS country,
           cu.value AS currency
    FROM securities s
    LEFT JOIN option_list ac ON s.asset_class_id = ac.id
    LEFT JOIN option_list co ON s.country_id     = co.id
    LEFT JOIN option_list cu ON s.currency_id    = cu.id
  `

  if (!securities || securities.length === 0) return { saved: 0, failed: [], results: {} }

  // KST 기준 거래일: KST 12시 이전(새벽) 수집 = 미국장 마감 후 → 전날이 거래일
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const kstHour = nowKst.getUTCHours()
  const tradingDate = new Date(nowKst)
  if (kstHour < 12) tradingDate.setUTCDate(tradingDate.getUTCDate() - 1)
  const today = tradingDate.toISOString().slice(0, 10)

  // 자산군별 분류
  const coinTickers = securities.filter(s => s.asset_class === '코인').map(s => s.ticker)
  const cashSecurities = securities.filter(s => s.asset_class === '현금')
  const yahooRaw = securities.filter(s => s.asset_class !== '코인' && s.asset_class !== '현금')
  // USDKRW=X: 1 USD = x KRW (≈1480), USD 현금 및 환율 표시에 사용
  const yahooTickers = [...new Set([...yahooRaw.map(s => toYahooTicker(s.ticker, s.country)), 'USDKRW=X'])]

  const [yahooResult, coinResult] = await Promise.all([
    fetchYahooPrices(yahooTickers, today),
    fetchCoinGeckoPrices(coinTickers, today),
  ])

  // 현금 처리: KRW=1원, USD=환율
  const krwRate = yahooResult.saved.find(r => r.ticker === 'USDKRW=X')?.price ?? null
  const cashSaved: PriceRow[] = []
  for (const cash of cashSecurities) {
    if (cash.currency === 'USD' && krwRate) {
      cashSaved.push({ ticker: cash.ticker, date: today, price: krwRate, currency: 'KRW', change_pct: null, exchange: null })
    } else {
      // KRW 또는 기타 → 1원 고정
      cashSaved.push({ ticker: cash.ticker, date: today, price: 1, currency: 'KRW', change_pct: null, exchange: null })
    }
  }

  // USDKRW=X를 KRW=X로도 저장 (fetch.ts / prices-at에서 KRW=X 키로 조회)
  const krwXRow = yahooResult.saved.find(r => r.ticker === 'USDKRW=X')
  const krwAlias: PriceRow[] = krwXRow
    ? [{ ...krwXRow, ticker: 'KRW=X' }]
    : []

  const allSaved = [...yahooResult.saved, ...coinResult.saved, ...cashSaved, ...krwAlias]
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

// 날짜 범위의 과거 일별 종가를 Yahoo Finance / CoinGecko에서 수집
export async function fetchHistoricalPrices(
  startDate: string,  // 'YYYY-MM-DD'
  endDate: string,    // 'YYYY-MM-DD'
): Promise<{ saved: number; failed: string[]; tickers: string[] }> {
  const sql = getSql()
  const securities = await sql<{ ticker: string; asset_class: string | null; country: string | null; currency: string | null }[]>`
    SELECT s.ticker,
           ac.value AS asset_class,
           co.value AS country,
           cu.value AS currency
    FROM securities s
    LEFT JOIN option_list ac ON s.asset_class_id = ac.id
    LEFT JOIN option_list co ON s.country_id     = co.id
    LEFT JOIN option_list cu ON s.currency_id    = cu.id
  `
  if (!securities || securities.length === 0) return { saved: 0, failed: [], tickers: [] }

  const period1 = new Date(startDate)
  const period2 = new Date(endDate)

  const coinTickers = securities.filter(s => s.asset_class === '코인').map(s => s.ticker)
  const yahooRaw = securities.filter(s => s.asset_class !== '코인' && s.asset_class !== '현금')
  const yahooTickers = [...new Set([
    ...yahooRaw.map(s => toYahooTicker(s.ticker, s.country)),
    'USDKRW=X',
  ])]

  const allRows: PriceRow[] = []
  const failed: string[] = []

  // Yahoo: 5개씩 순차 배치 (rate limit 방지)
  const BATCH = 5
  for (let i = 0; i < yahooTickers.length; i += BATCH) {
    const batch = yahooTickers.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const rows = await yahooFinance.historical(ticker, {
            period1,
            period2,
            interval: '1d',
          })
          const currency = ticker === 'USDKRW=X' ? 'KRW'
            : ticker.endsWith('.KS') ? 'KRW'
            : 'USD'
          for (const row of rows ?? []) {
            const price = (row as any).adjClose ?? (row as any).close ?? 0
            if (!price || price <= 0) continue
            const dateStr = new Date((row as any).date).toISOString().slice(0, 10)
            allRows.push({ ticker, date: dateStr, price, currency, change_pct: null, exchange: null })
            // USDKRW=X를 KRW=X로도 저장 (fetch.ts / prices-at에서 KRW=X 키로 조회)
            if (ticker === 'USDKRW=X') {
              allRows.push({ ticker: 'KRW=X', date: dateStr, price, currency: 'KRW', change_pct: null, exchange: null })
            }
          }
        } catch (err: unknown) {
          failed.push(`${ticker}: ${err instanceof Error ? err.message : String(err)}`)
        }
      })
    )
    // 배치 간 200ms 딜레이
    if (i + BATCH < yahooTickers.length) await new Promise(r => setTimeout(r, 200))
  }

  // CoinGecko: /coins/{id}/market_chart/range
  for (const ticker of coinTickers) {
    try {
      const from = Math.floor(period1.getTime() / 1000)
      const to = Math.floor(period2.getTime() / 1000)
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${ticker.toLowerCase()}/market_chart/range?vs_currency=krw&from=${from}&to=${to}`
      )
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
      const data = await res.json() as { prices: [number, number][] }
      for (const [ts, price] of data.prices ?? []) {
        const dateStr = new Date(ts).toISOString().slice(0, 10)
        allRows.push({ ticker, date: dateStr, price, currency: 'KRW', change_pct: null, exchange: null })
      }
    } catch (err: unknown) {
      failed.push(`${ticker}(coin): ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 같은 (ticker, date) 중복 제거 — 마지막 값 유지
  const deduped = Object.values(
    Object.fromEntries(allRows.map(r => [`${r.ticker}__${r.date}`, r]))
  )

  if (deduped.length > 0) {
    await sql`
      INSERT INTO price_history ${sql(deduped, 'ticker', 'date', 'price', 'currency', 'change_pct', 'exchange')}
      ON CONFLICT (ticker, date) DO UPDATE
        SET price = EXCLUDED.price,
            currency = EXCLUDED.currency
    `
  }

  return {
    saved: deduped.length,
    failed,
    tickers: yahooTickers.concat(coinTickers),
  }
}
