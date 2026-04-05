'use client'

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts'

interface SnapshotPoint {
  date: string
  total_market_value: number
  breakdown: Record<string, number>
}

interface Props { points: SnapshotPoint[] }

function fmtY(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return String(v)
}

const COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6']

export default function SnapshotCharts({ points }: Props) {
  const [mode, setMode] = useState<'asset_class' | 'ticker'>('asset_class')
  if (points.length < 2) return null

  const keys = [...new Set(points.flatMap(p => Object.keys(p.breakdown)))]

  return (
    <div className="space-y-4">
      {/* Line chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">총 평가금액 추이</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()}원`, '평가금액']} />
            <Line type="monotone" dataKey="total_market_value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-600">구성 비중 변화</h3>
          <div className="flex gap-1">
            {(['asset_class', 'ticker'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`text-xs px-2 py-1 rounded-full ${mode === m ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}>
                {m === 'asset_class' ? '자산군' : '종목'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={`breakdown.${k}`} name={k} stackId="a"
                fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
