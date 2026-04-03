'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { DashboardData, ExpenseItem, DetailItem } from '@/lib/types'
import { CATEGORIES, formatWonFull, CAT_BADGE } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  data: DashboardData
  selectedCategory: string | null
  onCategorySelect: (cat: string) => void
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700">{p.name}</p>
      <p className="text-slate-500 mt-0.5">{formatWonFull(p.value)}</p>
      <p className="text-slate-400 text-xs">{p.payload.pct}%</p>
    </div>
  )
}

export default function CategorySection({ data, selectedCategory, onCategorySelect }: Props) {
  const { catColors } = useTheme()
  const total = Object.values(data.categoryTotals).reduce((a, b) => a + b, 0)

  const activeCategories = CATEGORIES.filter(cat => data.categoryTotals[cat] > 0)

  const pieData = activeCategories.map((cat) => ({
    name: cat,
    value: data.categoryTotals[cat],
    pct: ((data.categoryTotals[cat] / total) * 100).toFixed(1),
  }))

  // Determine table rows based on selected category
  function getTableRows(): { name: string; amount: number }[] {
    if (!selectedCategory) {
      return activeCategories.map((cat) => ({ name: cat, amount: data.categoryTotals[cat] }))
    }
    if (selectedCategory === '변동비') return data.variableDetail
    if (selectedCategory === '고정비') return data.fixedDetail
    // 대출상환 or 여행공연비: group by detail from allExpenses
    const agg: Record<string, number> = {}
    data.allExpenses
      .filter((e) => e.category === selectedCategory)
      .forEach((e) => {
        const key = e.detail || '기타'
        agg[key] = (agg[key] ?? 0) + e.amount
      })
    return Object.entries(agg)
      .map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
  }

  const tableRows = getTableRows()
  const tableTotal = tableRows.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-slate-700">분류별 지출 분석</h2>
        {selectedCategory && (
          <button
            onClick={() => onCategorySelect(selectedCategory)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            전체 보기
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div>
          <p className="text-xs text-slate-400 mb-3">클릭하면 상세 내역으로 필터링됩니다</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={100}
                dataKey="value"
                onClick={(entry) => onCategorySelect(entry.name)}
                cursor="pointer"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={catColors[entry.name]}
                    stroke={selectedCategory === entry.name ? '#1e3a5f' : '#fff'}
                    strokeWidth={selectedCategory === entry.name ? 3 : 2}
                    opacity={selectedCategory === null || selectedCategory === entry.name ? 1 : 0.4}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Detail Table */}
        <div>
          <p className="text-xs text-slate-400 mb-3">
            {selectedCategory ? `${selectedCategory} 상세 내역` : '카테고리별 합계'}
          </p>
          <div className="space-y-2">
            {tableRows.map((row, i) => {
              const pct = tableTotal > 0 ? (row.amount / tableTotal) * 100 : 0
              const color = selectedCategory ? (catColors[selectedCategory] ?? '#3B82F6') : (catColors[row.name] ?? '#3B82F6')
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[row.name] ?? 'bg-slate-100 text-slate-700'}`}>{row.name}</span>
                    <span className="font-medium text-slate-800">{formatWonFull(row.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
