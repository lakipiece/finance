'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, MonthlyData, CategoryTotal } from '@/lib/types'
import { useFilter } from '@/lib/FilterContext'
import KpiCards from './KpiCards'
import ExpenseTable from './ExpenseTable'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <ChartPlaceholder h={300} /> })
const CategorySection = dynamic(() => import('./CategorySection'), { ssr: false, loading: () => <ChartPlaceholder h={260} /> })
const CategoryDetailChart = dynamic(() => import('./CategoryDetailChart'), { ssr: false, loading: () => <ChartPlaceholder h={300} /> })

function ChartPlaceholder({ h }: { h: number }) {
  return <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: h }} />
}

interface Props {
  data: DashboardData
  year: number
}

export default function Dashboard({ data, year }: Props) {
  const { excludeLoan } = useFilter()
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null)
  const [chartCategory, setChartCategory] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Apply excludeLoan filter to data
  const filteredData = useMemo((): DashboardData => {
    if (!excludeLoan) return data
    const expenses = data.allExpenses.filter(e => e.category !== '대출상환')
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const catTotals = { ...data.categoryTotals, 대출상환: 0 } as CategoryTotal
    const monthlyList = data.monthlyList.map(m => ({ ...m, 대출상환: 0, total: m.total - m.대출상환 })) as MonthlyData[]
    return {
      ...data,
      allExpenses: expenses,
      total,
      categoryTotals: catTotals,
      monthlyAvg: Math.round(total / 12),
      monthlyList,
    }
  }, [data, excludeLoan])

  // Apply chartCategory (KPI card filter) to expenses for table/sections
  const activeCategory = chartCategory ?? selectedCategory

  const sortedExpenses = useMemo(() =>
    [...filteredData.allExpenses].sort((a, b) => b.amount - a.amount),
    [filteredData.allExpenses]
  )

  const filteredExpenses = useMemo(() => {
    let result = sortedExpenses
    if (chartCategory) {
      result = result.filter(e => e.category === chartCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        e.detail.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.method.toLowerCase().includes(q) ||
        e.memo.toLowerCase().includes(q)
      )
    }
    return result
  }, [sortedExpenses, searchQuery, chartCategory])

  function handleCategorySelect(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat))
    setSelectedDetail(null)
  }

  function handleChartCategoryToggle(cat: string) {
    setChartCategory(prev => {
      const next = prev === cat ? null : cat
      // Sync selectedCategory with chartCategory for sections below
      setSelectedCategory(next)
      setSelectedDetail(null)
      return next
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <KpiCards data={filteredData} year={year} activeCategory={chartCategory} onCategoryClick={handleChartCategoryToggle} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-700">월별 지출 현황</h2>
          {chartCategory && (
            <button
              onClick={() => { setChartCategory(null); setSelectedCategory(null); setSelectedDetail(null) }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              전체 보기
            </button>
          )}
        </div>
        {chartCategory && (
          <p className="text-xs text-slate-400 mb-2">{chartCategory} 필터 적용 중</p>
        )}
        <MonthlyChart
          monthlyList={filteredData.monthlyList}
          selectedMonth={null}
          onMonthSelect={() => {}}
          highlightCategory={chartCategory}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">분류별 지출</h2>
          <CategorySection
            data={filteredData}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">
            {selectedCategory ? `${selectedCategory} 전체 내역` : '전체 내역 TOP 10'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {selectedCategory ? '좌측 도넛 분류 클릭으로 필터' : '좌측 도넛 클릭시 분류별 전체 내역'}
          </p>
          <CategoryDetailChart
            allExpenses={filteredData.allExpenses}
            selectedCategory={selectedCategory}
            selectedDetail={selectedDetail}
            onDetailSelect={setSelectedDetail}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-slate-700">
            {selectedDetail
              ? `${selectedCategory} > ${selectedDetail} 지출 내역`
              : selectedCategory
              ? `${selectedCategory} 주요 지출 내역`
              : '주요 지출 내역'}
          </h2>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 w-64"
          />
        </div>
        <ExpenseTable expenses={filteredExpenses} selectedCategory={selectedCategory} selectedDetail={selectedDetail} />
      </div>
    </div>
  )
}
