'use client'

import { useState } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import { btn } from '@/lib/styles'

interface Props {
  summary: PortfolioSummary
  targets: TargetAllocation[]
}

function groupPct(
  positions: PortfolioPosition[],
  key: (p: PortfolioPosition) => string,
  total: number
) {
  const map: Record<string, number> = {}
  for (const p of positions) {
    const k = key(p)
    map[k] = (map[k] ?? 0) + p.market_value
  }
  return Object.entries(map).map(([k, v]) => ({
    key: k,
    actual_pct: total > 0 ? v / total : 0,
    market_value: v,
  }))
}

function diffColor(diff: number) {
  if (Math.abs(diff) < 0.001) return 'text-slate-400'
  return diff > 0 ? 'text-rose-500' : 'text-blue-500'
}

function TargetInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="number" min={0} max={100} step={0.1}
        value={(value * 100).toFixed(1)}
        onChange={e => onChange(parseFloat(e.target.value) / 100)}
        className="w-14 text-right border-0 border-b border-slate-200 bg-transparent pb-0.5 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors tabular-nums"
      />
      <span className="text-xs text-slate-400">%</span>
    </span>
  )
}

export default function RebalanceDashboard({ summary, targets }: Props) {
  const { palette } = useTheme()
  const [editTargets, setEditTargets] = useState<TargetAllocation[]>(targets)
  const [saved, setSaved] = useState(false)
  const total = summary.total_market_value

  const byAssetClass = groupPct(summary.positions, p => p.security.asset_class ?? '기타', total)
  const byStyle = groupPct(summary.positions, p => p.security.etf_style ?? '미분류', total)
  const byTicker = groupPct(summary.positions, p => p.security.ticker, total)

  function getTarget(level: string, key: string) {
    return editTargets.find(t => t.level === level && t.key === key)?.target_pct ?? 0
  }

  function setTarget(level: string, key: string, pct: number) {
    setEditTargets(prev => {
      const idx = prev.findIndex(t => t.level === level && t.key === key)
      if (idx >= 0) return prev.map((t, i) => i === idx ? { ...t, target_pct: pct } : t)
      return [...prev, { id: '', level: level as TargetAllocation['level'], key, target_pct: pct }]
    })
    setSaved(false)
  }

  async function saveTargets() {
    const body = editTargets
      .filter(t => t.target_pct > 0)
      .map(({ level, key, target_pct }) => ({ level, key, target_pct }))
    await fetch('/api/portfolio/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaved(true)
  }

  const Section = ({ title, rows }: {
    title: string
    rows: { key: string; actual_pct: number; level: string; mono?: boolean }[]
  }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-50">
              <th className="text-left px-5 py-2.5 text-[10px] font-medium text-slate-400">항목</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-medium text-slate-400">현재</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-medium text-slate-400">목표</th>
              <th className="text-right px-4 py-2.5 text-[10px] font-medium text-slate-400">차이</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-medium text-slate-400">필요 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map(({ key, actual_pct, level, mono }) => {
              const target = getTarget(level, key)
              const diff = actual_pct - target
              const needed = (target - actual_pct) * total
              return (
                <tr key={key} className="hover:bg-slate-50/60 transition-colors">
                  <td className={`px-5 py-2.5 text-xs font-medium text-slate-700 ${mono ? 'font-mono' : ''}`}>{key}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    {(actual_pct * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <TargetInput value={target} onChange={v => setTarget(level, key, v)} />
                  </td>
                  <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </td>
                  <td className={`px-5 py-2.5 text-right text-xs tabular-nums ${needed >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                    {Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>리밸런싱</h1>
          <p className="text-xs text-slate-400 mt-0.5">목표 비율 설정 및 현황 비교</p>
        </div>
        <button
          onClick={saveTargets}
          className={btn.primary}
          style={{ backgroundColor: palette.colors[0] }}
        >
          {saved ? '저장됨 ✓' : '목표 저장'}
        </button>
      </div>

      <Section
        title="자산군 목표 비율"
        rows={byAssetClass.map(r => ({ ...r, level: 'asset_class' }))}
      />
      <Section
        title="스타일 목표 비율"
        rows={byStyle
          .sort((a, b) => b.market_value - a.market_value)
          .map(r => ({ ...r, level: 'style' }))}
      />
      <Section
        title="종목별 목표 비율"
        rows={byTicker
          .sort((a, b) => b.market_value - a.market_value)
          .map(r => ({ ...r, level: 'ticker', mono: true }))}
      />
    </div>
  )
}
