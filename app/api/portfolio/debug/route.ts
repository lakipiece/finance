import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: secs } = await supabase
    .from('securities')
    .select('ticker, name, country, currency')
    .order('ticker')

  // country 값별 통계
  const countryStats: Record<string, number> = {}
  for (const s of secs ?? []) {
    const c = s.country ?? 'null'
    countryStats[c] = (countryStats[c] ?? 0) + 1
  }

  // currency 값별 통계
  const currencyStats: Record<string, number> = {}
  for (const s of secs ?? []) {
    const c = s.currency ?? 'null'
    currencyStats[c] = (currencyStats[c] ?? 0) + 1
  }

  // 453650 등 특정 종목 확인
  const sample = (secs ?? []).filter(s =>
    ['453650', '360200', 'SCHD', 'NVDA'].includes(s.ticker)
  )

  return NextResponse.json({ countryStats, currencyStats, sample })
}
