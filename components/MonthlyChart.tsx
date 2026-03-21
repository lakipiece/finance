'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { MonthlyData } from '@/lib/types'
import { CAT_COLORS, CATEGORIES, formatWonFull } from '@/lib/utils'

interface Props {
  monthlyList: MonthlyData[]
  selectedMonth: number | null
  onMonthSelect: (month: number) => void
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-slate-500">{p.dataKey}</span>
          <span className="ml-auto font-medium text-slate-700">{formatWonFull(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold text-slate-800">{formatWonFull(total)}</span>
      </div>
    </div>
  )
}

export default function MonthlyChart({ monthlyList, selectedMonth, onMonthSelect }: Props) {
  function handleClick(data: any, index: number) {
    onMonthSelect(index + 1)
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={monthlyList} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
          formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>}
        />
        {CATEGORIES.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={CAT_COLORS[cat]}
            cursor="pointer"
            onClick={handleClick}
            radius={cat === '여행공연비' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          >
            {monthlyList.map((_, index) => (
              <Cell
                key={index}
                opacity={selectedMonth === null || selectedMonth === index + 1 ? 1 : 0.4}
              />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
