'use client'

// 차트 툴팁 (SnapshotCharts.tsx에서 분리)
import type { ChartTooltipProps } from '@/lib/chartTypes'
import { fmtKrw, fmtPctSigned } from './helpers'

export function ValuesTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Record<string, number | string>
  const mv = Number(row['평가액'] ?? 0)
  const cost = Number(row['평균매수금액'] ?? 0)
  const basis = row['투자원금'] != null ? Number(row['투자원금']) : null
  // 수익: 원장 하이브리드가 있으면 투자원금 대비, 없으면 평가액 − 매수원가
  const profit = row['손익'] != null ? Number(row['손익']) : mv - cost
  const base = basis ?? cost
  const ret = base > 0 ? (profit / base) * 100 : 0
  return (
    <div className="bg-surface-card rounded-field px-3 py-2 shadow-card text-body">
      <p className="text-ink-4 mb-1.5">{label}</p>
      <div className="flex justify-between gap-3">
        <span className="text-ink-3">평가액</span>
        <span className="font-bold text-ink tabular-nums">{fmtKrw(mv)}</span>
      </div>
      {basis != null ? (
        <div className="flex justify-between gap-3">
          <span className="text-ink-3">투자원금</span>
          <span className="text-ink-2 tabular-nums">{fmtKrw(basis)}</span>
        </div>
      ) : null}
      <div className="flex justify-between gap-3">
        <span className="text-ink-3">평균매수금액</span>
        <span className="text-ink-2 tabular-nums">{fmtKrw(cost)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-surface-low mt-1.5 pt-1.5">
        <span className="text-ink-4">수익</span>
        <span className={`font-medium tabular-nums ${profit >= 0 ? 'text-gain' : 'text-loss'}`}>
          {profit >= 0 ? '+' : ''}{fmtKrw(profit)} ({fmtPctSigned(ret)})
        </span>
      </div>
    </div>
  )
}

export function SinglePnlTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const v = Number(payload[0].value)
  return (
    <div className="bg-surface-card rounded-field px-3 py-2 shadow-card text-body">
      <p className="text-ink-4 mb-0.5">{label}</p>
      <p className={`font-medium tabular-nums ${v >= 0 ? 'text-gain' : 'text-loss'}`}>
        {v >= 0 ? '+' : ''}{fmtKrw(v)}
      </p>
    </div>
  )
}

export function MomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Record<string, number | string>
  const flow = Number(row['투자원금'] ?? 0)
  const gain = Number(row['수익'] ?? 0)
  const total = Number(row['증감'] ?? 0)
  if (total === 0 && flow === 0 && gain === 0) {
    return (
      <div className="bg-surface-card rounded-field px-3 py-2 shadow-card text-body">
        <p className="text-ink-4 mb-0.5">{label}</p>
        <p className="text-ink-3">시작점</p>
      </div>
    )
  }
  return (
    <div className="bg-surface-card rounded-field px-3 py-2 shadow-card text-body">
      <p className="text-ink-4 mb-1.5">{label}</p>
      <div className="flex justify-between gap-3">
        <span className="text-ink-3">투자원금</span>
        <span className="text-ink-2 tabular-nums">{flow >= 0 ? '+' : ''}{fmtKrw(flow)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-ink-3">수익</span>
        <span className={`font-medium tabular-nums ${gain >= 0 ? 'text-gain' : 'text-loss'}`}>
          {gain >= 0 ? '+' : ''}{fmtKrw(gain)}
        </span>
      </div>
      <div className="flex justify-between gap-3 border-t border-surface-low mt-1.5 pt-1.5">
        <span className="text-ink-4">평가액 증감</span>
        <span className="font-bold text-ink tabular-nums">{total >= 0 ? '+' : ''}{fmtKrw(total)}</span>
      </div>
    </div>
  )
}
