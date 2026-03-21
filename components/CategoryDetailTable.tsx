'use client'

import { useState } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  allExpenses: ExpenseItem[]
}

export default function CategoryDetailTable({ allExpenses }: Props) {
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0])
  const { catColors } = useTheme()

  const filtered = allExpenses.filter((e) => e.category === activeCategory)
  const agg: Record<string, number> = {}
  for (const e of filtered) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }
  const rows = Object.entries(agg)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  const total = rows.reduce((s, r) => s + r.amount, 0)
  const color = catColors[activeCategory] ?? '#6B8CAE'

  return (
    <div>
      {/* Category tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeCategory === cat
                ? 'text-white'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
            style={activeCategory === cat ? { background: catColors[cat] } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">비율</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pct = total > 0 ? ((row.amount / total) * 100).toFixed(1) : '0'
              return (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-2 px-3 text-slate-700">{row.name}</td>
                  <td className="py-2 px-3 text-right font-medium text-slate-800">
                    {formatWonFull(row.amount)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-xs text-slate-400">{pct}%</span>
                    <div className="mt-0.5 h-1 w-16 ml-auto bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
