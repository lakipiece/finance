'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatWonFull } from '@/lib/utils'

interface Props {
  paymentMethods: Record<string, number>
}

const PAYMENT_COLORS = ['#6B8CAE', '#6DAE8C', '#C4A96D', '#C47D7D']

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

export default function PaymentChart({ paymentMethods }: Props) {
  const total = Object.values(paymentMethods).reduce((a, b) => a + b, 0)
  const pieData = Object.entries(paymentMethods).map(([name, value]) => ({
    name,
    value,
    pct: ((value / total) * 100).toFixed(1),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
        >
          {pieData.map((_, index) => (
            <Cell
              key={index}
              fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]}
              stroke="#fff"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span style={{ color: '#64748b', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
