'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LabelList,
  LineChart, Line, ComposedChart, ReferenceLine, Cell,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'
import type { ChartTooltipProps } from '@/lib/chartTypes'

export interface SnapshotPoint {
  date: string
  total_market_value: number
  total_invested: number
  sector_breakdown: Record<string, number>
  asset_class_breakdown: Record<string, number>
  tag_breakdown: Record<string, number>
}

interface Props {
  points: SnapshotPoint[]
  sectorColors?: Record<string, string>
  assetClassColors?: Record<string, string>
}

const POS = '#ef4444'  // 한국식 — 상승 빨강
const NEG = '#3b82f6'  // 한국식 — 하락 파랑

function fmtY(v: number) {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억`
  if (abs >= 10_000_000) return `${sign}${Math.round(abs / 10_000_000)}천만`
  if (abs >= 10_000) return `${sign}${Math.round(abs / 10_000)}만`
  return `${sign}${Math.round(abs)}`
}
function fmtKrw(v: number) {
  return `${Math.round(v).toLocaleString('ko-KR')}원`
}
function fmtPctSigned(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
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
    <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3">
      <p className="text-[10px] text-slate-400 mb-1">{label}</p>
      <p className="text-base font-bold text-slate-700 tabular-nums leading-tight">{value}</p>
      {sub ? <p className={`text-[10px] tabular-nums mt-1 ${subColor ?? 'text-slate-400'}`}>{sub}</p> : null}
    </div>
  )
}

function StackedBreakdownCard({
  title,
  points,
  accessor,
  colorMap,
  topN,
  threshold,
  enableTopNControl,
  description,
}: {
  title: string
  points: SnapshotPoint[]
  accessor: (p: SnapshotPoint) => Record<string, number>
  colorMap: Record<string, string>
  topN?: number
  threshold?: number
  enableTopNControl?: boolean
  description?: string
}) {
  const { palette } = useTheme()
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

  const fallback = [palette.colors[0], palette.colors[1], palette.colors[2], palette.colors[3]]
  function colorFor(k: string, i: number): string {
    if (k === '기타') return '#cbd5e1'
    return colorMap[k] ?? fallback[i % fallback.length]
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {description ? <p className="text-[10px] text-slate-400 mt-0.5">{description}</p> : null}
        </div>
        {enableTopNControl && threshold === undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400">Top</span>
            <input type="range" min={3} max={12} value={n}
              onChange={e => setN(Number(e.target.value))}
              className="w-20 accent-slate-400" />
            <span className="text-[10px] tabular-nums text-slate-500 w-4">{n}</span>
          </div>
        )}
        {threshold !== undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] text-slate-400">임계치</span>
            <input type="range" min={1} max={15} step={1} value={thr}
              onChange={e => setThr(Number(e.target.value))}
              className="w-20 accent-slate-400" />
            <span className="text-[10px] tabular-nums text-slate-500 w-7">{thr}%</span>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip content={<BreakdownTooltip />} />
          {chartKeys.map((k, i) => (
            <Bar key={k} dataKey={k} name={k} stackId="a" fill={colorFor(k, i)} />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-1 mt-3">
        {chartKeys.map((k, i) => (
          <span key={k} className="inline-flex items-center gap-1 text-[10px] text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorFor(k, i) }} />
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
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs max-w-[220px]">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.slice().reverse().map((p) => {
        const pct = Number(p.value) || 0
        if (pct <= 0) return null
        const amt = mv * pct / 100
        return (
          <div key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-700 truncate flex-1">{p.name}</span>
            <span className="tabular-nums text-slate-800 font-medium">{pct.toFixed(1)}%</span>
            {mv > 0 ? <span className="tabular-nums text-slate-400">{fmtY(amt)}</span> : null}
          </div>
        )
      })}
      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between">
        <span className="text-slate-400">합계</span>
        <span className="font-semibold text-slate-700">{total.toFixed(1)}%</span>
      </div>
    </div>
  )
}

export default function SnapshotCharts({ points, sectorColors = {}, assetClassColors = {} }: Props) {
  const { palette } = useTheme()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  if (points.length < 2) return null

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

  const composedData = points.map(p => ({
    date: p.date,
    평가액: p.total_market_value,
    투자원금: p.total_invested,
    손익: p.total_market_value - p.total_invested,
  }))

  const pnlData = composedData.map(d => ({ date: d.date, 손익: d.손익 }))

  const momData = points.map((p, i) => {
    if (i === 0) return { date: p.date, 증감: 0 }
    return { date: p.date, 증감: p.total_market_value - points[i - 1].total_market_value }
  })

  return (
    <div className="space-y-4">

      {needsBackfill && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-amber-700">
            자산군·태그 분해 데이터가 비어 있습니다. 한 번 새로고침이 필요합니다.
          </p>
          <button onClick={handleBackfill} disabled={refreshing}
            className="text-xs px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors">
            {refreshing ? '계산 중...' : '값 새로고침'}
          </button>
        </div>
      )}

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="현재 평가액"
          value={fmtKrw(currentValue)}
          sub={`첫 스냅샷 대비 ${fmtPctSigned(pctFromFirst)} (${fmtY(diffFromFirst)})`}
          subColor={diffFromFirst >= 0 ? 'text-rose-500' : 'text-blue-500'}
        />
        <KpiCard
          label="누적 손익"
          value={fmtKrw(currentPnl)}
          sub={`수익률 ${fmtPctSigned(currentReturn * 100)}`}
          subColor={currentPnl >= 0 ? 'text-rose-500' : 'text-blue-500'}
        />
        <KpiCard
          label="투자 원금"
          value={fmtKrw(currentInvested)}
          sub={`첫 스냅샷 대비 ${fmtY(investedDiffFromFirst)}`}
        />
        <KpiCard
          label="직전 대비"
          value={prev ? fmtPctSigned(pctFromPrev) : '-'}
          sub={prev ? `${fmtY(diffFromPrev)} (${prev.date} → ${last.date})` : undefined}
          subColor={diffFromPrev >= 0 ? 'text-rose-500' : 'text-blue-500'}
        />
      </div>

      {/* 평가액 vs 투자원금 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">평가액 vs 투자원금</h3>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={composedData} margin={{ left: 0, right: 8, top: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<ValuesTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="평가액" fill={palette.colors[0]} radius={[4, 4, 0, 0]}>
              <LabelList dataKey="평가액" position="top" formatter={(v: number) => fmtY(v)}
                style={{ fontSize: 10, fill: '#94a3b8' }} />
            </Bar>
            <Line type="monotone" dataKey="투자원금" stroke="#64748b" strokeWidth={2}
              dot={{ r: 3, fill: '#fff', stroke: '#64748b' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 누적 손익 라인 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">누적 손익 추이</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={pnlData} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
              tickFormatter={(v) => fmtY(v)} width={50} />
            <Tooltip content={<SinglePnlTooltip />} />
            <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="손익" stroke={currentPnl >= 0 ? POS : NEG} strokeWidth={2.5}
              dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* MoM 증감 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">직전 대비 증감</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={momData} margin={{ left: 0, right: 8, top: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<MomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Bar dataKey="증감" radius={[4, 4, 4, 4]}>
              {momData.map((d, i) => (
                <Cell key={i} fill={d.증감 >= 0 ? POS : NEG} />
              ))}
              <LabelList dataKey="증감" position="top" formatter={(v: number) => v === 0 ? '' : fmtY(v)}
                style={{ fontSize: 10, fill: '#64748b' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 자산군 비중 변화 */}
      <StackedBreakdownCard
        title="자산군 비중 변화"
        description="주식·채권·현금·코인·대체자산 등 자산군 단위"
        points={points}
        accessor={p => p.asset_class_breakdown}
        colorMap={assetClassColors}
        topN={6}
        enableTopNControl={false}
      />

      {/* GICS 섹터 비중 변화 (개별 주식 한정, 합계 != 100) */}
      <StackedBreakdownCard
        title="GICS 섹터 비중 변화"
        description="개별 주식만 집계 — ETF/채권/현금/코인 제외 (합계가 100% 미만)"
        points={points}
        accessor={p => p.sector_breakdown}
        colorMap={sectorColors}
        topN={7}
        enableTopNControl={true}
      />

      {/* 태그 비중 변화 (임계치 기반) */}
      <StackedBreakdownCard
        title="태그 비중 변화"
        description="태그를 가진 종목 합산 — 한 종목이 여러 태그면 중복 합산"
        points={points}
        accessor={p => p.tag_breakdown}
        colorMap={{}}
        threshold={5}
      />

    </div>
  )
}

function ValuesTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const mv = Number(payload.find(p => p.dataKey === '평가액')?.value ?? 0)
  const inv = Number(payload.find(p => p.dataKey === '투자원금')?.value ?? 0)
  const pnl = mv - inv
  const ret = inv > 0 ? (pnl / inv) * 100 : 0
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-1.5">{label}</p>
      <div className="flex justify-between gap-3">
        <span className="text-slate-500">평가액</span>
        <span className="font-semibold text-slate-700 tabular-nums">{fmtKrw(mv)}</span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="text-slate-500">투자원금</span>
        <span className="text-slate-600 tabular-nums">{fmtKrw(inv)}</span>
      </div>
      <div className="flex justify-between gap-3 border-t border-slate-100 mt-1.5 pt-1.5">
        <span className="text-slate-400">손익</span>
        <span className={`font-semibold tabular-nums ${pnl >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
          {pnl >= 0 ? '+' : ''}{fmtKrw(pnl)} ({fmtPctSigned(ret)})
        </span>
      </div>
    </div>
  )
}

function SinglePnlTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const v = Number(payload[0].value)
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className={`font-semibold tabular-nums ${v >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
        {v >= 0 ? '+' : ''}{fmtKrw(v)}
      </p>
    </div>
  )
}

function MomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const v = Number(payload[0].value)
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      <p className="text-slate-400 mb-0.5">{label}</p>
      <p className={`font-semibold tabular-nums ${v >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
        {v === 0 ? '시작점' : `${v >= 0 ? '+' : ''}${fmtKrw(v)}`}
      </p>
    </div>
  )
}
