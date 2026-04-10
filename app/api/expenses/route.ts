export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const yearStr = params.get('year')
  const category = params.get('category')
  const detail = params.get('detail')
  const month = params.get('month')

  const year = yearStr ? parseInt(yearStr) : null
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const sql = getSql()

  const rows = await sql`
    SELECT year, month, expense_date, category, detail, memo, method, amount, member
    FROM expenses
    WHERE year = ${year}
    ${category ? sql`AND category = ${category}` : sql``}
    ${detail ? sql`AND detail = ${detail}` : sql``}
    ${month ? sql`AND month = ${parseInt(month)}` : sql``}
    ORDER BY expense_date
  `

  const expenses = rows.map((e: any) => ({
    year: e.year,
    date: e.expense_date instanceof Date ? e.expense_date.toISOString().slice(0, 10) : (e.expense_date ?? ''),
    month: e.month,
    category: e.category ?? '',
    detail: e.detail ?? '',
    memo: e.memo ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
    member: e.member ?? null,
  }))

  return NextResponse.json({ expenses })
}
