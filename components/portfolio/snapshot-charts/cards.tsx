'use client'

// KPI·연도 필터·기간 성과·태그/분해 카드 (SnapshotCharts.tsx에서 분리)
import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from 'recharts'
import { btn, color as tone } from '@/lib/styles'
import { chartSeriesColor, CHART_SERIES } from '@/lib/palettes'
import type { ChartTooltipProps } from '@/lib/chartTypes'
import type { SnapshotViewMode } from '../SnapshotList'
import { SNAPSHOT_VIEW_LABELS } from '../SnapshotList'
import type { PeriodPerformance } from '@/lib/portfolio/metrics'
import { SnapshotPoint, bucketize, fmtKrw, fmtPct, fmtPctSigned, fmtY, keysAboveThreshold, labelIndices, segmentLabel, textOn, topKeysByMean } from './helpers'

export function KpiCard({ label, value, sub, subColor }: {
  label: string
  value: string
  sub?: string
  subColor?: string
}) {
  return (
    <div className="bg-surface-card rounded-card px-[13px] py-3">
      <p className="text-micro tracking-normal text-ink-4 mb-1">{label}</p>
      <p className="text-heading font-bold text-ink tabular-nums leading-tight">{value}</p>
      {sub ? <p className={`text-micro tracking-normal tabular-nums mt-1 ${subColor ?? 'text-ink-4'}`}>{sub}</p> : null}
    </div>
  )
}

/** 기간 필터 — 연도 + 월초/월말 보기 */
export function YearFilterRow({ years, year, onYear, view, onView, count }: {
  years: number[]
  year: number | 'all'
  onYear: (y: number | 'all') => void
  view: SnapshotViewMode
  onView: (v: SnapshotViewMode) => void
  count: number
}) {
  return (
    <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <button onClick={() => onYear('all')} className={btn.pill(year === 'all')}>전체</button>
        {years.map(y => (
          <button key={y} onClick={() => onYear(y)} className={btn.pill(year === y)}>{y}년</button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {(Object.keys(SNAPSHOT_VIEW_LABELS) as SnapshotViewMode[]).map(m => (
          <button key={m} onClick={() => onView(m)} className={btn.pill(view === m)}>
            {SNAPSHOT_VIEW_LABELS[m]}
          </button>
        ))}
        <span className="text-micro tracking-normal text-ink-5 ml-1">{count}개 시점</span>
      </div>
    </div>
  )
}

/** 기간 성과 — 선택 구간의 신규 투자금과 수익률(Modified Dietz · TWR) */
export function PerformanceCard({ perf, year, anchoredFromPrevYear }: {
  perf: PeriodPerformance
  year: number | 'all'
  anchoredFromPrevYear: boolean
}) {
  const gainColor = perf.gain >= 0 ? 'text-gain' : 'text-loss'
  const items: { label: string; value: string; sub?: string; color?: string }[] = [
    {
      label: '기초 평가액',
      value: fmtKrw(perf.beginValue),
      sub: anchoredFromPrevYear ? `${perf.from} 기준` : `${perf.from} 첫 스냅샷`,
    },
    {
      label: '신규 투자금',
      value: fmtKrw(perf.newInvestment),
      sub: perf.usesCostFallback
        ? `입금 ${fmtY(perf.deposits)}${perf.withdrawals > 0 ? ` · 출금 ${fmtY(perf.withdrawals)}` : ''} + 매수원가 증분 ${fmtY(perf.costDelta)}`
        : `입금 ${fmtY(perf.deposits)}${perf.withdrawals > 0 ? ` · 출금 ${fmtY(perf.withdrawals)}` : ''}`,
    },
    {
      label: '기간 수익금액',
      value: `${perf.gain >= 0 ? '+' : ''}${fmtKrw(perf.gain)}`,
      sub: `${perf.to} 평가액 ${fmtY(perf.endValue)}`,
      color: gainColor,
    },
    {
      label: '수익률',
      value: perf.dietz != null ? fmtPctSigned(perf.dietz * 100) : '—',
      sub: '투입 시점 가중 (Modified Dietz)',
      color: perf.dietz != null && perf.dietz < 0 ? 'text-loss' : 'text-gain',
    },
    {
      label: 'TWR',
      value: perf.twr != null ? fmtPctSigned(perf.twr * 100) : '—',
      sub: '입금 타이밍 제외 · 스냅샷 구간 연쇄',
      color: perf.twr != null && perf.twr < 0 ? 'text-loss' : 'text-gain',
    },
  ]

  return (
    <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h3 className="text-subhead font-medium text-ink">
          {year === 'all' ? '전체 기간 성과' : `${year}년 성과`}
        </h3>
        {!anchoredFromPrevYear ? (
          <p className="text-micro tracking-normal text-warning">
            직전 연도 스냅샷이 없어 {perf.from}부터 집계한 부분 연도입니다
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3">
        {items.map(it => (
          <div key={it.label}>
            <p className="text-micro tracking-normal text-ink-4 mb-1">{it.label}</p>
            <p className={`text-subhead font-bold tabular-nums leading-tight ${it.color ?? 'text-ink'}`}>{it.value}</p>
            {it.sub ? <p className="text-micro tracking-normal text-ink-5 mt-1">{it.sub}</p> : null}
          </div>
        ))}
      </div>
      <p className="text-micro tracking-normal text-ink-5 mt-3">
        수익금액 = 기말 평가액 − 기초 평가액 − 순유입
        {perf.usesCostFallback ? ' · 입출금 원장이 없는 계좌는 매수원가 증분으로 근사합니다' : ''}
      </p>
    </div>
  )
}

export function TagBreakdownCard({ points }: { points: SnapshotPoint[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [threshold, setThreshold] = useState(5)

  const allTags = useMemo(() => {
    const sum: Record<string, number> = {}
    for (const p of points) for (const [k, v] of Object.entries(p.tag_breakdown)) {
      sum[k] = (sum[k] ?? 0) + v
    }
    return Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [points])

  const visibleTags = useMemo(() => {
    if (selected.size > 0) return [...selected].sort()
    return keysAboveThreshold(points, p => p.tag_breakdown, threshold)
  }, [points, selected, threshold])

  const data = useMemo(() => points.map(p => {
    const row: Record<string, number | string> = { date: p.date, total_market_value: p.total_market_value }
    for (const t of visibleTags) row[t] = p.tag_breakdown[t] ?? 0
    return row
  }), [points, visibleTags])

  const labelIdx = useMemo(() => {
    const m: Record<string, Set<number>> = {}
    for (const t of visibleTags) {
      m[t] = new Set(labelIndices(data.map(d => Number(d[t] ?? 0)), 8))
    }
    return m
  }, [visibleTags, data])

  // 태그 색도 전체 합계 순번 고정 — 칩 선택/임계치를 바꿔도 같은 태그는 같은 색
  const colorRank = useMemo(
    () => Object.fromEntries(allTags.map((t, i) => [t, i])),
    [allTags],
  )
  function colorFor(k: string): string {
    return chartSeriesColor(colorRank[k] ?? 0)
  }

  function toggle(t: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-subhead font-medium text-ink">태그 비중 변화</h3>
          <p className="text-micro tracking-normal text-ink-4 mt-0.5">
            태그를 가진 종목 합산 — 한 종목이 여러 태그면 중복 합산
          </p>
        </div>
        {selected.size === 0 ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro tracking-normal text-ink-4">임계치</span>
            <input type="range" min={1} max={20} step={1} value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-20 accent-ink-4 bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
            <span className="text-micro tracking-normal tabular-nums text-ink-3 w-7">{threshold}%</span>
          </div>
        ) : (
          <button onClick={() => setSelected(new Set())}
            className="text-micro tracking-normal text-ink-4 hover:text-ink-2 transition-colors shrink-0">
            선택 해제
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {allTags.slice(0, 50).map(t => {
            const active = selected.has(t)
            return (
              <button key={t}
                onClick={() => toggle(t)}
                className={`text-micro tracking-normal px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'text-white border-transparent'
                    : 'border-surface-low text-ink-3'
                }`}
                style={active ? { backgroundColor: CHART_SERIES[0] } : undefined}>
                #{t}
              </button>
            )
          })}
          {allTags.length > 50 ? (
            <span className="text-micro tracking-normal text-ink-5 self-center">+{allTags.length - 50}</span>
          ) : null}
        </div>
      </div>

      {visibleTags.length === 0 ? (
        <p className="text-body text-ink-4 py-12 text-center">표시할 태그가 없습니다. 칩을 선택하거나 임계치를 낮춰주세요.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tone.surfaceContainer} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: tone.ink5 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={<BreakdownTooltip />} />
              {visibleTags.map((k, i) => (
                <Bar key={k} dataKey={k} name={k} stackId="a" fill={colorFor(k)}>
                  <LabelList dataKey={k} content={segmentLabel(labelIdx[k] ?? new Set(), fmtPct, textOn(colorFor(k)))} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-x-2 gap-y-1 mt-3">
            {visibleTags.map((k, i) => (
              <span key={k} className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(k) }} />
                {k}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function StackedBreakdownCard({
  title,
  points,
  accessor,
  topN,
  threshold,
  enableTopNControl,
  description,
}: {
  title: string
  points: SnapshotPoint[]
  accessor: (p: SnapshotPoint) => Record<string, number>
  topN?: number
  threshold?: number
  enableTopNControl?: boolean
  description?: string
}) {
  const [n, setN] = useState(topN ?? 7)
  const [thr, setThr] = useState(threshold ?? 3)

  const keys = useMemo(() => {
    if (threshold !== undefined) return keysAboveThreshold(points, accessor, thr)
    return topKeysByMean(points, accessor, n)
  }, [points, accessor, n, thr, threshold])

  const data = useMemo(() => points.map(p => ({
    date: p.date,
    total_market_value: p.total_market_value,
    ...bucketize(accessor(p), keys),
  })), [points, accessor, keys])

  const chartKeys = useMemo(() => {
    const set = new Set<string>()
    for (const d of data) for (const k of Object.keys(d)) {
      if (k !== 'date' && k !== 'total_market_value') set.add(k)
    }
    return [...set]
  }, [data])

  // 색은 항목의 고정 순번(전체 기간 합계 내림차순)을 따른다.
  // Top N·임계치를 움직여도 남은 항목의 색이 바뀌지 않게 하기 위해서다.
  const colorRank = useMemo(() => {
    const all = topKeysByMean(points, accessor, Number.MAX_SAFE_INTEGER)
    return Object.fromEntries(all.map((k, i) => [k, i]))
  }, [points, accessor])

  function colorFor(k: string): string {
    if (k === '기타') return tone.ink5
    return chartSeriesColor(colorRank[k] ?? 0)
  }

  // 계열마다 라벨 인덱스를 따로 고른다 (열이 좁으면 최근 → 최고 → 최저)
  const labelIdx = useMemo(() => {
    const m: Record<string, Set<number>> = {}
    for (const k of chartKeys) {
      m[k] = new Set(labelIndices(data.map(d => Number((d as Record<string, number | string>)[k] ?? 0)), 8))
    }
    return m
  }, [chartKeys, data])

  return (
    <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-subhead font-medium text-ink">{title}</h3>
          {description ? <p className="text-micro tracking-normal text-ink-4 mt-0.5">{description}</p> : null}
        </div>
        {enableTopNControl && threshold === undefined ? <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro tracking-normal text-ink-4">Top</span>
            <input type="range" min={3} max={12} value={n}
              onChange={e => setN(Number(e.target.value))}
              className="w-20 accent-ink-4 bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
            <span className="text-micro tracking-normal tabular-nums text-ink-3 w-4">{n}</span>
          </div> : null}
        {threshold !== undefined ? <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro tracking-normal text-ink-4">임계치</span>
            <input type="range" min={1} max={15} step={1} value={thr}
              onChange={e => setThr(Number(e.target.value))}
              className="w-20 accent-ink-4 bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
            <span className="text-micro tracking-normal tabular-nums text-ink-3 w-7">{thr}%</span>
          </div> : null}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={tone.surfaceContainer} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: tone.ink5 }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<BreakdownTooltip />} />
          {chartKeys.map((k, i) => (
            <Bar key={k} dataKey={k} name={k} stackId="a" fill={colorFor(k)}>
              <LabelList dataKey={k} content={segmentLabel(labelIdx[k] ?? new Set(), fmtPct, textOn(colorFor(k)))} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-3">
        {chartKeys.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(k) }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  )
}

export function BreakdownTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const mv = (payload[0]?.payload?.total_market_value as number) ?? 0
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0)
  return (
    <div className="bg-surface-card rounded-field px-3 py-2 shadow-card text-body max-w-[220px]">
      <p className="text-ink-4 mb-1.5">{label}</p>
      {payload.slice().reverse().map((p) => {
        const pct = Number(p.value) || 0
        if (pct <= 0) return null
        const amt = mv * pct / 100
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-ink truncate flex-1">{p.name}</span>
            <span className="tabular-nums text-ink font-medium">{fmtPct(pct)}</span>
            {mv > 0 ? <span className="tabular-nums text-ink-4">{fmtY(amt)}</span> : null}
          </div>
        )
      })}
      <div className="border-t border-surface-low mt-1.5 pt-1.5 flex justify-between">
        <span className="text-ink-4">합계</span>
        <span className="font-medium text-ink">{fmtPct(total)}</span>
      </div>
    </div>
  )
}
