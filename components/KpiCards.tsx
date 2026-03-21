'use client'

import type { DashboardData } from '@/lib/types'
import { formatWon, formatWonFull } from '@/lib/utils'

interface Props {
  data: DashboardData
}

interface CardProps {
  label: string
  value: string
  sub: string
  valueClass: string
}

function KpiCard({ label, value, sub, valueClass }: CardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:-translate-y-0.5 transition-transform">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

export default function KpiCards({ data }: Props) {
  const loanRatio = ((data.categoryTotals.대출상환 / data.total) * 100).toFixed(1)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="연간 총 지출"
        value={formatWon(data.total)}
        sub="2022년 전체"
        valueClass="text-slate-800"
      />
      <KpiCard
        label="월 평균 지출"
        value={formatWon(data.monthlyAvg)}
        sub="12개월 평균"
        valueClass="text-[#6B8CAE]"
      />
      <KpiCard
        label="최대 지출 월"
        value={data.maxMonth.month}
        sub={formatWonFull(data.maxMonth.total)}
        valueClass="text-[#C47D7D]"
      />
      <KpiCard
        label="대출상환 비율"
        value={`${loanRatio}%`}
        sub={formatWonFull(data.categoryTotals.대출상환)}
        valueClass="text-[#C4A96D]"
      />
    </div>
  )
}
