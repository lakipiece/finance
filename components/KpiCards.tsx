'use client'

import type { DashboardData, MonthlyData } from '@/lib/types'
import { formatWon, CAT_COLORS, CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  data: DashboardData
  year: number
  selectedCategory: string | null
  selectedMonth: number | null
  onCategoryClick: (cat: string | null) => void
}

export default function KpiCards({ data, year, selectedCategory, selectedMonth, onCategoryClick }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()

  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return data.categoryTotals[c] > 0
  })

  // Compute totals based on month filter
  const monthData = selectedMonth ? data.monthlyList[selectedMonth - 1] : null
  const getAmount = (cat: string) => monthData ? (monthData[cat as keyof MonthlyData] as number) : data.categoryTotals[cat as keyof typeof data.categoryTotals]
  const total = monthData ? monthData.total : data.total
  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%'
  const subtitle = selectedMonth ? `${selectedMonth}월` : `${year}년`

  return (
    <div className={`grid grid-cols-2 lg:grid-cols-${activeCategories.length + 1} gap-4`}>
      {/* Total card */}
      <div
        onClick={() => onCategoryClick(null)}
        className={`bg-white rounded-2xl shadow-sm border p-5 hover:-translate-y-0.5 transition-all cursor-pointer ${
          selectedCategory === null ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">전체</p>
        </div>
        <p className="text-2xl font-bold mt-1 text-slate-800">{formatWon(total)}</p>
        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
      </div>
      {/* Category cards */}
      {activeCategories.map(cat => {
        const amount = getAmount(cat)
        return (
          <div
            key={cat}
            onClick={() => onCategoryClick(selectedCategory === cat ? null : cat)}
            className={`bg-white rounded-2xl shadow-sm border p-5 hover:-translate-y-0.5 transition-all cursor-pointer ${
              selectedCategory === cat ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] ?? CAT_COLORS[cat] }} />
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{cat}</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-slate-800">{formatWon(amount)}</p>
            <p className="text-xs text-slate-400 mt-1">{pct(amount)}</p>
          </div>
        )
      })}
    </div>
  )
}
