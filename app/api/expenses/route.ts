export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const yearStr = params.get('year')
  const category = params.get('category')
  const detail = params.get('detail')
  const month = params.get('month')
  const all = params.get('all') === '1'
  const q = params.get('q')?.trim() || null

  const year = yearStr ? parseInt(yearStr) : null
  if (!all && !year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  const sql = getSql()
  const like = q ? `%${q}%` : ''

  const rows = await sql`
    SELECT id, year, month, expense_date, category, detail, memo, method, amount, member
    FROM expenses
    WHERE 1=1
    ${!all && year ? sql`AND year = ${year}` : sql``}
    ${category ? sql`AND category = ${category}` : sql``}
    ${detail ? sql`AND detail = ${detail}` : sql``}
    ${!all && month ? sql`AND month = ${parseInt(month)}` : sql``}
    ${q ? sql`AND (
      COALESCE(detail, '') ILIKE ${like}
      OR COALESCE(category, '') ILIKE ${like}
      OR COALESCE(memo, '') ILIKE ${like}
      OR COALESCE(method, '') ILIKE ${like}
      OR COALESCE(member, '') ILIKE ${like}
      OR expense_date::text ILIKE ${like}
    )` : sql``}
    ORDER BY expense_date DESC, id DESC
  `

  const expenses = rows.map((e: any) => ({
    id: e.id,
    year: e.year,
    expense_date: e.expense_date instanceof Date ? e.expense_date.toISOString().slice(0, 10) : (e.expense_date ?? ''),
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
