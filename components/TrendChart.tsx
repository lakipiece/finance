'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { MonthlyData } from '@/lib/types'
import { formatWonFull } from '@/lib/utils'

interface Props {
  monthlyList: MonthlyData[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      <p className="text-blue-600 font-medium">{formatWonFull(payload[0].value)}</p>
    </div>
  )
}

export default function TrendChart({ monthlyList }: Props) {
  const trendData = monthlyList.map((m) => ({
    month: m.month,
    생활비: m.고정비 + m.변동비 + m.여행공연비,
  }))

  const avg = Math.round(trendData.reduce((s, d) => s + d.생활비, 0) / trendData.length)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={trendData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={avg}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: '평균', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }}
        />
        <Line
          type="monotone"
          dataKey="생활비"
          stroke="#6B8CAE"
          strokeWidth={2.5}
          dot={{ fill: '#6B8CAE', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
