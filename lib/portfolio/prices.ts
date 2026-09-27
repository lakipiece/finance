import 'server-only'
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()
import { getSql } from '@/lib/db'
import { toYahooTicker } from './ticker-utils'
import { fixedPriceOf, kstTradingDate } from './valuation'
export { isKrxTicker, toYahooTicker } from './ticker-utils'

/** USD 현금 종목 — 시세 대신 USDKRW=X 환율을 가격으로 기록한다 */
const USD_CASH_TICKER = 'USD'

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

// 한 INSERT의 바인딩 파라미터는 65,534개가 한도 — 행당 6개라 약 1만 행이면 넘는다.
// 전 종목 × 수개월 과거 수집이 한 번에 1만 행을 넘기므로 나눠 넣는다.
const UPSERT_CHUNK = 2000

/**
 * price_history 업서트. withMeta=true면 등락률·거래소·수집시각도 갱신(일일 수집),
 * false면 가격·통화만 갱신(과거 수집 — 일봉에는 등락률·거래소가 없다).
 */
async function upsertPriceRows(rows: PriceRow[], withMeta: boolean) {
  const sql = getSql()
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    if (withMeta) {
      await sql`
        INSERT INTO price_history ${sql(chunk, 'ticker', 'date', 'price', 'currency', 'change_pct', 'exchange')}
        ON CONFLICT (ticker, date) DO UPDATE
          SET price = EXCLUDED.price,
              currency = EXCLUDED.currency,
              change_pct = EXCLUDED.change_pct,
              exchange = EXCLUDED.exchange,
              created_at = NOW()
      `
    } else {
      await sql`
        INSERT INTO price_history ${sql(chunk, 'ticker', 'date', 'price', 'currency', 'change_pct', 'exchange')}
        ON CONFLICT (ticker, date) DO UPDATE
          SET price = EXCLUDED.price,
              currency = EXCLUDED.currency
      `
    }
  }
}

/** 'fetch failed'는 원인을 cause에 숨긴다 — ECONNRESET 같은 코드를 함께 남긴다 */
function errorMessage(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = (err as { cause?: { code?: string; message?: string } }).cause
  const detail = cause?.code ?? cause?.message
  return detail ? `${err.message} (${detail})` : err.message
}

/** 일시적 네트워크 실패 대비 — 실패 시 간격을 늘려가며 재시도 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 800): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise(r => setTimeout(r, delayMs * (attempt + 1)))
    }
  }
}

async function fetchYahooPrices(yahooTickers: string[], today: string): Promise<{ saved: PriceRow[]; failed: string[] }> {
  const saved: PriceRow[] = []
  const errors: Record<string, string> = {}

  async function fetchOne(yahooTicker: string) {
    try {
      const quote = await yahooFinance.quote(yahooTicker)
      const price = (quote as any).regularMarketPrice ?? 0
      const currency = (quote as any).currency ?? 'USD'
      const changePct = (quote as any).regularMarketChangePercent ?? null
      const exchange = (quote as any).exchange ?? null
      if (price > 0) {
        saved.push({ ticker: yahooTicker, date: today, price, currency, change_pct: changePct, exchange })
        delete errors[yahooTicker]
      } else {
        errors[yahooTicker] = 'price=0'
      }
    } catch (err: unknown) {
      errors[yahooTicker] = errorMessage(err)
    }
  }

  await Promise.allSettled(yahooTickers.map(fetchOne))

  // 동시 요청 중 일시적 'fetch failed'가 드물게 난다(컨테이너 기동 직후 등) — 실패분만 한 번 순차 재시도
  const retry = Object.keys(errors)
  for (const t of retry) await fetchOne(t)

  return { saved, failed: Object.entries(errors).map(([t, msg]) => `${t}: ${msg}`) }
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
    failed.push(`coingecko: ${errorMessage(err)}`)
  }

  return { saved, failed }
}

// 모든 securities 티커를 Yahoo Finance / CoinGecko에서 가져와 price_history에 저장
export async function refreshAllPrices(): Promise<{
  saved: number
  failed: string[]
  results: Record<string, number>
  backfilled: number
  backfillTickers: string[]
}> {
  const sql = getSql()
  const securities = await sql<{ ticker: string; asset_class: string | null; country: string | null; currency: string | null; fixed_price: string | null }[]>`
    SELECT s.ticker, s.fixed_price,
           ac.value AS asset_class,
           co.value AS country,
           cu.value AS currency
    FROM securities s
    LEFT JOIN option_list ac ON s.asset_class_id = ac.id
    LEFT JOIN option_list co ON s.country_id     = co.id
    LEFT JOIN option_list cu ON s.currency_id    = cu.id
  `

  if (!securities || securities.length === 0) return { saved: 0, failed: [], results: {}, backfilled: 0, backfillTickers: [] }

  // KST 기준 거래일: KST 12시 이전(새벽) 수집 = 미국장 마감 후 → 전날이 거래일
  const today = kstTradingDate()
  const tradingDate = new Date(today)

  // 자산군별 분류 — 고정단가 종목은 시세 조회 대상에서 완전히 제외
  const fixedSecurities = securities.filter(s => fixedPriceOf(s) !== null)
  const quoted = securities.filter(s => fixedPriceOf(s) === null)
  // USD 현금은 시세가 아니라 환율(USDKRW=X alias)로 평가한다. 원화 현금은 고정단가 1원.
  // 자산군이 '현금'이어도 현금성 ETF는 시세가 있으므로 조회 대상이다.
  const coinTickers = quoted.filter(s => s.asset_class === '코인').map(s => s.ticker)
  const yahooRaw = quoted.filter(s => s.asset_class !== '코인' && s.ticker !== USD_CASH_TICKER)
  // USDKRW=X: 1 USD = x KRW (≈1480), USD 현금 및 환율 표시에 사용
  const yahooTickers = [...new Set([...yahooRaw.map(s => toYahooTicker(s.ticker, s.country)), 'USDKRW=X'])]

  const [yahooResult, coinResult] = await Promise.all([
    fetchYahooPrices(yahooTickers, today),
    fetchCoinGeckoPrices(coinTickers, today),
  ])

  // USDKRW=X → KRW=X(환율 조회용), USD(현금 종목용) alias 추가
  const usdkrwRow = yahooResult.saved.find(r => r.ticker === 'USDKRW=X')
  const fxAliases: PriceRow[] = usdkrwRow
    ? [
        { ...usdkrwRow, ticker: 'KRW=X' },
        { ...usdkrwRow, ticker: 'USD', currency: 'KRW' },
      ]
    : []

  // 고정단가 종목: 티커가 실재하지 않으므로 지정 단가를 그대로 오늘자 가격으로 기록
  const fixedRows = fixedSecurities.map(s => ({
    ticker: toYahooTicker(s.ticker, s.country),
    date: today,
    price: fixedPriceOf(s) as number,
    currency: s.currency ?? 'KRW',
    change_pct: null,
    exchange: null,
  } as PriceRow))

  const allSaved = [...yahooResult.saved, ...coinResult.saved, ...fixedRows, ...fxAliases]
  const allFailed = [...yahooResult.failed, ...coinResult.failed]
  const results: Record<string, number> = {}
  for (const row of allSaved) results[row.ticker] = row.price

  await upsertPriceRows(allSaved, true)

  // 과거 30일 데이터가 없는 종목만 backfill — 신규 종목이 추가되면 자동으로 과거가 채워짐
  const sinceDate = new Date(tradingDate)
  sinceDate.setUTCDate(sinceDate.getUTCDate() - 30)
  const since = sinceDate.toISOString().slice(0, 10)

  // price_history 저장 형식(yahoo/coin ticker) 기준으로 종목별 가장 이른 날짜 조회
  const tickersToCheck = [...new Set([...yahooTickers, ...coinTickers])]
  const minRows = await sql<{ ticker: string; min_date: string }[]>`
    SELECT ticker, MIN(date)::text AS min_date
    FROM price_history
    WHERE ticker = ANY(${tickersToCheck})
    GROUP BY ticker
  `
  const minDateByTicker: Record<string, string> = {}
  for (const r of minRows ?? []) minDateByTicker[r.ticker] = r.min_date

  // 30일 이전 데이터가 없는 종목(신규 포함)의 raw 티커 추출 (USD 현금 제외)
  const backfillTickers = quoted
    .filter(s => s.ticker !== USD_CASH_TICKER)
    .filter(s => {
      const stored = s.asset_class === '코인' ? s.ticker : toYahooTicker(s.ticker, s.country)
      const min = minDateByTicker[stored]
      return !min || min > since
    })
    .map(s => s.ticker)

  let backfilled = 0
  if (backfillTickers.length > 0) {
    const hist = await fetchHistoricalPrices(since, today, backfillTickers)
    backfilled = hist.saved
    if (hist.failed.length > 0) console.warn('[refreshAllPrices] backfill failed:', hist.failed)
  }

  if (allFailed.length > 0) console.warn('[refreshAllPrices] failed:', allFailed)
  return { saved: allSaved.length, failed: allFailed, results, backfilled, backfillTickers }
}

// 페이지 로딩 시 사용: DB에서 읽기만 함 (Yahoo 호출 없음)
export async function getPrices(
  tickers: string[]
): Promise<Record<string, { price: number; currency: string }>> {
  return getPricesFromHistory(tickers)
}

// 날짜 범위의 과거 일별 종가를 Yahoo Finance / CoinGecko에서 수집
// onlyTickers를 주면 해당 raw 티커(securities.ticker)의 종목만 수집 (USDKRW=X 환율은 항상 포함)
export async function fetchHistoricalPrices(
  startDate: string,  // 'YYYY-MM-DD'
  endDate: string,    // 'YYYY-MM-DD'
  onlyTickers?: string[],
): Promise<{ saved: number; failed: string[]; tickers: string[] }> {
  const sql = getSql()
  const allSecurities = await sql<{ ticker: string; asset_class: string | null; country: string | null; currency: string | null; fixed_price: string | null }[]>`
    SELECT s.ticker, s.fixed_price,
           ac.value AS asset_class,
           co.value AS country,
           cu.value AS currency
    FROM securities s
    LEFT JOIN option_list ac ON s.asset_class_id = ac.id
    LEFT JOIN option_list co ON s.country_id     = co.id
    LEFT JOIN option_list cu ON s.currency_id    = cu.id
  `
  if (!allSecurities || allSecurities.length === 0) return { saved: 0, failed: [], tickers: [] }

  const securities = onlyTickers
    ? allSecurities.filter(s => onlyTickers.includes(s.ticker))
    : allSecurities

  const period1 = new Date(startDate)
  const period2 = new Date(endDate)

  // 고정단가 종목은 조회할 시세가 없다 — 과거 수집에서도 제외
  const quoted = securities.filter(s => fixedPriceOf(s) === null)
  const coinTickers = quoted.filter(s => s.asset_class === '코인').map(s => s.ticker)
  const yahooRaw = quoted.filter(s => s.asset_class !== '코인' && s.ticker !== USD_CASH_TICKER)
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
          // historical()은 Yahoo가 제거한 API(라이브러리가 chart()로 임시 매핑) → chart() 직접 호출
          const { quotes } = await withRetry<{ quotes: { date: Date | string; close: number | null }[] }>(() => yahooFinance.chart(ticker, {
            period1,
            period2,
            interval: '1d',
          }))
          const currency = ticker === 'USDKRW=X' ? 'KRW'
            : ticker.endsWith('.KS') ? 'KRW'
            : 'USD'
          for (const row of quotes ?? []) {
            // 실제 종가(close)를 쓴다. 배당 조정 종가(adjclose)는 이후 배당만큼 과거 가격을 깎은 값이라
            // 과거 스냅샷 평가액을 낮춘다(JEPI −5%, SCHD −2.4%). 일일 수집(regularMarketPrice)과도 기준이 같아진다.
            const price = row.close ?? 0
            if (!price || price <= 0) continue
            const dateStr = new Date(row.date).toISOString().slice(0, 10)
            allRows.push({ ticker, date: dateStr, price, currency, change_pct: null, exchange: null })
            // USDKRW=X → KRW=X(환율 조회용), USD(현금 종목용) alias
            if (ticker === 'USDKRW=X') {
              allRows.push({ ticker: 'KRW=X', date: dateStr, price, currency: 'KRW', change_pct: null, exchange: null })
              allRows.push({ ticker: 'USD', date: dateStr, price, currency: 'KRW', change_pct: null, exchange: null })
            }
          }
        } catch (err: unknown) {
          failed.push(`${ticker}: ${errorMessage(err)}`)
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
      // endDate는 UTC 00:00이므로 그대로 쓰면 마지막 날 데이터가 누락됨 → 하루치 더해 포함
      const to = Math.floor(period2.getTime() / 1000) + 86400
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
      failed.push(`${ticker}(coin): ${errorMessage(err)}`)
    }
  }

  // 같은 (ticker, date) 중복 제거 — 마지막 값 유지
  const deduped = Object.values(
    Object.fromEntries(allRows.map(r => [`${r.ticker}__${r.date}`, r]))
  )

  await upsertPriceRows(deduped, false)

  return {
    saved: deduped.length,
    failed,
    tickers: yahooTickers.concat(coinTickers),
  }
}
