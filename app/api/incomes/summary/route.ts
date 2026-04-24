export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const year = req.nextUrl.searchParams.get('year')
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })
  try {
    const sql = getSql()
    const [totals] = await sql`
      SELECT
        COALESCE(SUM(amount), 0)::int                                          AS total,
        COALESCE(SUM(CASE WHEN category = '급여'   THEN amount END), 0)::int   AS salary,
        COALESCE(SUM(CASE WHEN category = '보너스' THEN amount END), 0)::int   AS bonus,
        COALESCE(SUM(CASE WHEN category = '기타'   THEN amount END), 0)::int   AS other
      FROM incomes WHERE year = ${parseInt(year)}
    `
    const monthly = await sql`
      SELECT
        month,
        COALESCE(SUM(amount), 0)::int                                          AS total,
        COALESCE(SUM(CASE WHEN category = '급여'   THEN amount END), 0)::int   AS salary,
        COALESCE(SUM(CASE WHEN category = '보너스' THEN amount END), 0)::int   AS bonus,
        COALESCE(SUM(CASE WHEN category = '기타'   THEN amount END), 0)::int   AS other
      FROM incomes WHERE year = ${parseInt(year)}
      GROUP BY month ORDER BY month
    `
    return NextResponse.json({ totals, monthly })
  } catch (e) {
    console.error('[GET /incomes/summary]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
