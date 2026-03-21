'use client'

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

      {/* Category Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {CATEGORIES.map((cat) => {
          const amount = monthData[cat]
          if (amount === 0) return null
          return (
            <div key={cat} className="rounded-xl p-3" style={{ background: `${catColors[cat]}14` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full" style={{ background: catColors[cat] }} />
                <span className="text-xs font-medium" style={{ color: catColors[cat] }}>{cat}</span>
              </div>
              <p className="text-base font-bold text-slate-800">{formatWonFull(amount)}</p>
            </div>
          )
        })}
      </div>

      {/* Expenses Table */}
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
            {expenses
              .sort((a, b) => b.amount - a.amount)
              .map((e, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-400 text-xs">{e.date}</td>
                  <td className="py-2 px-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700">{e.detail}</td>
                  <td className="py-2 px-3 text-slate-400">{e.method}</td>
                  <td className="py-2 px-3 text-right font-semibold text-slate-800">{formatWonFull(e.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
