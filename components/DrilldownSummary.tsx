'use client'

import { useState } from 'react'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import { formatWonFull, CATEGORIES, CAT_BADGE } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  monthData: MonthlyData
  expenses: ExpenseItem[]
  selectedCategory: string | null
  selectedDetail: string | null
  onDetailSelect: (detail: string | null) => void
}

export default function DrilldownSummary({ monthData, expenses, selectedCategory, selectedDetail, onDetailSelect }: Props) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const [detailSearch, setDetailSearch] = useState('')

  const activeCategories = CATEGORIES.filter(c => {
    if (excludeLoan && c === '대출상환') return false
    return (monthData[c as keyof MonthlyData] as number) > 0
  })

  // Category-level rows (no category selected)
  if (!selectedCategory) {
    const total = monthData.total
    return (
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-3">카테고리별 합계</h3>
        <div className="space-y-2.5">
          {activeCategories.map(cat => {
            const amount = monthData[cat as keyof MonthlyData] as number
            const pct = total > 0 ? Math.round(amount / total * 100) : 0
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[cat] ?? 'bg-slate-100 text-slate-700'}`}>{cat}</span>
                    <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[cat] }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">{formatWonFull(amount)}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Item-level rows (category selected)
  const catExpenses = expenses.filter(e => e.category === selectedCategory)
  const agg: Record<string, number> = {}
  for (const e of catExpenses) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }
  const rows = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .filter(([detail]) => !detailSearch || detail.toLowerCase().includes(detailSearch.toLowerCase()))

  const catTotal = catExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-sm font-semibold text-slate-600 shrink-0">{selectedCategory} 항목별 집계</h3>
        <input
          type="text"
          value={detailSearch}
          onChange={e => setDetailSearch(e.target.value)}
          placeholder="내역 검색..."
          className="flex-1 max-w-48 text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <div className="max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
        {rows.length > 0 ? rows.map(([detail, amount]) => {
          const pct = catTotal > 0 ? Math.round(amount / catTotal * 100) : 0
          const isSelected = selectedDetail === detail
          return (
            <div
              key={detail}
              className={`flex items-center gap-3 rounded-lg px-1 py-0.5 cursor-pointer transition-colors ${isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              onClick={() => onDetailSelect(isSelected ? null : detail)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className={`truncate max-w-[160px] ${isSelected ? 'text-slate-800 font-bold' : 'text-slate-600'}`} title={detail}>{detail}</span>
                  <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: catColors[selectedCategory] }} />
                </div>
              </div>
              <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">{formatWonFull(amount)}</span>
            </div>
          )
        }) : (
          <p className="text-xs text-slate-400 py-2">{detailSearch ? '검색 결과가 없습니다.' : '내역이 없습니다.'}</p>
        )}
      </div>
    </div>
  )
}
