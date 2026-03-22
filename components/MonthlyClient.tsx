'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import DrilldownPanel from './DrilldownPanel'
import CategoryDetailTable from './CategoryDetailTable'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <div className="animate-pulse bg-slate-100 rounded-xl h-[300px]" /> })

interface Props {
  data: DashboardData
  year: number
}

export default function MonthlyClient({ data, year }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  function handleMonthSelect(month: number) {
    setSelectedMonth((prev) => (prev === month ? null : month))
  }

  const monthExpenses = selectedMonth
    ? data.allExpenses.filter((e) => e.month === selectedMonth)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 현황</h2>
        <p className="text-xs text-slate-400 mb-4">막대를 클릭하면 해당 월 상세 내역을 볼 수 있습니다</p>
        <MonthlyChart
          monthlyList={data.monthlyList}
          selectedMonth={selectedMonth}
          onMonthSelect={handleMonthSelect}
        />
      </div>

      {selectedMonth && (
        <DrilldownPanel
          monthData={data.monthlyList[selectedMonth - 1]}
          expenses={monthExpenses}
          onClose={() => setSelectedMonth(null)}
        />
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">분류별 내역 집계</h2>
        <CategoryDetailTable allExpenses={data.allExpenses} />
      </div>
    </div>
  )
}
