'use client'

import { useState } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition } from '@/lib/portfolio/types'

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

export default function RebalanceDashboard({ summary, targets }: Props) {
  const [editTargets, setEditTargets] = useState<TargetAllocation[]>(targets)
  const [saved, setSaved] = useState(false)
  const total = summary.total_market_value

  const byAssetClass = groupPct(summary.positions, p => p.security.asset_class ?? '기타', total)
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

  function diffColor(diff: number) {
    if (Math.abs(diff) < 0.01) return 'text-slate-400'
    return diff > 0 ? 'text-rose-500' : 'text-blue-500'
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">리밸런싱</h2>
        <button
          onClick={saveTargets}
          className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 transition-colors"
        >
          {saved ? '저장됨 ✓' : '목표 저장'}
        </button>
      </div>

      {/* 자산군 레이어 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-sm text-slate-600">
          자산군 목표 비율
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">자산군</th>
              <th className="text-right px-4 py-3">현재</th>
              <th className="text-right px-4 py-3">목표</th>
              <th className="text-right px-4 py-3">차이</th>
              <th className="text-right px-4 py-3">필요 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {byAssetClass.map(({ key, actual_pct }) => {
              const target = getTarget('asset_class', key)
              const diff = actual_pct - target
              const needed = (target - actual_pct) * total
              return (
                <tr key={key} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{key}</td>
                  <td className="px-4 py-3 text-right">{(actual_pct * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number" min={0} max={100} step={0.1}
                      value={(target * 100).toFixed(1)}
                      onChange={e => setTarget('asset_class', key, parseFloat(e.target.value) / 100)}
                      className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                    />%
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </td>
                  <td className={`px-4 py-3 text-right text-xs ${needed >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                    {needed >= 0 ? '+' : ''}{Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 종목 레이어 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 font-semibold text-sm text-slate-600">
          종목별 목표 비율
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">티커</th>
              <th className="text-right px-4 py-3">현재</th>
              <th className="text-right px-4 py-3">목표</th>
              <th className="text-right px-4 py-3">차이</th>
              <th className="text-right px-4 py-3">필요 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {byTicker
              .sort((a, b) => b.market_value - a.market_value)
              .map(({ key, actual_pct }) => {
                const target = getTarget('ticker', key)
                const diff = actual_pct - target
                const needed = (target - actual_pct) * total
                return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{key}</td>
                    <td className="px-4 py-3 text-right">{(actual_pct * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number" min={0} max={100} step={0.1}
                        value={(target * 100).toFixed(1)}
                        onChange={e => setTarget('ticker', key, parseFloat(e.target.value) / 100)}
                        className="w-20 text-right border border-slate-200 rounded px-2 py-1 text-sm"
                      />%
                    </td>
                    <td className={`px-4 py-3 text-right font-semibold ${diffColor(diff)}`}>
                      {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                    </td>
                    <td className={`px-4 py-3 text-right text-xs ${needed >= 0 ? 'text-blue-500' : 'text-rose-500'}`}>
                      {needed >= 0 ? '+' : ''}{Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
