export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

interface BudgetItemInput {
  id?: number | null
  category: string
  detail: string
  annual_plan: number
  sort_order?: number
  note?: string
}

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null
  if (!year || isNaN(year)) {
    return NextResponse.json({ error: 'year required' }, { status: 400 })
  }

  const sql = getSql()

  const [items, weeklyRows, usageByDetailRows, usageByCategoryRows, usageWeeklyRows, detailOptRows] = await Promise.all([
    sql`
      SELECT id, category, detail, annual_plan, sort_order, note
      FROM budget_items
      WHERE year = ${year}
      ORDER BY category, sort_order, id
    `,
    sql`SELECT weekly_amount FROM budget_weekly WHERE year = ${year}`,
    sql`
      SELECT category, COALESCE(detail, '') AS detail, COALESCE(SUM(amount), 0)::INT AS total
      FROM expenses
      WHERE year = ${year}
      GROUP BY category, detail
    `,
    sql`
      SELECT category, COALESCE(SUM(amount), 0)::INT AS total
      FROM expenses
      WHERE year = ${year}
      GROUP BY category
    `,
    sql`
      SELECT
        EXTRACT(WEEK FROM expense_date)::INT AS week,
        COALESCE(SUM(amount), 0)::INT AS total
      FROM expenses
      WHERE year = ${year} AND category = '변동비' AND expense_date IS NOT NULL
      GROUP BY week
      ORDER BY week
    `,
    sql`
      SELECT name, COALESCE(category, '') AS category, COALESCE(order_idx, 0) AS order_idx
      FROM detail_options
      WHERE is_active = true AND COALESCE(category, '') <> ''
      ORDER BY category, order_idx, name
    `,
  ])

  const usageByDetail: Record<string, Record<string, number>> = {}
  for (const r of usageByDetailRows as unknown as { category: string; detail: string; total: number }[]) {
    const cat = r.category
    if (!usageByDetail[cat]) usageByDetail[cat] = {}
    usageByDetail[cat][r.detail || ''] = r.total
  }

  const usageByCategory: Record<string, number> = {}
  for (const r of usageByCategoryRows as unknown as { category: string; total: number }[]) {
    usageByCategory[r.category] = r.total
  }

  const weeklyUsage: Record<number, number> = {}
  for (const r of usageWeeklyRows as unknown as { week: number; total: number }[]) {
    weeklyUsage[r.week] = r.total
  }

  return NextResponse.json({
    year,
    items,
    weeklyAmount: (weeklyRows[0] as { weekly_amount?: number } | undefined)?.weekly_amount ?? 0,
    initialized: items.length > 0 || weeklyRows.length > 0,
    detailOptions: detailOptRows,
    usageByDetail,
    usageByCategory,
    weeklyUsage,
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const year = parseInt(body.year)
    if (!year || isNaN(year)) {
      return NextResponse.json({ error: 'year required' }, { status: 400 })
    }
    const items: BudgetItemInput[] = Array.isArray(body.items) ? body.items : []
    const weeklyAmount = Math.max(0, parseInt(body.weeklyAmount ?? 0) || 0)

    const sql = getSql()
    await sql.begin(async (sql) => {
      const keep: number[] = []
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const cat = (it.category ?? '').trim()
        const detail = (it.detail ?? '').trim()
        const annual = Math.max(0, parseInt(String(it.annual_plan)) || 0)
        const order = typeof it.sort_order === 'number' ? it.sort_order : i
        const note = (it.note ?? '').trim()
        if (!cat) continue

        const [row] = await sql`
          INSERT INTO budget_items (year, category, detail, annual_plan, sort_order, note)
          VALUES (${year}, ${cat}, ${detail}, ${annual}, ${order}, ${note})
          ON CONFLICT (year, category, detail) DO UPDATE
            SET annual_plan = EXCLUDED.annual_plan,
                sort_order  = EXCLUDED.sort_order,
                note        = EXCLUDED.note
          RETURNING id
        `
        keep.push(row.id)
      }

      if (keep.length > 0) {
        await sql`DELETE FROM budget_items WHERE year = ${year} AND id NOT IN ${sql(keep)}`
      } else {
        await sql`DELETE FROM budget_items WHERE year = ${year}`
      }

      await sql`
        INSERT INTO budget_weekly (year, weekly_amount)
        VALUES (${year}, ${weeklyAmount})
        ON CONFLICT (year) DO UPDATE SET weekly_amount = EXCLUDED.weekly_amount
      `
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[PUT /api/budgets]', e)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
