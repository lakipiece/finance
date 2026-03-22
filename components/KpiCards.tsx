'use client'

import type { DashboardData } from '@/lib/types'
import { formatWon } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  data: DashboardData
  year: number
}

interface CardProps {
  label: string
  value: string
  sub: string
  color: string
}

function KpiCard({ label, value, sub, color }: CardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:-translate-y-0.5 transition-transform">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

export default function KpiCards({ data, year }: Props) {
  const { catColors } = useTheme()
  const pct = (n: number) => data.total > 0 ? `${((n / data.total) * 100).toFixed(1)}%` : '0%'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="연간 총 지출"
        value={formatWon(data.total)}
        sub={`${year}년 전체`}
        color="#6B8CAE"
      />
      <KpiCard
        label="연간 고정비"
        value={formatWon(data.categoryTotals.고정비)}
        sub={`비율 ${pct(data.categoryTotals.고정비)}`}
        color={catColors['고정비'] ?? '#6B8CAE'}
      />
      <KpiCard
        label="연간 변동비"
        value={formatWon(data.categoryTotals.변동비)}
        sub={`비율 ${pct(data.categoryTotals.변동비)}`}
        color={catColors['변동비'] ?? '#6DAE8C'}
      />
      <KpiCard
        label="연간 여행공연비"
        value={formatWon(data.categoryTotals.여행공연비)}
        sub={`비율 ${pct(data.categoryTotals.여행공연비)}`}
        color={catColors['여행공연비'] ?? '#C4A96D'}
      />
    </div>
  )
}
