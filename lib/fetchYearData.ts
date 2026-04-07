import 'server-only'
import { getSql } from './db'
import { aggregateExpenses } from './aggregateExpenses'
import { cached } from './cache'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchYearData(year: number): Promise<DashboardData | null> {
  return cached(`year-${year}`, () => fetchYearDataUncached(year))
}

async function fetchYearDataUncached(year: number): Promise<DashboardData | null> {
  const sql = getSql()
  const data = await sql<RawExpenseRow[]>`
    SELECT year, month, expense_date, category, detail, memo, method, amount, member
    FROM expenses
    WHERE year = ${year}
  `

  if (!data || data.length === 0) return null

  const rows: RawExpenseRow[] = data.map((e: any) => ({
    year: e.year ?? year,
    month: e.month,
    expense_date: e.expense_date ?? '',
    category: e.category ?? '',
    detail: e.detail ?? '',
    memo: e.memo ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
    member: e.member ?? null,
  }))

  return aggregateExpenses(rows)
}
