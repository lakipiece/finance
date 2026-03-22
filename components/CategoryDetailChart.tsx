'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { ExpenseItem } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  allExpenses: ExpenseItem[]
  selectedCategory: string | null
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700">{payload[0].payload.name}</p>
      <p className="text-slate-500 mt-0.5">{formatWonFull(payload[0].value)}</p>
    </div>
  )
}

export default function CategoryDetailChart({ allExpenses, selectedCategory }: Props) {
  const { catColors } = useTheme()

  const filtered = selectedCategory
    ? allExpenses.filter((e) => e.category === selectedCategory)
    : allExpenses

  const agg: Record<string, number> = {}
  for (const e of filtered) {
    const key = e.detail || '기타'
    agg[key] = (agg[key] ?? 0) + e.amount
  }

  const data = Object.entries(agg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  const color = selectedCategory ? (catColors[selectedCategory] ?? '#6B8CAE') : '#6B8CAE'

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis
          type="number"
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={100}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={color} opacity={1 - i * 0.12} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
