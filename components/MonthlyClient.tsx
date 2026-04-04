'use client'

import { useState } from 'react'
import type { DashboardData, MonthlyData } from '@/lib/types'
import { useFilter } from '@/lib/FilterContext'
import DrilldownPanel from './DrilldownPanel'

interface Props {
  data: DashboardData
  year: number
}

export default function MonthlyClient({ data, year }: Props) {
  const { excludeLoan } = useFilter()
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)

  // Apply excludeLoan filter
  const filteredData: DashboardData = excludeLoan ? {
    ...data,
    allExpenses: data.allExpenses.filter(e => e.category !== '대출상환'),
    total: data.total - data.categoryTotals.대출상환,
    categoryTotals: { ...data.categoryTotals, 대출상환: 0 },
    monthlyAvg: Math.round((data.total - data.categoryTotals.대출상환) / 12),
    monthlyList: data.monthlyList.map(m => ({ ...m, 대출상환: 0, total: m.total - m.대출상환 })),
  } : data

  const displayExpenses = selectedMonth
    ? filteredData.allExpenses.filter(e => e.month === selectedMonth)
    : filteredData.allExpenses

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

  function handleMonthSelect(month: number) {
    setSelectedMonth(prev => prev === month ? null : month)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <DrilldownPanel
        key={selectedMonth ?? 'all'}
        monthData={displayMonthData}
        expenses={displayExpenses}
        allExpenses={filteredData.allExpenses}
        monthlyList={filteredData.monthlyList}
        onClose={selectedMonth !== null ? () => setSelectedMonth(null) : null}
        onMonthSelect={handleMonthSelect}
        selectedMonth={selectedMonth}
      />
    </div>
  )
}
