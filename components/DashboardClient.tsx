'use client'

import { useState, useEffect } from 'react'
import type { MonthlyData, ExpenseItem, CategoryTotal } from '@/lib/types'
import { useFilter } from '@/lib/FilterContext'
import DrilldownPanel from './DrilldownPanel'
import YearPicker from './YearPicker'
import type { IncomeRow } from './IncomeTableCard'

export interface SummaryData {
  year: number
  total: number
  categoryTotals: CategoryTotal
  monthlyList: MonthlyData[]
}

export interface CategoryDetailsData {
  category: string
  details: { name: string; amount: number }[]
  detailMonthly: Record<string, number[]>
}

export default function DashboardClient({ year }: { year: number }) {
  const { excludeLoan } = useFilter()
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedCat, setSelectedCatRaw] = useState<string | null>(null)
  const [selectedTrendDetail, setSelectedTrendDetail] = useState<string | null>(null)
  const [drilldownType, setDrilldownType] = useState<'income' | 'expense'>('expense')

  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [incomeSummary, setIncomeSummary] = useState<{
    total: number
    categoryTotals: { 급여: number; 기타: number }
    monthlyList: Array<{ month: string; total: number; 급여: number; 기타: number }>
  } | null>(null)
  const [incomes, setIncomes] = useState<IncomeRow[] | null>(null)
  const [incomesLoading, setIncomesLoading] = useState(false)

  const [catDetails, setCatDetails] = useState<CategoryDetailsData | null>(null)
  const [catDetailsLoading, setCatDetailsLoading] = useState(false)

  const [expenses, setExpenses] = useState<ExpenseItem[] | null>(null)
  const [expensesLoading, setExpensesLoading] = useState(false)

  // Fetch summary on mount or year change
  useEffect(() => {
    setSummaryLoading(true)
    setSummary(null)
    setSummaryError(null)
    setSelectedMonth(null)
    setSelectedCatRaw(null)
    setSelectedTrendDetail(null)
    fetch(`/api/summary?year=${year}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setSummaryError(data.error)
        else setSummary(data)
      })
      .catch(e => setSummaryError(e.message))
      .finally(() => setSummaryLoading(false))
  }, [year])

  // Fetch income summary on year change
  useEffect(() => {
    fetch(`/api/incomes/summary?year=${year}`)
      .then(r => r.json())
      .then(data => { if (!data.error) setIncomeSummary(data) })
      .catch(() => {})
  }, [year])

  // Fetch incomes for table whenever month/drilldownType changes
  useEffect(() => {
    if (drilldownType !== 'income') return
    const params = new URLSearchParams({ year: String(year) })
    if (selectedMonth) params.set('month', String(selectedMonth))
    setIncomesLoading(true)
    setIncomes(null)
    fetch(`/api/incomes?${params}`)
      .then(r => r.json())
      .then(data => setIncomes(Array.isArray(data) ? data : []))
      .catch(() => setIncomes([]))
      .finally(() => setIncomesLoading(false))
  }, [year, selectedMonth, drilldownType])

  // Fetch category details when category selected
  useEffect(() => {
    if (!selectedCat || selectedCat === '__all__') {
      setCatDetails(null)
      return
    }
    setCatDetailsLoading(true)
    setCatDetails(null)
    fetch(`/api/category-details?year=${year}&category=${encodeURIComponent(selectedCat)}`)
      .then(r => r.json())
      .then(setCatDetails)
      .finally(() => setCatDetailsLoading(false))
  }, [year, selectedCat])

  // Fetch expenses for table whenever filters change
  useEffect(() => {
    const params = new URLSearchParams({ year: String(year) })
    if (selectedCat && selectedCat !== '__all__') params.set('category', selectedCat)
    if (selectedTrendDetail) params.set('detail', selectedTrendDetail)
    if (selectedMonth) params.set('month', String(selectedMonth))

    setExpensesLoading(true)
    setExpenses(null)
    fetch(`/api/expenses?${params}`)
      .then(r => r.json())
      .then(data => setExpenses(data.expenses ?? []))
      .finally(() => setExpensesLoading(false))
  }, [year, selectedCat, selectedTrendDetail, selectedMonth])

  function handleCategorySelect(cat: string | null) {
    setSelectedCatRaw(cat)
    setSelectedTrendDetail(null)
  }

  if (summaryLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
            </div>
            <div className="h-56 bg-slate-100 rounded-xl" />
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="animate-pulse h-40 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }

  if (summaryError) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
          <p className="text-red-400 text-sm mb-2">데이터를 불러오지 못했습니다</p>
          <p className="text-slate-300 text-xs">{summaryError}</p>
        </div>
      </div>
    )
  }

  if (!summary) return null

  // Apply excludeLoan filter
  const filteredSummary: SummaryData = excludeLoan ? {
    ...summary,
    total: summary.total - summary.categoryTotals.대출상환,
    categoryTotals: { ...summary.categoryTotals, 대출상환: 0 },
    monthlyList: summary.monthlyList.map(m => ({
      ...m,
      대출상환: 0,
      total: m.total - m.대출상환,
    })),
  } : summary

  const cumulativeMonthData: MonthlyData = {
    month: `${year}년 전체`,
    고정비: filteredSummary.categoryTotals.고정비,
    대출상환: filteredSummary.categoryTotals.대출상환,
    변동비: filteredSummary.categoryTotals.변동비,
    여행공연비: filteredSummary.categoryTotals.여행공연비,
    total: filteredSummary.total,
  }

  const displayMonthData = selectedMonth
    ? filteredSummary.monthlyList[selectedMonth - 1]
    : cumulativeMonthData

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>가계부 대시보드</h1>
        <YearPicker variant="light" />
      </div>
      <DrilldownPanel
        monthData={displayMonthData}
        monthlyList={filteredSummary.monthlyList}
        selectedMonth={selectedMonth}
        onClose={selectedMonth !== null ? () => setSelectedMonth(null) : null}
        onMonthSelect={month => setSelectedMonth(prev => prev === month ? null : month)}
        selectedCat={selectedCat}
        setSelectedCat={handleCategorySelect}
        selectedTrendDetail={selectedTrendDetail}
        setSelectedTrendDetail={setSelectedTrendDetail}
        drilldownType={drilldownType}
        setDrilldownType={setDrilldownType}
        catDetails={catDetails}
        catDetailsLoading={catDetailsLoading}
        expenses={expenses}
        expensesLoading={expensesLoading}
        incomeMonthData={{
          total: selectedMonth
            ? (incomeSummary?.monthlyList[selectedMonth - 1]?.total ?? 0)
            : (incomeSummary?.total ?? 0),
          급여: selectedMonth
            ? (incomeSummary?.monthlyList[selectedMonth - 1]?.급여 ?? 0)
            : (incomeSummary?.categoryTotals.급여 ?? 0),
          기타: selectedMonth
            ? (incomeSummary?.monthlyList[selectedMonth - 1]?.기타 ?? 0)
            : (incomeSummary?.categoryTotals.기타 ?? 0),
        }}
        incomeMonthlyList={incomeSummary?.monthlyList ?? Array.from({ length: 12 }, (_, i) => ({
          month: `${i + 1}월`, total: 0, 급여: 0, 기타: 0,
        }))}
        incomes={incomes}
        incomesLoading={incomesLoading}
      />
    </div>
  )
}
