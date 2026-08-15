'use client'

import { useState, useEffect } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition } from '@/lib/portfolio/types'
import { btn } from '@/lib/styles'
import PageHeader from '@/components/ui/PageHeader'

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
  if (Math.abs(diff) < 0.001) return 'text-ink-4'
  return diff > 0 ? 'text-gain' : 'text-loss'
}

function TargetInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  // 입력 중에는 로컬 버퍼를 쓴다.
  // 매 타건마다 toFixed(1)로 되돌리면 "30"을 치는 도중 "3.0"으로 잘려
  // 두 번째 자리를 영영 입력할 수 없다.
  const [text, setText] = useState(() => (value * 100).toFixed(1))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText((value * 100).toFixed(1))
  }, [value, editing])

  function handleChange(raw: string) {
    setText(raw)
    const n = parseFloat(raw)
    if (!isNaN(n) && n >= 0 && n <= 100) onChange(n / 100)
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={e => { setEditing(true); e.currentTarget.select() }}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => { setEditing(false); setText((value * 100).toFixed(1)) }}
        className="w-16 text-right rounded-cell bg-surface-low px-2 py-1 text-body text-ink focus:outline-none focus:bg-surface-card focus:shadow-focus transition-colors tabular-nums border-0 placeholder:text-ink-5"
      />
      <span className="text-micro tracking-normal text-ink-4">%</span>
    </span>
  )
}

function RebalanceSection({ title, rows, total, getTarget, setTarget }: {
  title: string
  rows: { key: string; actual_pct: number; level: string; mono?: boolean }[]
  total: number
  getTarget: (level: string, key: string) => number
  setTarget: (level: string, key: string, pct: number) => void
}) {
  return (
    <div className="bg-surface-card rounded-card shadow-card overflow-hidden">
      <div className="px-[13px] pt-[13px] pb-2">
        <p className="text-subhead font-medium text-ink">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-low">
              <th className="text-left px-[13px] py-[5px] text-micro uppercase text-ink-5">항목</th>
              <th className="text-right px-2 py-[5px] text-micro uppercase text-ink-5">현재</th>
              <th className="text-right px-2 py-[5px] text-micro uppercase text-ink-5">목표</th>
              <th className="text-right px-2 py-[5px] text-micro uppercase text-ink-5">차이</th>
              <th className="text-right px-[13px] py-[5px] text-micro uppercase text-ink-5">필요 금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-low">
            {rows.map(({ key, actual_pct, level, mono }) => {
              const target = getTarget(level, key)
              const diff = actual_pct - target
              const needed = (target - actual_pct) * total
              return (
                <tr key={key} className="hover:bg-surface-low/60 transition-colors">
                  <td className={`px-[13px] py-[5px] text-body text-ink-2 ${mono ? 'font-mono' : ''}`}>{key}</td>
                  <td className="px-2 py-[5px] text-right text-body text-ink tabular-nums">
                    {(actual_pct * 100).toFixed(1)}%
                  </td>
                  <td className="px-2 py-[5px] text-right">
                    <TargetInput value={target} onChange={v => setTarget(level, key, v)} />
                  </td>
                  <td className={`px-2 py-[5px] text-right text-body font-bold tabular-nums ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </td>
                  <td className={`px-[13px] py-[5px] text-right text-body tabular-nums ${needed >= 0 ? 'text-loss' : 'text-gain'}`}>
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
}

export default function RebalanceDashboard({ summary, targets }: Props) {
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="리밸런싱" description="목표 비율 설정 및 현황 비교">
        <button
          onClick={saveTargets}
          className={btn.primary}
        >
          {saved ? '저장됨 ✓' : '목표 저장'}
        </button>
      </PageHeader>

      <RebalanceSection
        title="자산군 목표 비율"
        rows={byAssetClass.map(r => ({ ...r, level: 'asset_class' }))}
        total={total} getTarget={getTarget} setTarget={setTarget}
      />
      <RebalanceSection
        title="스타일 목표 비율"
        rows={byStyle
          .sort((a, b) => b.market_value - a.market_value)
          .map(r => ({ ...r, level: 'style' }))}
        total={total} getTarget={getTarget} setTarget={setTarget}
      />
      <RebalanceSection
        title="종목별 목표 비율"
        rows={byTicker
          .sort((a, b) => b.market_value - a.market_value)
          .map(r => ({ ...r, level: 'ticker', mono: true }))}
        total={total} getTarget={getTarget} setTarget={setTarget}
      />
    </div>
  )
}
