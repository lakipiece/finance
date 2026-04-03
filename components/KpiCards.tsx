'use client'

import type { DashboardData } from '@/lib/types'
import { formatWon, CAT_COLORS } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  data: DashboardData
  year: number
  activeCategory?: string | null
  onCategoryClick?: (cat: string) => void
}

interface CardProps {
  label: string
  value: string
  sub: string
  color: string
  active?: boolean
  onClick?: () => void
}

function KpiCard({ label, value, sub, color, active, onClick }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-5 hover:-translate-y-0.5 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } ${active ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

export default function KpiCards({ data, year, activeCategory, onCategoryClick }: Props) {
  const { catColors } = useTheme()
  const pct = (n: number) => data.total > 0 ? `${((n / data.total) * 100).toFixed(1)}%` : '0%'

  const cats = [
    { key: '고정비', label: '연간 고정비' },
    { key: '변동비', label: '연간 변동비' },
    { key: '여행공연비', label: '연간 여행공연비' },
  ] as const

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="연간 총지출"
        value={formatWon(data.total)}
        sub={`${year}년 전체`}
        color="#6B8CAE"
      />
      {cats.filter(c => data.categoryTotals[c.key] > 0).map(c => (
        <KpiCard
          key={c.key}
          label={c.label}
          value={formatWon(data.categoryTotals[c.key])}
          sub={`비율 ${pct(data.categoryTotals[c.key])}`}
          color={catColors[c.key] ?? CAT_COLORS[c.key]}
          active={activeCategory === c.key}
          onClick={onCategoryClick ? () => onCategoryClick(c.key) : undefined}
        />
      ))}
    </div>
  )
}
