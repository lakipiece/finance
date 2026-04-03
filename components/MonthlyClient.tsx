'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, MonthlyData } from '@/lib/types'
import { useFilter } from '@/lib/FilterContext'
import KpiCards from './KpiCards'
import DrilldownPanel from './DrilldownPanel'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" />,
})
const CategorySection = dynamic(() => import('./CategorySection'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[260px]" />,
})
const CategoryDetailChart = dynamic(() => import('./CategoryDetailChart'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" />,
})

interface Props {
  data: DashboardData
  year: number
}

export default function MonthlyClient({ data, year }: Props) {
  const { excludeLoan } = useFilter()
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [chartCategory, setChartCategory] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null)

  // Apply excludeLoan filter
  const filteredData: DashboardData = excludeLoan ? {
    ...data,
    allExpenses: data.allExpenses.filter(e => e.category !== '대출상환'),
    total: data.total - data.categoryTotals.대출상환,
    categoryTotals: { ...data.categoryTotals, 대출상환: 0 },
    monthlyAvg: Math.round((data.total - data.categoryTotals.대출상환) / 12),
    monthlyList: data.monthlyList.map(m => ({ ...m, 대출상환: 0, total: m.total - m.대출상환 })),
  } : data

  function handleMonthSelect(month: number) {
    setSelectedMonth(prev => prev === month ? null : month)
  }

  function handleChartCategoryToggle(cat: string) {
    setChartCategory(prev => {
      const next = prev === cat ? null : cat
      setSelectedCategory(next)
      setSelectedDetail(null)
      return next
    })
  }

  function handleCategorySelect(cat: string) {
    setSelectedCategory(prev => (prev === cat ? null : cat))
    setSelectedDetail(null)
  }

  const displayExpenses = (() => {
    let result = filteredData.allExpenses
    if (selectedMonth) result = result.filter(e => e.month === selectedMonth)
    if (chartCategory) result = result.filter(e => e.category === chartCategory)
    return result
  })()

  const cumulativeMonthData: MonthlyData = {
    month: `${year}년 전체`,
    고정비: filteredData.categoryTotals.고정비,
    대출상환: filteredData.categoryTotals.대출상환,
    변동비: filteredData.categoryTotals.변동비,
    여행공연비: filteredData.categoryTotals.여행공연비,
    total: filteredData.total,
  }

  const displayMonthData = selectedMonth
    ? filteredData.monthlyList[selectedMonth - 1]
    : cumulativeMonthData

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <KpiCards data={filteredData} year={year} activeCategory={chartCategory} onCategoryClick={handleChartCategoryToggle} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-slate-700">{year}년 월별 지출 현황</h2>
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
        <p className="text-xs text-slate-400 mb-4">
          {chartCategory
            ? `${chartCategory} 필터 적용 중`
            : '막대를 클릭하면 해당 월 상세 내역을 볼 수 있습니다'}
        </p>
        <MonthlyChart
          monthlyList={filteredData.monthlyList}
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
          highlightCategory={chartCategory}
        />
      </div>

      {/* Category Analysis */}
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

      <DrilldownPanel
        key={selectedMonth ?? 'all'}
        monthData={displayMonthData}
        expenses={displayExpenses}
        allExpenses={filteredData.allExpenses}
        monthlyList={filteredData.monthlyList}
        onClose={selectedMonth !== null ? () => setSelectedMonth(null) : null}
      />
    </div>
  )
}
