import 'server-only'
import { supabase } from './supabase'
import type { DashboardData, MonthlyData, CategoryTotal, ExpenseItem, DetailItem } from './types'

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

export async function fetchData(): Promise<DashboardData> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')

  if (error) throw new Error(`Supabase 오류: ${error.message}`)
  if (!data || data.length === 0) throw new Error('데이터가 없습니다. import-data 스크립트를 실행했는지 확인하세요.')

  const monthly: Record<number, Record<string, number>> = {}
  const methods: Record<string, number> = {}
  const detailByCat: Record<string, Record<string, number>> = {}

  for (const e of data) {
    const { month, category, detail, method, amount } = e
    if (!category || !amount) continue

    if (!monthly[month]) monthly[month] = {}
    monthly[month][category] = (monthly[month][category] ?? 0) + amount

    if (method) methods[method] = (methods[method] ?? 0) + amount

    if (!detailByCat[category]) detailByCat[category] = {}
    const key = detail || '기타'
    detailByCat[category][key] = (detailByCat[category][key] ?? 0) + amount
  }

  const monthlyList: MonthlyData[] = MONTH_NAMES.map((name, i) => {
    const m = i + 1
    const d = monthly[m] ?? {}
    const 고정비 = d['고정비'] ?? 0
    const 대출상환 = d['대출상환'] ?? 0
    const 변동비 = d['변동비'] ?? 0
    const 여행공연비 = d['여행공연비'] ?? 0
    return { month: name, 고정비, 대출상환, 변동비, 여행공연비, total: 고정비 + 대출상환 + 변동비 + 여행공연비 }
  })

  const total = monthlyList.reduce((s, m) => s + m.total, 0)

  const categoryTotals: CategoryTotal = {
    고정비: monthlyList.reduce((s, m) => s + m.고정비, 0),
    대출상환: monthlyList.reduce((s, m) => s + m.대출상환, 0),
    변동비: monthlyList.reduce((s, m) => s + m.변동비, 0),
    여행공연비: monthlyList.reduce((s, m) => s + m.여행공연비, 0),
  }

  const maxMonth = monthlyList.reduce((a, b) => a.total > b.total ? a : b)

  function toExpenseItem(e: Record<string, any>): ExpenseItem {
    return {
      date: e.expense_date ?? '',
      month: e.month,
      category: e.category,
      detail: e.detail ?? '',
      method: e.method ?? '',
      amount: e.amount,
    }
  }

  const sorted = [...data].sort((a, b) => b.amount - a.amount)
  const topExpenses = sorted.slice(0, 20).map(toExpenseItem)
  const allExpenses = data.map(toExpenseItem)

  function toDetailItems(cat: string): DetailItem[] {
    return Object.entries(detailByCat[cat] ?? {})
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }

  return {
    total,
    monthlyAvg: Math.round(total / 12),
    maxMonth,
    categoryTotals,
    monthlyList,
    paymentMethods: methods,
    topExpenses,
    variableDetail: toDetailItems('변동비'),
    fixedDetail: toDetailItems('고정비'),
    allExpenses,
  }
}
