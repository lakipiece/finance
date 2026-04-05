import { NextResponse } from 'next/server'
import yahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 직접 Yahoo Finance 호출 테스트
  for (const ticker of ['SCHD', 'KRW=X']) {
    try {
      // @ts-ignore
      const quote = await yahooFinance.quote(ticker)
      results[ticker] = {
        ok: true,
        price: (quote as any)?.regularMarketPrice,
        currency: (quote as any)?.currency,
      }
    } catch (err: unknown) {
      results[ticker] = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  // 외부 네트워크 연결 테스트
  let networkOk = false
  let networkError: string | null = null
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/SCHD?interval=1d&range=1d')
    networkOk = res.ok
    networkError = res.ok ? null : `HTTP ${res.status}`
  } catch (err: unknown) {
    networkError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({ yahooResults: results, networkOk, networkError })
}
