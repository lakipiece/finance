export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year')
  const monthParam = req.nextUrl.searchParams.get('month')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
  try {
    const sql = getSql()
    const month = monthParam ? parseInt(monthParam) : null
    const rows = await sql`
      SELECT id, income_date, year, month, category, description, amount, member
      FROM incomes
      WHERE year = ${parseInt(year)}
      ${month ? sql`AND month = ${month}` : sql``}
      ORDER BY income_date DESC, id DESC
    `
    return NextResponse.json(rows.map((r) => ({
      ...r,
      income_date: r.income_date instanceof Date
        ? r.income_date.toISOString().slice(0, 10)
        : r.income_date,
    })))
  } catch (e) {
    console.error('[GET /incomes]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { income_date, category, description, amount, member } = await req.json()
    if (!income_date || !category || !amount || amount <= 0) {
      return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 })
    }
    const d = new Date(income_date)
    if (isNaN(d.getTime())) return NextResponse.json({ error: '잘못된 날짜' }, { status: 400 })
    const sql = getSql()
    const [row] = await sql`
      INSERT INTO incomes (income_date, year, month, category, description, amount, member)
      VALUES (${income_date}, ${d.getFullYear()}, ${d.getMonth() + 1}, ${category}, ${description ?? ''}, ${amount}, ${member ?? null})
      RETURNING id, income_date, year, month, category, description, amount, member
    `
    return NextResponse.json({
      ...row,
      income_date: row.income_date instanceof Date
        ? row.income_date.toISOString().slice(0, 10)
        : row.income_date,
    })
  } catch (e) {
    console.error('[POST /incomes]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
