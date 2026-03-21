import 'server-only'
import { supabase } from './supabase'
import { aggregateExpenses } from './aggregateExpenses'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchYearData(year: number): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('year', year)

  if (error) throw new Error(`Supabase 오류: ${error.message}`)

  const rows: RawExpenseRow[] = (data ?? []).map((e: any) => ({
    year: e.year ?? year,
    month: e.month,
    expense_date: e.expense_date ?? '',
    category: e.category ?? '',
    detail: e.detail ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
  }))

  return aggregateExpenses(rows)
}
