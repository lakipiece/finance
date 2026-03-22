'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData, MonthlyData } from '@/lib/types'
import DrilldownPanel from './DrilldownPanel'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" />,
})

interface Props {
  data: DashboardData
  year: number
}

export default function MonthlyClient({ data, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  function handleMonthSelect(month: number) {
    setSelectedMonth(prev => prev === month ? null : month)
  }

  const displayExpenses = selectedMonth
    ? data.allExpenses.filter(e => e.month === selectedMonth)
    : data.allExpenses

  // Cumulative monthData for when no month is selected
  const cumulativeMonthData: MonthlyData = {
    month: `${year}년 전체`,
    고정비: data.categoryTotals.고정비,
    대출상환: data.categoryTotals.대출상환,
    변동비: data.categoryTotals.변동비,
    여행공연비: data.categoryTotals.여행공연비,
    total: data.total,
  }

  const displayMonthData = selectedMonth
    ? data.monthlyList[selectedMonth - 1]
    : cumulativeMonthData

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">
          {year}년 월별 지출 현황
        </h2>
        <p className="text-xs text-slate-400 mb-4">막대를 클릭하면 해당 월 상세 내역을 볼 수 있습니다</p>
        <MonthlyChart
          monthlyList={data.monthlyList}
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
        />
      </div>

      <DrilldownPanel
        monthData={displayMonthData}
        expenses={displayExpenses}
        onClose={selectedMonth !== null ? () => setSelectedMonth(null) : null}
      />
    </div>
  )
}
