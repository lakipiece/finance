'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { DashboardData } from '@/lib/types'
import KpiCards from './KpiCards'
import DrilldownPanel from './DrilldownPanel'
import ExpenseTable from './ExpenseTable'

// Recharts는 브라우저 전용 → SSR 비활성화
const MonthlyChart = dynamic(() => import('./MonthlyChart'), { ssr: false, loading: () => <ChartPlaceholder h={300} /> })
const CategorySection = dynamic(() => import('./CategorySection'), { ssr: false, loading: () => <ChartPlaceholder h={320} /> })
const TrendChart = dynamic(() => import('./TrendChart'), { ssr: false, loading: () => <ChartPlaceholder h={220} /> })
const PaymentChart = dynamic(() => import('./PaymentChart'), { ssr: false, loading: () => <ChartPlaceholder h={220} /> })

function ChartPlaceholder({ h }: { h: number }) {
  return <div className="animate-pulse bg-slate-100 rounded-xl" style={{ height: h }} />
}

interface Props {
  data: DashboardData
}

export default function Dashboard({ data }: Props) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  function handleMonthSelect(month: number) {
    setSelectedMonth(prev => prev === month ? null : month)
  }

  function handleCategorySelect(cat: string) {
    setSelectedCategory(prev => prev === cat ? null : cat)
  }

  const monthExpenses = selectedMonth
    ? data.allExpenses.filter(e => e.month === selectedMonth)
    : []

  return (
    <div>
      {/* Header */}
      <header className="text-white py-8 px-6 mb-8 shadow-lg" style={{ background: 'linear-gradient(135deg, #2D3748 0%, #4A5568 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <p className="text-slate-300 text-sm font-medium tracking-widest mb-1">HOUSEHOLD BUDGET</p>
          <h1 className="text-3xl font-bold">2022 가계부 대시보드</h1>
          <p className="text-slate-300 mt-1 text-sm">2022년 1월 ~ 12월 지출 분석</p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 pb-12 space-y-6">
        <KpiCards data={data} />

        {/* Monthly Chart */}
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

        <CategorySection
          data={data}
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-1">월별 생활비 트렌드</h2>
            <p className="text-xs text-slate-400 mb-4">대출상환 제외 (고정비 + 변동비 + 여행공연비)</p>
            <TrendChart monthlyList={data.monthlyList} />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-base font-semibold text-slate-700 mb-4">결제수단별 비율</h2>
            <PaymentChart paymentMethods={data.paymentMethods} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-base font-semibold text-slate-700 mb-4">주요 지출 내역 TOP 20</h2>
          <ExpenseTable expenses={data.topExpenses} />
        </div>
      </div>
    </div>
  )
}
