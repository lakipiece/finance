'use client'

import { useState, useEffect } from 'react'
import type { PortfolioSummary, TargetAllocation, PortfolioPosition } from '@/lib/portfolio/types'
import { createPortal } from 'react-dom'
import { btn, modal } from '@/lib/styles'
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
  const map: Record<string, { value: number; items: PortfolioPosition[] }> = {}
  for (const p of positions) {
    const k = key(p)
    ;(map[k] ??= { value: 0, items: [] })
    map[k].value += p.market_value
    map[k].items.push(p)
  }
  return Object.entries(map).map(([k, { value, items }]) => ({
    key: k,
    actual_pct: total > 0 ? value / total : 0,
    market_value: value,
    items,
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

function RebalanceSection({ title, rows, total, getTarget, setTarget, onPick }: {
  title: string
  rows: { key: string; actual_pct: number; level: string; label?: string; items?: PortfolioPosition[] }[]
  total: number
  getTarget: (level: string, key: string) => number
  setTarget: (level: string, key: string, pct: number) => void
  onPick?: (p: PortfolioPosition[]) => void
}) {
  return (
    <div className="bg-surface-card rounded-card shadow-card p-[13px] flex flex-col min-w-0">
      <p className="text-subhead font-medium text-ink mb-2">{title}</p>
      {/* 3열 카드에 들어가도록 한 항목을 2줄로 접는다.
          윗줄 = 이름 · 현재 비중 / 아랫줄 = 목표 · 차이 · 필요 금액 */}
      <div className="flex flex-col">
        {rows.map(({ key, actual_pct, level, label, items }) => {
          const target = getTarget(level, key)
          const diff = actual_pct - target
          const needed = (target - actual_pct) * total
          const clickable = Boolean(onPick && items?.length)
          return (
            <div key={key} className="py-2 border-b border-surface-low last:border-0">
              <div className="flex items-baseline justify-between gap-2 min-w-0">
                {clickable ? (
                  <button type="button" onClick={() => onPick?.(items!)}
                    className="text-body font-medium text-ink truncate text-left hover:underline underline-offset-2 min-w-0">
                    {label ?? key}
                  </button>
                ) : (
                  <span className="text-body font-medium text-ink truncate min-w-0">{label ?? key}</span>
                )}
                <span className="text-body font-medium text-ink tabular-nums shrink-0">
                  {(actual_pct * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-micro tracking-normal text-ink-5 shrink-0">목표</span>
                  <TargetInput value={target} onChange={v => setTarget(level, key, v)} />
                  <span className={`text-micro tracking-normal font-bold tabular-nums shrink-0 ${diffColor(diff)}`}>
                    {diff >= 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                  </span>
                </div>
                <span className={`text-micro tracking-normal tabular-nums shrink-0 ${needed >= 0 ? 'text-loss' : 'text-gain'}`}>
                  {Math.round(Math.abs(needed) / 10000).toLocaleString()}만원 {needed >= 0 ? '매수' : '매도'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** 종목 상세 레이어 — 종목 탭과 같은 언어(태그 pill + 지표 카드)로 보여준다 */
function PositionDetail({ items, onClose }: { items: PortfolioPosition[]; onClose: () => void }) {
  const sec = items[0].security
  const qty = items.reduce((s, p) => s + p.quantity, 0)
  const invested = items.reduce((s, p) => s + p.total_invested, 0)
  const value = items.reduce((s, p) => s + p.market_value, 0)
  const pnl = value - invested
  const pct = invested > 0 ? (pnl / invested) * 100 : null
  const price = items[0].current_price
  const isUSD = sec.currency === 'USD'
  const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
  const metrics: { label: string; value: string; color?: string }[] = [
    { label: '현재가', value: isUSD ? `$${price.toLocaleString()}` : won(price) },
    { label: '보유수량', value: qty.toLocaleString() },
    { label: '평균매수금액', value: won(invested) },
    { label: '평가금액', value: won(value) },
    { label: '평가손익', value: `${pnl >= 0 ? '+' : ''}${won(pnl)}`, color: pnl >= 0 ? 'text-gain' : 'text-loss' },
    { label: '수익률', value: pct != null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '—',
      color: pct == null ? undefined : pct >= 0 ? 'text-gain' : 'text-loss' },
  ]

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.containerLg} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-micro font-bold px-2 py-0.5 rounded-full font-mono bg-surface-low text-ink-2">
                {sec.ticker}
              </span>
              {[sec.asset_class, sec.country, sec.sector, sec.etf_style].filter(Boolean).map(t => (
                <span key={t} className="text-micro tracking-normal px-2 py-0.5 rounded-full bg-surface-low text-ink-2">{t}</span>
              ))}
              <span className="text-micro tracking-normal text-ink-5 ml-0.5">{sec.currency}</span>
            </div>
            <p className="text-title text-ink truncate">{sec.name}</p>
          </div>
          <button onClick={onClose} className={modal.close}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modal.body}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {metrics.map(m => (
              <div key={m.label} className="rounded-card bg-surface-low px-[13px] py-[11px] min-w-0">
                <p className="text-micro text-ink-5 uppercase">{m.label}</p>
                <p className={`text-heading tabular-nums mt-1 truncate ${m.color ?? 'text-ink'}`}>{m.value}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="text-micro text-ink-5 uppercase mb-1.5">계좌별 보유</p>
            <div className="rounded-card bg-surface-low px-[13px] py-1">
              {items.map((p, i) => (
                <div key={i} className="flex items-baseline justify-between gap-2 py-[5px] border-b border-surface-container last:border-0">
                  <span className="text-body text-ink-2 truncate">{p.account.name}</span>
                  <span className="text-body font-medium text-ink tabular-nums shrink-0">
                    {p.quantity.toLocaleString()} · {won(p.market_value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function RebalanceDashboard({ summary, targets }: Props) {
  const [editTargets, setEditTargets] = useState<TargetAllocation[]>(targets)
  const [detail, setDetail] = useState<PortfolioPosition[] | null>(null)
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

      {/* 표가 옆으로 지나치게 넓어지지 않도록 섹션을 3열 카드로 나란히 둔다.
          모바일 1열 · 태블릿 2열 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
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
            .map(r => ({ ...r, level: 'ticker', label: r.items[0]?.security.name ?? r.key }))}
          total={total} getTarget={getTarget} setTarget={setTarget}
          onPick={setDetail}
        />
      </div>

      {detail ? <PositionDetail items={detail} onClose={() => setDetail(null)} /> : null}
    </div>
  )
}
