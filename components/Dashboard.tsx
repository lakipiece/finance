'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import KpiCards from './KpiCards'
import ExpenseTable from './ExpenseTable'

const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <ChartPlaceholder h={300} /> })
const CategorySection = dynamic(() => import('./CategorySection'), { ssr: false, loading: () => <ChartPlaceholder h={260} /> })
const CategoryDetailChart = dynamic(() => import('./CategoryDetailChart'), { ssr: false, loading: () => <ChartPlaceholder h={220} /> })

function ChartPlaceholder({ h }: { h: number }) {
  return <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: h }} />
}

interface Props {
  data: DashboardData
  year: number
}

export default function Dashboard({ data, year }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function handleCategorySelect(cat: string) {
    setSelectedCategory((prev) => (prev === cat ? null : cat))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <KpiCards data={data} year={year} />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-1">월별 지출 현황</h2>
        <MonthlyChart
          monthlyList={data.monthlyList}
          selectedMonth={null}
          onMonthSelect={() => {}}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">분류별 지출</h2>
          <CategorySection
            data={data}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-1">
            {selectedCategory ? `${selectedCategory} 내역 TOP 5` : '전체 내역 TOP 5'}
          </h2>
          <p className="text-xs text-slate-400 mb-4">
            {selectedCategory ? '좌측 도넛 분류 클릭으로 필터' : '좌측 도넛 클릭시 분류별 TOP5'}
          </p>
          <CategoryDetailChart
            allExpenses={data.allExpenses}
            selectedCategory={selectedCategory}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-700 mb-4">주요 지출 내역 TOP 20</h2>
        <ExpenseTable expenses={data.topExpenses} />
      </div>
    </div>
  )
}
