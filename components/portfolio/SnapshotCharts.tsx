'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, LineChart, Line, ReferenceLine, Cell } from 'recharts'
import { color as tone } from '@/lib/styles'
import { CHART_SERIES } from '@/lib/palettes'
import type { SnapshotViewMode } from './SnapshotList'
import { snapshotMetrics, periodPerformance } from '@/lib/portfolio/metrics'
import type { AccountCashflowEvent } from '@/lib/portfolio/metrics'
import { LABEL_HEADROOM, NEG, POS, SnapshotPoint, barTopLabel, filterByView, fmtKrw, fmtPctSigned, fmtY, labelIndices, pointLabel, segmentLabel } from './snapshot-charts/helpers'
import { KpiCard, PerformanceCard, StackedBreakdownCard, TagBreakdownCard, YearFilterRow } from './snapshot-charts/cards'
import { MomTooltip, SinglePnlTooltip, ValuesTooltip } from './snapshot-charts/tooltips'

export type { SnapshotPoint } from './snapshot-charts/helpers'

interface Props {
  points: SnapshotPoint[]

  cashflowEvents?: AccountCashflowEvent[]
  initialView?: SnapshotViewMode
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

      {needsBackfill ? <div className="bg-warning/10 rounded-field px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-body text-warning">
            자산군·태그 분해 데이터가 비어 있습니다. 한 번 새로고침이 필요합니다.
          </p>
          <button onClick={handleBackfill} disabled={refreshing}
            className="text-body px-3 py-1 rounded-full bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors">
            {refreshing ? '계산 중...' : '값 새로고침'}
          </button>
        </div> : null}

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
            <CartesianGrid strokeDasharray="3 3" stroke={tone.surfaceContainer} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: tone.ink5 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<ValuesTooltip />} cursor={{ fill: tone.surface }} />
            <Bar dataKey="원금" name={basisLabel} stackId="v" fill={CHART_SERIES[0]}>
              <LabelList dataKey="원금" content={segmentLabel(valueLabelIdx, fmtY, tone.white, 16)} />
            </Bar>
            <Bar dataKey="수익" name="수익" stackId="v" fill={POS}>
              <LabelList dataKey="평가액" content={barTopLabel(valueLabelIdx, tone.ink)} />
              <LabelList dataKey="수익" content={segmentLabel(valueLabelIdx, fmtY, tone.white, 16)} />
            </Bar>
            <Bar dataKey="손실" name="손실" stackId="v" fill={NEG} fillOpacity={0.5}>
              <LabelList dataKey="손실" content={segmentLabel(valueLabelIdx, fmtY, tone.loss, 16)} />
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
            <CartesianGrid strokeDasharray="3 3" stroke={tone.surfaceContainer} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: tone.ink5 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: tone.ink5 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => fmtY(v)} width={54} domain={LABEL_HEADROOM} />
            <Tooltip content={<SinglePnlTooltip />} />
            <ReferenceLine y={0} stroke={tone.ink5} strokeDasharray="3 3" />
            <Line type="monotone" dataKey="손익" stroke={currentPnl >= 0 ? POS : NEG} strokeWidth={2.5}
              dot={{ r: 3 }}>
              <LabelList dataKey="손익" content={pointLabel(pnlLabelIdx, pnlData.length - 1, tone.ink2)} />
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
            <CartesianGrid strokeDasharray="3 3" stroke={tone.surfaceContainer} vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: tone.ink5 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={LABEL_HEADROOM} />
            <Tooltip content={<MomTooltip />} cursor={{ fill: tone.surface }} />
            <ReferenceLine y={0} stroke={tone.ink5} />
            <Bar dataKey="투자원금" name="투자원금" fill={CHART_SERIES[0]}>
              <LabelList dataKey="투자원금" content={barTopLabel(flowLabelIdx, tone.ink3)} />
            </Bar>
            <Bar dataKey="수익" name="수익">
              {momData.map((d, i) => (
                <Cell key={i} fill={d.수익 >= 0 ? POS : NEG} />
              ))}
              <LabelList dataKey="수익" content={barTopLabel(gainLabelIdx, tone.ink3)} />
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
