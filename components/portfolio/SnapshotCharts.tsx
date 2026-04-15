'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'

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

// 총 평가금액 바차트 커스텀 툴팁
function LineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-slate-800">{fmtKrw(payload[0].value)}</p>
    </div>
  )
}

// 구성 비중 바차트 커스텀 툴팁
function BarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
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
            <span className="text-slate-700 truncate flex-1">{p.name}</span>
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [filterKey, setFilterKey] = useState<string | null>(null)
  const { palette } = useTheme()
  if (points.length < 2) return null

  const THEME_COLORS = [
    palette.colors[0], palette.colors[1], palette.colors[2], palette.colors[3],
    palette.colors[0] + 'CC', palette.colors[1] + 'CC', palette.colors[2] + 'CC', palette.colors[3] + 'CC',
    palette.colors[0] + '99', palette.colors[1] + '99',
  ]

  const keys = [...new Set(points.flatMap(p => Object.keys(p.breakdown)))]

  function getColor(key: string, idx: number) {
    return sectorColors[key] ?? THEME_COLORS[idx % THEME_COLORS.length]
  }

  return (
    <div className="space-y-4">
      {/* 총 평가금액 추이 — 바 차트 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">총 평가금액 추이</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points} margin={{ left: 8, right: 8 }}
            onClick={(data) => {
              const label = data?.activeLabel as string | undefined
              if (label) {
                setSelectedDate(prev => prev === label ? null : label)
                setFilterKey(null)
              }
            }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} width={60} axisLine={false} tickLine={false} />
            <Tooltip content={<LineTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="total_market_value" fill={palette.colors[0]} radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 도넛 드릴다운 — 선택된 날짜의 섹터 구성 */}
      {selectedDate && (() => {
        const point = points.find(p => p.date === selectedDate)
        if (!point) return null
        const entries = Object.entries(point.breakdown)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
        const pieData = entries.map(([name, pct], i) => ({
          name,
          value: pct,
          fill: sectorColors[name] ?? THEME_COLORS[i % THEME_COLORS.length],
        }))
        return (
          <div className="bg-white rounded-2xl border border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-600">{selectedDate} 구성 비중</h4>
              <button onClick={() => { setSelectedDate(null); setFilterKey(null) }}
                className="text-slate-300 hover:text-slate-500 text-xs">닫기</button>
            </div>
            <div className="flex items-center gap-6 flex-wrap">
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                  dataKey="value" paddingAngle={2}
                  onClick={(entry) => setFilterKey(prev => prev === entry.name ? null : entry.name)}
                  style={{ cursor: 'pointer' }}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill}
                      opacity={filterKey && filterKey !== entry.name ? 0.3 : 1} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              </PieChart>
              <div className="flex-1 space-y-1 max-h-32 overflow-y-auto min-w-0">
                {entries.map(([name, pct], i) => (
                  <div key={name}
                    className={`flex items-center gap-1.5 cursor-pointer rounded px-1 py-0.5 ${filterKey === name ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
                    onClick={() => setFilterKey(prev => prev === name ? null : name)}>
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sectorColors[name] ?? THEME_COLORS[i % THEME_COLORS.length] }} />
                    <span className="text-[10px] text-slate-600 flex-1 truncate">{name}</span>
                    <span className="text-[10px] tabular-nums text-slate-500">{pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 구성 비중 변화 — stacked bar */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">구성 비중 변화</h3>
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
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} axisLine={false} tickLine={false} />
            <Tooltip content={<BarTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {keys.map((k, i) => (
              <Bar key={k} dataKey={`breakdown.${k}`} name={k} stackId="a"
                fill={getColor(k, i)}
                opacity={filterKey && filterKey !== k ? 0.2 : 1} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
