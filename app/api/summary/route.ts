import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { cached } from '@/lib/cache'

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null
  if (!year || isNaN(year)) return NextResponse.json({ error: 'year required' }, { status: 400 })

  try {
    const data = await cached(`summary-${year}`, () => fetchSummary(year))
    const res = NextResponse.json(data)
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}

async function fetchSummary(year: number) {
  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const CATS = ['고정비', '대출상환', '변동비', '여행공연비']

  // Try RPC first, fall back to row-level query
  const monthly: Record<number, Record<string, number>> = {}

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_summary', { p_year: year })

  if (!rpcError && rpcData) {
    for (const r of rpcData as { month: number; category: string; total: any }[]) {
      if (!monthly[r.month]) monthly[r.month] = {}
      monthly[r.month][r.category] = Number(r.total)
    }
  } else {
    // Fallback: fetch rows and aggregate in JS
    let offset = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('expenses')
        .select('month,category,amount')
        .eq('year', year)
        .range(offset, offset + pageSize - 1)
      if (error || !data || data.length === 0) break
      for (const r of data) {
        if (!monthly[r.month]) monthly[r.month] = {}
        monthly[r.month][r.category] = (monthly[r.month][r.category] ?? 0) + r.amount
      }
      if (data.length < pageSize) break
      offset += pageSize
    }
  }

  const monthlyList = MONTHS.map((name, i) => {
    const m = i + 1
    const d = monthly[m] ?? {}
    const entry: any = { month: name, total: 0 }
    for (const cat of CATS) {
      entry[cat] = d[cat] ?? 0
      entry.total += entry[cat]
    }
    return entry
  })

  const categoryTotals: any = {}
  for (const cat of CATS) {
    categoryTotals[cat] = monthlyList.reduce((s: number, m: any) => s + m[cat], 0)
  }
  const total = monthlyList.reduce((s: number, m: any) => s + m.total, 0)

  return { year, total, categoryTotals, monthlyList }
}
