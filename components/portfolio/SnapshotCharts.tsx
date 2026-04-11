'use client'

import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

interface SnapshotPoint {
  date: string
  total_market_value: number
  breakdown: Record<string, number>
}

interface Props {
  points: SnapshotPoint[]
  sectorColors?: Record<string, string>
}

function fmtY(v: number) {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return String(v)
}

function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

const DEFAULT_COLORS = ['#6366f1','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#64748b','#a3e635']

// 라인차트 커스텀 툴팁
function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-slate-800">{fmtKrw(payload[0].value)}</p>
    </div>
  )
}

// 바차트 커스텀 툴팁
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum: number, p: any) => sum + (Number(p.value) || 0), 0)
  // total_market_value는 payload[0].payload에 있음
  const mv = payload[0]?.payload?.total_market_value ?? 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs max-w-[200px]">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.slice().reverse().map((p: any) => {
        const pct = Number(p.value) || 0
        if (pct <= 0) return null
        const amt = mv * pct / 100
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-600 truncate flex-1">{p.name}</span>
            <span className="tabular-nums text-slate-800 font-medium">{pct.toFixed(1)}%</span>
            {mv > 0 && <span className="tabular-nums text-slate-400">{fmtY(amt)}</span>}
          </div>
        )
      })}
      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-400">합계</span>
        <span className="font-semibold text-slate-700">{fmtKrw(mv)}</span>
      </div>
    </div>
  )
}

export default function SnapshotCharts({ points, sectorColors = {} }: Props) {
  const [mode, setMode] = useState<'asset_class' | 'ticker'>('asset_class')
  if (points.length < 2) return null

  const keys = [...new Set(points.flatMap(p => Object.keys(p.breakdown)))]

  function getColor(key: string, idx: number) {
    return sectorColors[key] ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
  }

  return (
    <div className="space-y-4">
      {/* Line chart */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">총 평가금액 추이</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11 }} width={60} />
            <Tooltip content={<LineTooltip />} />
            <Line type="monotone" dataKey="total_market_value" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Stacked bar chart */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
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
          <BarChart data={points} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={40} />
            <Tooltip content={<BarTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={`breakdown.${k}`} name={k} stackId="a"
                fill={getColor(k, i)} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
