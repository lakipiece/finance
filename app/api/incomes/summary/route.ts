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
        COALESCE(SUM(amount), 0)::int                                        AS total,
        COALESCE(SUM(CASE WHEN category = '급여' THEN amount END), 0)::int   AS "급여",
        COALESCE(SUM(CASE WHEN category != '급여' THEN amount END), 0)::int  AS "급여 외"
      FROM incomes WHERE year = ${parseInt(year)}
    `
    const monthlyRaw = await sql`
      SELECT
        month,
        COALESCE(SUM(amount), 0)::int                                        AS total,
        COALESCE(SUM(CASE WHEN category = '급여' THEN amount END), 0)::int   AS "급여",
        COALESCE(SUM(CASE WHEN category != '급여' THEN amount END), 0)::int  AS "급여 외"
      FROM incomes WHERE year = ${parseInt(year)}
      GROUP BY month ORDER BY month
    `

    const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

    type MonthlyRow = { month: number; total: number; 급여: number; '급여 외': number }
    const monthlyMap = Object.fromEntries((monthlyRaw as unknown as MonthlyRow[]).map(r => [r.month, r]))
    const monthlyList = Array.from({ length: 12 }, (_, i) => {
      const m = monthlyMap[i + 1]
      return {
        month: MONTH_LABELS[i],
        total:    m ? Number(m.total) : 0,
        급여:     m ? Number(m['급여']) : 0,
        '급여 외': m ? Number(m['급여 외']) : 0,
      }
    })

    return NextResponse.json({
      year: parseInt(year),
      total: Number(totals.total),
      categoryTotals: {
        급여:     Number(totals['급여']),
        '급여 외': Number(totals['급여 외']),
      },
      monthlyList,
    })
  } catch (e) {
    console.error('[GET /incomes/summary]', e)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}
