'use client'

import { useState } from 'react'
import type { MonthlyData, ExpenseItem } from '@/lib/types'
import { formatWonFull, CAT_BADGE, CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  monthData: MonthlyData
  expenses: ExpenseItem[]
  onClose: () => void
}

export default function DrilldownPanel({ monthData, expenses, onClose }: Props) {
  const { catColors } = useTheme()
  const [selectedCat, setSelectedCat] = useState<string | null>(null)

  const filteredExpenses = selectedCat
    ? expenses.filter(e => e.category === selectedCat)
    : expenses

  // Group by detail for selected category
  const detailSummary = selectedCat
    ? Object.entries(
        filteredExpenses.reduce<Record<string, number>>((acc, e) => {
          const key = e.detail || '기타'
          acc[key] = (acc[key] ?? 0) + e.amount
          return acc
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-violet-100 p-6 animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{monthData.month} 상세 내역</h2>
          <p className="text-sm text-slate-400 mt-0.5">총 {formatWonFull(monthData.total)}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
          aria-label="닫기"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Category Summary — clickable drilldown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {CATEGORIES.map((cat) => {
          const amount = monthData[cat]
          if (amount === 0) return null
          const isSelected = selectedCat === cat
          return (
            <button
              key={cat}
              onClick={() => setSelectedCat(prev => prev === cat ? null : cat)}
              className="text-left rounded-xl p-3 transition-all ring-2"
              style={{
                background: `${catColors[cat]}${isSelected ? '28' : '14'}`,
                outline: isSelected ? `2px solid ${catColors[cat]}` : '2px solid transparent',
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] }} />
                <span className="text-xs font-medium" style={{ color: catColors[cat] }}>{cat}</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(amount)}</p>
            </button>
          )
        })}
      </div>

      {/* Detail summary for selected category */}
      {detailSummary && detailSummary.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-2">{selectedCat} 항목별 집계</h3>
          <div className="space-y-1.5">
            {detailSummary.map(([detail, amount]) => {
              const total = monthData[selectedCat as keyof MonthlyData] as number
              const pct = total > 0 ? Math.round(amount / total * 100) : 0
              return (
                <div key={detail} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-600 truncate">{detail}</span>
                      <span className="text-slate-400 ml-2 shrink-0">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: catColors[selectedCat!] }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 shrink-0 w-28 text-right">{formatWonFull(amount)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Expenses Table */}
      <div>
        <h3 className="text-sm font-semibold text-slate-600 mb-2">
          {selectedCat ? `${selectedCat} 내역` : '전체 내역'}
          {selectedCat && (
            <button onClick={() => setSelectedCat(null)} className="ml-2 text-xs text-slate-400 hover:text-slate-600 font-normal">
              전체보기
            </button>
          )}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
                <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
                <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses
                .sort((a, b) => b.amount - a.amount)
                .map((e, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-400 text-xs">{e.date}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{e.detail || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 px-3 text-slate-400">{e.method || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatWonFull(e.amount)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
