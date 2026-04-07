export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
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
  const sql = getSql()
  const detailTotals: Record<string, number> = {}
  const detailMonthly: Record<string, number[]> = {}

  const rows = await sql`
    SELECT month, detail, SUM(amount)::int as total
    FROM expenses
    WHERE year = ${year} AND category = ${category}
    GROUP BY month, detail
    ORDER BY month, detail
  `

  for (const r of rows as unknown as { month: number; detail: string; total: any }[]) {
    const key = r.detail || '기타'
    detailTotals[key] = (detailTotals[key] ?? 0) + Number(r.total)
    if (!detailMonthly[key]) detailMonthly[key] = Array(12).fill(0)
    detailMonthly[key][r.month - 1] += Number(r.total)
  }

  const details = Object.entries(detailTotals)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  return { category, details, detailMonthly }
}
