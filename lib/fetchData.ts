import 'server-only'
import { supabase } from './supabase'
import { aggregateExpenses } from './aggregateExpenses'
import type { DashboardData, RawExpenseRow } from './types'

export async function fetchData(): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')

  if (error) throw new Error(`Supabase 오류: ${error.message}`)
  if (!data || data.length === 0) throw new Error('데이터가 없습니다.')

  const rows: RawExpenseRow[] = data.map((e: any) => ({
    year: e.year ?? 0,
    month: e.month,
    expense_date: e.expense_date ?? '',
    category: e.category ?? '',
    detail: e.detail ?? '',
    method: e.method ?? '',
    amount: e.amount ?? 0,
  }))

  return aggregateExpenses(rows)
}
