import 'server-only'
import { supabase } from './supabase'
import { aggregateExpenses } from './aggregateExpenses'
import { cached } from './cache'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchYearData(year: number): Promise<DashboardData | null> {
  return cached(`year-${year}`, () => fetchYearDataUncached(year))
}

async function fetchYearDataUncached(year: number): Promise<DashboardData | null> {
  const allRows: any[] = []
  const pageSize = 1000
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from('expenses')
      .select('year,month,expense_date,category,detail,memo,method,amount')
      .eq('year', year)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(`Supabase 오류: ${error.message}`)
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < pageSize) break
    offset += pageSize
  }

  if (allRows.length === 0) return null

  const rows: RawExpenseRow[] = allRows.map((e: any) => ({
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
