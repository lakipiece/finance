import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  // securities currency 현황
  const { data: secs } = await supabase
    .from('securities')
    .select('ticker, name, country, currency')
    .order('country')

  // KR 종목 중 currency=USD 잘못된 것들
  const wrongCurrency = (secs ?? []).filter(s => s.country === 'KR' && s.currency === 'USD')

  // Yahoo Finance 한국 ETF 샘플 테스트
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const YahooFinance = require('yahoo-finance2').default
  const yf = new YahooFinance()
  const testTickers = ['453650.KS', '360200.KS', '005930.KS']
  const priceResults: Record<string, unknown> = {}
  for (const t of testTickers) {
    try {
      // @ts-ignore
      const q = await yf.quote(t)
      priceResults[t] = { ok: true, price: (q as any).regularMarketPrice }
    } catch (e: unknown) {
      priceResults[t] = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return NextResponse.json({
    totalSecurities: secs?.length,
    wrongCurrencyCount: wrongCurrency.length,
    wrongCurrencySample: wrongCurrency.slice(0, 5).map(s => ({ ticker: s.ticker, name: s.name })),
    priceResults,
  })
}
