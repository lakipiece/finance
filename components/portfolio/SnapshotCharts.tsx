'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
  PieChart, Pie, Cell,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'
import type { ChartTooltipProps } from '@/lib/chartTypes'

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
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${Math.floor(v / 10_000)}만`
  return String(v)
}

function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}

function LineTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="font-semibold text-slate-800">{fmtKrw(payload[0].value)}</p>
    </div>
  )
}

function BarTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const mv = (payload[0]?.payload?.total_market_value as number) ?? 0
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(new Set())
  const { palette } = useTheme()
  if (points.length < 2) return null

  const THEME_COLORS = [
    palette.colors[0], palette.colors[1], palette.colors[2], palette.colors[3],
    palette.colors[0] + 'CC', palette.colors[1] + 'CC', palette.colors[2] + 'CC', palette.colors[3] + 'CC',
    palette.colors[0] + '99', palette.colors[1] + '99',
  ]

  const allKeys = [...new Set(points.flatMap(p => Object.keys(p.breakdown)))]

  function getColor(key: string) {
    const idx = allKeys.indexOf(key)
    return sectorColors[key] ?? THEME_COLORS[idx % THEME_COLORS.length]
  }

  function toggleSector(k: string) {
    setSelectedSectors(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const visibleKeys = selectedSectors.size > 0
    ? allKeys.filter(k => selectedSectors.has(k))
    : allKeys

  return (
    <div className="space-y-4">

      {/* 총 평가금액 추이 — 제목 없음, Y축 없음, 바 위 숫자 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 pt-5 pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points} margin={{ left: 8, right: 8, top: 24 }}
            onClick={(data) => {
              const label = data?.activeLabel as string | undefined
              if (label) setSelectedDate(prev => prev === label ? null : label)
            }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <Tooltip content={<LineTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="total_market_value" fill={palette.colors[0]} radius={[4, 4, 0, 0]}
              style={{ cursor: 'pointer' }}>
              <LabelList dataKey="total_market_value" position="top"
                formatter={(v: number) => fmtY(v)}
                style={{ fontSize: 10, fill: '#94a3b8' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 선택된 날짜의 구성 비중 드릴다운 */}
      {selectedDate && (() => {
        const point = points.find(p => p.date === selectedDate)
        if (!point) return null
        const entries = Object.entries(point.breakdown)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
        const pieData = entries.map(([name, pct]) => ({
          name, value: pct,
          fill: getColor(name),
        }))
        return (
          <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-semibold text-slate-600">{selectedDate} 구성 비중</h4>
              <button onClick={() => setSelectedDate(null)}
                className="text-slate-300 hover:text-slate-500 text-xs">닫기</button>
            </div>
            <div className="flex gap-8 flex-wrap">
              {/* 도넛 */}
              <div className="shrink-0">
                <PieChart width={160} height={160}>
                  <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                </PieChart>
              </div>

              {/* 섹터 목록 — 가로 바 + % + 금액 */}
              <div className="flex-1 space-y-3 min-w-[200px] py-1">
                {entries.map(([name, pct]) => {
                  const amt = point.total_market_value * pct / 100
                  const color = getColor(name)
                  return (
                    <div key={name}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-[10px] text-slate-600 flex-1 truncate">{name}</span>
                        <span className="text-[10px] tabular-nums text-slate-500 shrink-0">{pct.toFixed(1)}%</span>
                        <span className="text-[10px] tabular-nums text-slate-400 shrink-0 w-16 text-right">
                          {fmtY(amt)}원
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-3.5">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 구성 비중 변화 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-6 py-5">
        <div className="flex items-start gap-4 mb-4 flex-wrap">
          <h3 className="text-sm font-semibold text-slate-700 shrink-0">구성 비중 변화</h3>
          {/* 섹터 복수 선택 */}
          <div className="flex flex-wrap gap-1 flex-1">
            {allKeys.map(k => {
              const active = selectedSectors.has(k)
              const color = getColor(k)
              return (
                <button key={k}
                  onClick={() => toggleSector(k)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                    active
                      ? 'text-white border-transparent'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                  style={active ? { backgroundColor: color } : undefined}>
                  {k}
                </button>
              )
            })}
            {selectedSectors.size > 0 && (
              <button onClick={() => setSelectedSectors(new Set())}
                className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-400 hover:text-slate-600">
                전체
              </button>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={points} margin={{ left: 0, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<BarTooltip />} />
            {visibleKeys.map(k => (
              <Bar key={k}
                dataKey={(entry: SnapshotPoint) => entry.breakdown[k] ?? 0}
                name={k}
                stackId="a"
                fill={getColor(k)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
