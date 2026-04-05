import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yahooFinance = new YahooFinance()

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker } = await req.json()
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)

  try {
    const quote = await yahooFinance.quote(ticker)
    const price = (quote as any).regularMarketPrice ?? 0
    const currency = (quote as any).currency ?? 'USD'

    if (price <= 0) {
      return NextResponse.json({ error: `가격 조회 실패: price=0` }, { status: 422 })
    }

    await supabase
      .from('price_history')
      .upsert({ ticker, date: today, price, currency }, { onConflict: 'ticker,date' })

    return NextResponse.json({ ticker, price, currency })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 422 }
    )
  }
}
