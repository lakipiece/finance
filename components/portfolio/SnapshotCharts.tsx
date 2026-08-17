'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
  LineChart, Line, ReferenceLine, Cell,
} from 'recharts'
import { btn } from '@/lib/styles'
import { chartSeriesColor, CHART_SERIES } from '@/lib/palettes'
import type { ChartTooltipProps } from '@/lib/chartTypes'
import type { SnapshotViewMode } from './SnapshotList'
import { SNAPSHOT_VIEW_LABELS } from './SnapshotList'
import { snapshotMetrics, periodPerformance } from '@/lib/portfolio/metrics'
import type { AccountCashflowEvent, AccountSnapshotEntry, PeriodPerformance } from '@/lib/portfolio/metrics'

export interface SnapshotPoint {
  date: string
  total_market_value: number
  total_invested: number
  sector_breakdown: Record<string, number>
  asset_class_breakdown: Record<string, number>
  tag_breakdown: Record<string, number>
  account_breakdown?: Record<string, AccountSnapshotEntry>
}

interface Props {
  points: SnapshotPoint[]

  cashflowEvents?: AccountCashflowEvent[]
  initialView?: SnapshotViewMode
}

/** 월별 최초/최종/전체 필터 (points는 date ASC) */
function filterByView(points: SnapshotPoint[], view: SnapshotViewMode): SnapshotPoint[] {
  if (view === 'all') return points
  const byMonth = new Map<string, SnapshotPoint[]>()
  for (const p of points) {
    const ym = p.date.slice(0, 7)
    if (!byMonth.has(ym)) byMonth.set(ym, [])
    byMonth.get(ym)!.push(p)
  }
  return [...byMonth.values()].map(items =>
    view === 'first' ? items[0] : items[items.length - 1]
  )
}

const POS = '#ef4444'  // 한국식 — 상승 빨강
const NEG = '#3b82f6'  // 한국식 — 하락 파랑

/**
 * 값 라벨이 축 눈금과 겹치지 않게 위아래로 여백을 준다.
 * 0을 넘겨 잡으면 막대가 축 밖으로 나가므로 0은 항상 범위 안에 둔다.
 */
const LABEL_HEADROOM: [(min: number) => number, (max: number) => number] = [
  (min: number) => Math.min(0, min * 1.18),
  (max: number) => Math.max(0, max * 1.12),
]

/** 차트 위 금액 — 백만원 자리까지 보이도록 단위별로 소수점을 남긴다 */
function fmtY(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(2)}억`
  if (abs >= 10_000_000) return `${sign}${(abs / 10_000_000).toFixed(1)}천만`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`
  return `${sign}${Math.round(abs)}`
}
function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}
function fmtPctSigned(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}
function fmtPct(v: number) {
  return `${Math.round(v)}%`
}

/**
 * 차트에 값 라벨을 붙일 인덱스.
 * 열이 넉넉하면 전부, 좁으면 겹치지 않는 선에서 최근 → 최고 → 최저 순으로 고른다.
 */
function labelIndices(values: number[], allUpTo = 10): number[] {
  const n = values.length
  if (n === 0) return []
  if (n <= allUpTo) return values.map((_, i) => i)
  const gap = Math.ceil(n / allUpTo)
  let maxI = 0
  let minI = 0
  values.forEach((v, i) => {
    if (v > values[maxI]) maxI = i
    if (v < values[minI]) minI = i
  })
  const picked: number[] = []
  for (const i of [n - 1, maxI, minI]) {
    if (picked.some(p => Math.abs(p - i) < gap)) continue
    picked.push(i)
  }
  return picked
}

interface LabelRenderProps {
  x?: number | string
  y?: number | string
  width?: number | string
  height?: number | string
  value?: number | string
  index?: number
}

/** 점(라인) 값 라벨 — 양수는 점 위, 음수는 점 아래. picked 인덱스만 그린다 */
function pointLabel(picked: Set<number>, lastIndex: number, fill: string) {
  return function renderPointLabel(props: LabelRenderProps) {
    const { x, y, index, value } = props
    if (index == null || !picked.has(index)) return null
    const v = Number(value)
    if (!Number.isFinite(v)) return null
    const anchor = index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle'
    const ty = v < 0 ? Number(y) + 14 : Number(y) - 8
    return (
      <text x={Number(x)} y={ty} textAnchor={anchor} fontSize={10} fill={fill} fontWeight={500}>
        {fmtY(v)}
      </text>
    )
  }
}

/** 배경색 위에 올릴 글자색 — 밝은 조각에는 잉크, 어두운 조각에는 흰색 */
function textOn(bg: string): string {
  const hex = bg.replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if ([r, g, b].some(n => Number.isNaN(n))) return '#ffffff'
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#0d1c2e' : '#ffffff'
}

/**
 * 막대 바깥 값 라벨 — 양수는 막대 위, 음수는 막대 아래.
 * Recharts는 음수 막대에 음수 height를 주고 y를 아래 끝에 놓는다.
 * 부호를 가정하지 말고 두 끝을 정렬해서 위/아래를 잡는다.
 */
function barTopLabel(picked: Set<number>, fill: string) {
  return function renderBarTopLabel(props: LabelRenderProps) {
    const { x, y, width, height, index, value } = props
    if (index == null || !picked.has(index)) return null
    const raw = Number(value)
    if (!Number.isFinite(raw) || raw === 0) return null
    const w = Number(width)
    const y0 = Number(y)
    const y1 = y0 + Number(height)
    const ty = raw < 0 ? Math.max(y0, y1) + 12 : Math.min(y0, y1) - 6
    return (
      <text x={Number(x) + w / 2} y={ty} textAnchor="middle" fontSize={10} fill={fill} fontWeight={500}>
        {fmtY(raw)}
      </text>
    )
  }
}

/** 스택 막대 조각 안쪽 값 라벨 — picked 인덱스 + 충분한 높이일 때만 */
function segmentLabel(
  picked: Set<number>,
  fmt: (v: number) => string,
  fill = '#fff',
  minHeight = 15,
) {
  return function renderSegmentLabel(props: LabelRenderProps) {
    const { x, y, width, height, index, value } = props
    if (index == null || !picked.has(index)) return null
    const h = Math.abs(Number(height))
    const w = Number(width)
    const v = Number(value)
    if (!Number.isFinite(v) || v <= 0 || !(h >= minHeight)) return null
    const top = Math.min(Number(y), Number(y) + Number(height))
    return (
      <text x={Number(x) + w / 2} y={top + h / 2} textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight={700} fill={fill}>
        {fmt(v)}
      </text>
    )
  }
}

function bucketize(breakdown: Record<string, number>, keys: string[]): Record<string, number> {
  const keep: Record<string, number> = {}
  let others = 0
  for (const k of keys) keep[k] = breakdown[k] ?? 0
  for (const [k, v] of Object.entries(breakdown)) {
    if (!keys.includes(k)) others += v
  }
  if (others > 0) keep['기타'] = (keep['기타'] ?? 0) + Math.round(others * 10) / 10
  return keep
}

function topKeysByMean(points: SnapshotPoint[], accessor: (p: SnapshotPoint) => Record<string, number>, n: number): string[] {
  const sum: Record<string, number> = {}
  for (const p of points) {
    for (const [k, v] of Object.entries(accessor(p))) sum[k] = (sum[k] ?? 0) + v
  }
  return Object.entries(sum)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k)
}

function keysAboveThreshold(points: SnapshotPoint[], accessor: (p: SnapshotPoint) => Record<string, number>, thresholdPct: number): string[] {
  const max: Record<string, number> = {}
  for (const p of points) {
    for (const [k, v] of Object.entries(accessor(p))) {
      if (v > (max[k] ?? 0)) max[k] = v
    }
  }
  return Object.entries(max).filter(([, v]) => v >= thresholdPct).sort((a, b) => b[1] - a[1]).map(([k]) => k)
}

function KpiCard({ label, value, sub, subColor }: {
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
function YearFilterRow({ years, year, onYear, view, onView, count }: {
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
function PerformanceCard({ perf, year, anchoredFromPrevYear }: {
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

function TagBreakdownCard({ points }: { points: SnapshotPoint[] }) {
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
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

function StackedBreakdownCard({
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
    if (k === '기타') return '#a8b3c4'
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
        {enableTopNControl && threshold === undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro tracking-normal text-ink-4">Top</span>
            <input type="range" min={3} max={12} value={n}
              onChange={e => setN(Number(e.target.value))}
              className="w-20 accent-ink-4 bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
            <span className="text-micro tracking-normal tabular-nums text-ink-3 w-4">{n}</span>
          </div>
        )}
        {threshold !== undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-micro tracking-normal text-ink-4">임계치</span>
            <input type="range" min={1} max={15} step={1} value={thr}
              onChange={e => setThr(Number(e.target.value))}
              className="w-20 accent-ink-4 bg-surface-low rounded-field border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus placeholder:text-ink-5 transition-colors" />
            <span className="text-micro tracking-normal tabular-nums text-ink-3 w-7">{thr}%</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
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

function BreakdownTooltip({ active, payload, label }: ChartTooltipProps) {
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
            <span className="tabular-nums text-ink font-medium">{pct.toFixed(1)}%</span>
            {mv > 0 ? <span className="tabular-nums text-ink-4">{fmtY(amt)}</span> : null}
          </div>
        )
      })}
      <div className="border-t border-surface-low mt-1.5 pt-1.5 flex justify-between">
        <span className="text-ink-4">합계</span>
        <span className="font-medium text-ink">{total.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export default function SnapshotCharts({ points: allPoints, cashflowEvents = [], initialView = 'last' }: Props) {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<SnapshotViewMode>(initialView)
  const [year, setYear] = useState<number | 'all'>('all')

  const years = useMemo(() => {
    const set = new Set(allPoints.map(p => Number(p.date.slice(0, 4))))
    return [...set].sort((a, b) => b - a)
  }, [allPoints])

  const viewPoints = useMemo(() => filterByView(allPoints, view), [allPoints, view])

  /**
   * 선택 연도 구간. 앞에 앵커(직전 연도 마지막 스냅샷) 한 개를 붙여 기초 잔고를 만든다.
   * 직전 연도 스냅샷이 없으면 그 해 첫 스냅샷이 앵커가 된다 — 부분 연도.
   */
  const { points, anchoredFromPrevYear } = useMemo(() => {
    if (year === 'all') return { points: viewPoints, anchoredFromPrevYear: true }
    const start = `${year}-01-01`
    const end = `${year}-12-31`
    const inYear = viewPoints.filter(p => p.date >= start && p.date <= end)
    const before = viewPoints.filter(p => p.date < start)
    const anchor = before[before.length - 1]
    return anchor
      ? { points: [anchor, ...inYear], anchoredFromPrevYear: true }
      : { points: inYear, anchoredFromPrevYear: false }
  }, [viewPoints, year])

  const performance = useMemo(() => periodPerformance(
    points.map(p => ({
      date: p.date,
      value: p.total_market_value,
      breakdown: p.account_breakdown ?? {},
    })),
    cashflowEvents,
  ), [points, cashflowEvents])

  if (points.length < 2) {
    return (
      <div className="space-y-4">
        <YearFilterRow years={years} year={year} onYear={setYear} view={view} onView={setView} count={points.length} />
        <div className="bg-surface-card rounded-card px-[13px] py-10 text-center">
          <p className="text-body text-ink-4">
            {year === 'all' ? '스냅샷이 2개 이상 필요합니다.' : `${year}년 스냅샷이 2개 미만이라 표시할 추이가 없습니다.`}
          </p>
        </div>
      </div>
    )
  }

  const hasLedger = cashflowEvents.length > 0

  const needsBackfill = points.every(p =>
    Object.keys(p.asset_class_breakdown).length === 0 &&
    Object.keys(p.tag_breakdown).length === 0
  )

  async function handleBackfill() {
    setRefreshing(true)
    try {
      await fetch('/api/portfolio/snapshots/refresh-values', { method: 'POST' })
      router.refresh()
    } finally {
      setRefreshing(false)
    }
  }

  const first = points[0]
  const last = points[points.length - 1]
  const prev = points.length >= 2 ? points[points.length - 2] : null

  const currentValue = last.total_market_value
  const currentInvested = last.total_invested
  const currentPnl = currentValue - currentInvested
  const currentReturn = currentInvested > 0 ? currentPnl / currentInvested : 0

  const diffFromFirst = currentValue - first.total_market_value
  const pctFromFirst = first.total_market_value > 0 ? (diffFromFirst / first.total_market_value) * 100 : 0
  const diffFromPrev = prev ? currentValue - prev.total_market_value : 0
  const pctFromPrev = prev && prev.total_market_value > 0 ? (diffFromPrev / prev.total_market_value) * 100 : 0
  const investedDiffFromFirst = currentInvested - first.total_invested

  // 계좌별 하이브리드 지표 (원장 계좌 누적입금 | 미기록 계좌 매수원가) — metrics.ts 공용 로직
  const pointMetrics = points.map(p =>
    hasLedger
      ? snapshotMetrics(p.account_breakdown ?? null, cashflowEvents, p.date, {
          value: p.total_market_value, cost: p.total_invested,
        })
      : null
  )
  const lastM = pointMetrics[pointMetrics.length - 1]
  const currentProfit = lastM?.ledgerApplied ? lastM.profit : null
  const currentProfitRate = lastM?.ledgerApplied ? lastM.rate : null

  // 원금(=넣은 돈) 위에 손익을 쌓아 "얼마 넣어서 얼마가 됐는지"를 막대 하나로 읽게 한다.
  // 손실이면 평가액 위에 손실 조각을 얹어 원금 높이까지 채운다.
  const valueData = points.map((p, i) => {
    const m = pointMetrics[i]
    const basis = m?.ledgerApplied ? m.basis : p.total_invested
    const mv = p.total_market_value
    const profit = mv - basis
    return {
      date: p.date,
      원금: Math.min(basis, mv),
      수익: profit > 0 ? profit : 0,
      손실: profit < 0 ? -profit : 0,
      평가액: mv,
      평균매수금액: p.total_invested,
      ...(m?.ledgerApplied ? { 투자원금: basis } : {}),
      손익: profit,
    }
  })

  const hasProfitSeries = valueData.some(d => '투자원금' in d)
  const basisLabel = hasProfitSeries ? '투자원금(누적입금)' : '평균매수금액'
  const valueLabelIdx = new Set(labelIndices(valueData.map(d => d.평가액), 9))

  const pnlData = valueData.map(d => ({ date: d.date, 손익: d.손익 }))
  const pnlLabelIdx = new Set(labelIndices(pnlData.map(d => d.손익), 10))

  // 직전 대비 증감을 "넣은 돈"과 "벌어들인 돈"으로 가른다.
  // 구간마다 periodPerformance를 돌려 순유입을 구하고, 나머지가 수익이다.
  const momData = points.map((p, i) => {
    if (i === 0) return { date: p.date, 투자원금: 0, 수익: 0, 증감: 0 }
    const prevPoint = points[i - 1]
    const seg = periodPerformance(
      [prevPoint, p].map(q => ({
        date: q.date,
        value: q.total_market_value,
        breakdown: q.account_breakdown ?? {},
      })),
      cashflowEvents,
    )
    const 증감 = p.total_market_value - prevPoint.total_market_value
    return {
      date: p.date,
      투자원금: seg?.netFlow ?? 0,
      수익: seg ? seg.gain : 증감,
      증감,
    }
  })
  // 두 계열이 나란히 서므로 라벨은 더 성기게 — 8개까지만 전부 표시
  const flowLabelIdx = new Set(labelIndices(momData.map(d => d.투자원금), 8))
  const gainLabelIdx = new Set(labelIndices(momData.map(d => d.수익), 8))

  return (
    <div className="space-y-4">

      {/* 기간 필터 — 연도 + 월초/월말 (스냅샷 목록과 동일한 기준) */}
      <YearFilterRow years={years} year={year} onYear={setYear} view={view} onView={setView} count={points.length} />

      {needsBackfill && (
        <div className="bg-warning/10 border rounded-field px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-body text-warning">
            자산군·태그 분해 데이터가 비어 있습니다. 한 번 새로고침이 필요합니다.
          </p>
          <button onClick={handleBackfill} disabled={refreshing}
            className="text-body px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors">
            {refreshing ? '계산 중...' : '값 새로고침'}
          </button>
        </div>
      )}

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <KpiCard
          label="현재 평가액"
          value={fmtKrw(currentValue)}
          sub={`${first.date} 대비 ${fmtPctSigned(pctFromFirst)} (${fmtY(diffFromFirst)})`}
          subColor={diffFromFirst >= 0 ? 'text-gain' : 'text-loss'}
        />
        {currentProfit != null ? (
          <KpiCard
            label="수익금액"
            value={fmtKrw(currentProfit)}
            sub={`수익률 ${currentProfitRate != null ? fmtPctSigned(currentProfitRate * 100) : '-'} — 계좌별 입금·원가 기준`}
            subColor={currentProfit >= 0 ? 'text-gain' : 'text-loss'}
          />
        ) : (
          <KpiCard
            label="평가손익"
            value={fmtKrw(currentPnl)}
            sub={`수익률 ${fmtPctSigned(currentReturn * 100)} — 매수원가 대비`}
            subColor={currentPnl >= 0 ? 'text-gain' : 'text-loss'}
          />
        )}
        {lastM?.ledgerApplied ? (
          <KpiCard
            label="투자원금"
            value={fmtKrw(lastM.basis)}
            sub={lastM.coversAll
              ? `누적입금${lastM.withdrawals > 0 ? ` · 출금 ${fmtY(lastM.withdrawals)}` : ''}`
              : `입금 ${fmtY(lastM.deposits)} + 미기록 계좌 매수원가`}
          />
        ) : (
          <KpiCard
            label="평균매수금액"
            value={fmtKrw(currentInvested)}
            sub={`${first.date} 대비 ${fmtY(investedDiffFromFirst)}`}
          />
        )}
        <KpiCard
          label="직전 대비"
          value={prev ? fmtPctSigned(pctFromPrev) : '-'}
          sub={prev ? `${fmtY(diffFromPrev)} (${prev.date} → ${last.date})` : undefined}
          subColor={diffFromPrev >= 0 ? 'text-gain' : 'text-loss'}
        />
      </div>

      {/* 기간 성과 — 선택 연도의 신규 투자금·수익률 */}
      {performance ? (
        <PerformanceCard perf={performance} year={year} anchoredFromPrevYear={anchoredFromPrevYear} />
      ) : null}

      {/* 원금 + 손익 = 평가액 */}
      <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
        <h3 className="text-subhead font-medium text-ink mb-0.5">
          {basisLabel} + 손익 = 평가액
        </h3>
        <p className="text-micro tracking-normal text-ink-4 mb-3">
          막대 아래가 넣은 돈, 위에 쌓인 부분이 불어난(줄어든) 금액입니다
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={valueData} margin={{ left: 0, right: 8, top: 26 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<ValuesTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="원금" name={basisLabel} stackId="v" fill={CHART_SERIES[0]}>
              <LabelList dataKey="원금" content={segmentLabel(valueLabelIdx, fmtY, '#ffffff', 16)} />
            </Bar>
            <Bar dataKey="수익" name="수익" stackId="v" fill={POS}>
              <LabelList dataKey="평가액" content={barTopLabel(valueLabelIdx, '#0d1c2e')} />
              <LabelList dataKey="수익" content={segmentLabel(valueLabelIdx, fmtY, '#ffffff', 16)} />
            </Bar>
            <Bar dataKey="손실" name="손실" stackId="v" fill={NEG} fillOpacity={0.35}>
              <LabelList dataKey="손실" content={segmentLabel(valueLabelIdx, fmtY, '#1e40af', 16)} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_SERIES[0] }} />
            {basisLabel}
          </span>
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POS }} />
            수익
          </span>
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEG, opacity: 0.35 }} />
            손실
          </span>
          <span className="text-micro tracking-normal text-ink-5">막대 위 숫자 = 평가액</span>
        </div>
      </div>

      {/* 수익 추이 라인 */}
      <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
        <h3 className="text-subhead font-medium text-ink mb-3">
          {hasProfitSeries ? '수익금액 추이 (평가액＋출금−입금)' : '누적 손익 추이'}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={pnlData} margin={{ left: 0, right: 12, top: 22 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#a8b3c4' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => fmtY(v)} width={54} domain={LABEL_HEADROOM} />
            <Tooltip content={<SinglePnlTooltip />} />
            <ReferenceLine y={0} stroke="#a8b3c4" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="손익" stroke={currentPnl >= 0 ? POS : NEG} strokeWidth={2.5}
              dot={{ r: 3 }}>
              <LabelList dataKey="손익" content={pointLabel(pnlLabelIdx, pnlData.length - 1, '#3d4a5c')} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MoM 증감 — 투자원금 vs 수익 */}
      <div className="bg-surface-card rounded-card px-[13px] py-[11px]">
        <h3 className="text-subhead font-medium text-ink mb-0.5">직전 대비 증감 — 투자원금 · 수익</h3>
        <p className="text-micro tracking-normal text-ink-4 mb-3">
          평가액이 움직인 만큼을 새로 넣은 돈과 벌어들인 돈으로 나눠 나란히 놓았습니다
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={momData} margin={{ left: 0, right: 8, top: 18, bottom: 10 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#a8b3c4' }} axisLine={false} tickLine={false} />
            <YAxis hide domain={LABEL_HEADROOM} />
            <Tooltip content={<MomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <ReferenceLine y={0} stroke="#a8b3c4" />
            <Bar dataKey="투자원금" name="투자원금" fill={CHART_SERIES[0]}>
              <LabelList dataKey="투자원금" content={barTopLabel(flowLabelIdx, '#5b6a80')} />
            </Bar>
            <Bar dataKey="수익" name="수익">
              {momData.map((d, i) => (
                <Cell key={i} fill={d.수익 >= 0 ? POS : NEG} />
              ))}
              <LabelList dataKey="수익" content={barTopLabel(gainLabelIdx, '#5b6a80')} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_SERIES[0] }} />
            투자원금 (입금 − 출금)
          </span>
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POS }} />
            수익
          </span>
          <span className="inline-flex items-center gap-1 text-micro tracking-normal text-ink-3">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEG }} />
            손실
          </span>
        </div>
      </div>

      {/* 자산군 비중 변화 */}
      <StackedBreakdownCard
        title="자산군 비중 변화"
        description="주식·채권·현금·코인·대체자산 등 자산군 단위"
        points={points}
        accessor={p => p.asset_class_breakdown}
        topN={6}
        enableTopNControl={false}
      />

      {/* 태그 비중 변화 (다중 선택) */}
      <TagBreakdownCard points={points} />

      {/* GICS 섹터 비중 변화 (개별 주식 한정, 합계 != 100) */}
      <StackedBreakdownCard
        title="GICS 섹터 비중 변화"
        description="개별 주식만 집계 — ETF/채권/현금/코인 제외 (합계가 100% 미만)"
        points={points}
        accessor={p => p.sector_breakdown}
        topN={7}
        enableTopNControl={true}
      />

    </div>
  )
}

function ValuesTooltip({ active, payload, label }: ChartTooltipProps) {
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

function SinglePnlTooltip({ active, payload, label }: ChartTooltipProps) {
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

function MomTooltip({ active, payload, label }: ChartTooltipProps) {
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
