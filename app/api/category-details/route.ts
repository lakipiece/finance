import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { cached } from '@/lib/cache'

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const category = req.nextUrl.searchParams.get('category')
  const year = yearStr ? parseInt(yearStr) : null
  if (!year || !category) return NextResponse.json({ error: 'year and category required' }, { status: 400 })

  try {
    const data = await cached(`cat-${year}-${category}`, () => fetchCategoryDetails(year, category))
    const res = NextResponse.json(data)
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}

async function fetchCategoryDetails(year: number, category: string) {
  const detailTotals: Record<string, number> = {}
  const detailMonthly: Record<string, number[]> = {}

  const { data: rpcData, error: rpcError } = await supabase.rpc('get_category_details', { p_year: year, p_category: category })

  const rows: { month: number; detail: string; amount: number }[] = []

  if (!rpcError && rpcData) {
    for (const r of rpcData as { month: number; detail: string; total: any }[]) {
      rows.push({ month: r.month, detail: r.detail, amount: Number(r.total) })
    }
  } else {
    // Fallback: row-level query
    let offset = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from('expenses')
        .select('month,detail,amount')
        .eq('year', year)
        .eq('category', category)
        .range(offset, offset + pageSize - 1)
      if (error || !data || data.length === 0) break
      for (const r of data) {
        rows.push({ month: r.month, detail: r.detail || '기타', amount: r.amount })
      }
      if (data.length < pageSize) break
      offset += pageSize
    }
  }

  for (const r of rows) {
    const key = r.detail || '기타'
    detailTotals[key] = (detailTotals[key] ?? 0) + r.amount
    if (!detailMonthly[key]) detailMonthly[key] = Array(12).fill(0)
    detailMonthly[key][r.month - 1] += r.amount
  }

  const details = Object.entries(detailTotals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  return { category, details, detailMonthly }
}
