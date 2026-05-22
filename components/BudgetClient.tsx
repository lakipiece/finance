'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { formatWonFull, formatWonCompact, catBadgeStyle } from '@/lib/utils'
import { btn, field, card, badge, text } from '@/lib/styles'
import type { ChartTooltipProps } from '@/lib/chartTypes'

const POSITIVE_BUDGET_COLOR = '#1A237E'

interface BudgetItem {
  id: number | null
  category: string
  detail: string
  annual_plan: number
  sort_order: number
  note: string
}

interface DetailOption {
  name: string
  category: string
  order_idx: number
}

interface BudgetData {
  year: number
  items: BudgetItem[]
  weeklyAmount: number
  initialized: boolean
  detailOptions: DetailOption[]
  usageByDetail: Record<string, Record<string, number>>
  usageByCategory: Record<string, number>
  weeklyUsage: Record<number, number>
}

interface DraftItem {
  key: string
  id: number | null
  category: string
  detail: string
  annual_plan: number
  note: string
}

function fmtAmountInput(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  if (!n) return ''
  return Number(n).toLocaleString('ko-KR')
}

function parseAmountInput(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0
}

function daysInYear(year: number) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  return isLeap ? 366 : 365
}

function elapsedDays(year: number) {
  const now = new Date()
  if (now.getFullYear() < year) return 0
  if (now.getFullYear() > year) return daysInYear(year)
  const start = new Date(year, 0, 1)
  const diffMs = now.getTime() - start.getTime()
  return Math.min(daysInYear(year), Math.max(0, Math.floor(diffMs / 86400000) + 1))
}

function getIsoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * '여행공연비'에서 '여행' 항목이 있으면 '문화생활' 외 카테고리 내 모든 detail을 흡수.
 * '문화생활' 항목은 정확 매칭. 그 외 카테고리는 detail 정확 매칭.
 */
function getItemUsed(category: string, detail: string, usageByDetail: Record<string, number>) {
  if (category === '여행공연비' && detail === '여행') {
    return Object.entries(usageByDetail)
      .filter(([d]) => d !== '문화생활')
      .reduce((s, [, v]) => s + v, 0)
  }
  return usageByDetail[detail] ?? 0
}

function computeExtraDetails(category: string, items: DraftItem[], usageByDetail: Record<string, number>) {
  const knownDetails = new Set(items.map(it => it.detail))
  if (category === '여행공연비' && knownDetails.has('여행')) {
    // '여행' 항목이 문화생활 외 모두 흡수 → 예산 외 없음
    return []
  }
  return Object.entries(usageByDetail).filter(([d, amt]) => !knownDetails.has(d) && amt > 0)
}

interface SectionProps {
  category: string
  items: DraftItem[]
  usageByDetail: Record<string, number>
  totalUsed: number
  remainPeriodPct: number
  editing: boolean
  onAdd: (cat: string) => void
  onChange: (key: string, patch: Partial<DraftItem>) => void
  onRemove: (key: string) => void
}

function BudgetSection({ category, items, usageByDetail, totalUsed, remainPeriodPct, editing, onAdd, onChange, onRemove }: SectionProps) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const left = a.detail.trim() || '\uffff'
      const right = b.detail.trim() || '\uffff'
      return left.localeCompare(right, 'ko-KR', { sensitivity: 'base' })
    })
  }, [items])
  const totalPlan = items.reduce((s, it) => s + it.annual_plan, 0)
  const totalRemain = totalPlan - totalUsed
  const totalRemainPct = totalPlan > 0 ? totalRemain / totalPlan : 0
  const catBadge = catBadgeStyle(category)

  const extraDetails = computeExtraDetails(category, items, usageByDetail)
  const extraTotal = extraDetails.reduce((s, [, v]) => s + v, 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className={badge.base} style={catBadge}>{category}</span>
          <h2 className="text-sm font-semibold text-slate-700">계획</h2>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">잔여기간</span>
            <span className="font-semibold text-slate-600 tabular-nums">{(remainPeriodPct * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">잔여금액</span>
            <span
              className={`font-semibold tabular-nums ${totalRemainPct < remainPeriodPct ? 'text-rose-500' : 'text-[#1A237E]'}`}
            >
              {(totalRemainPct * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className={`${card.base} p-3 sm:p-5`}>
      {/* 모바일: 카드 리스트 */}
      <div className="sm:hidden space-y-2">
        {sortedItems.map((it) => {
          const used = getItemUsed(category, it.detail, usageByDetail)
          const hasPlan = it.annual_plan > 0
          const remain = hasPlan ? it.annual_plan - used : 0
          const pct = hasPlan ? remain / it.annual_plan : 0
          const overBudget = hasPlan && remain < 0
          return (
            <div key={it.key} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  {editing ? (
                    <input
                      type="text"
                      value={it.detail}
                      onChange={e => onChange(it.key, { detail: e.target.value })}
                      placeholder="세부유형"
                      className={`${field.input} min-w-0`}
                    />
                  ) : (
                    <p className="text-sm text-slate-700 font-semibold truncate">{it.detail || '(미분류)'}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {hasPlan ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium tabular-nums ${
                      overBudget ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {(pct * 100).toFixed(1)}%
                    </span>
                  ) : null}
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => onRemove(it.key)}
                      className="text-slate-300 hover:text-rose-400 transition-colors text-lg leading-none"
                      aria-label="삭제"
                    >×</button>
                  ) : null}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-400">연간계획</p>
                  {editing ? (
                    <input
                      type="text"
                      inputMode="numeric"
                      value={it.annual_plan ? fmtAmountInput(String(it.annual_plan)) : ''}
                      onChange={e => onChange(it.key, { annual_plan: parseAmountInput(e.target.value) })}
                      placeholder="0"
                      className={`${field.inputFit} w-full text-right tabular-nums`}
                    />
                  ) : (
                    <p className="text-slate-700 tabular-nums">{hasPlan ? formatWonFull(it.annual_plan) : '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-slate-400">누적</p>
                  <p className="text-slate-700 tabular-nums">{formatWonFull(used)}</p>
                </div>
                <div>
                  <p className="text-slate-400">잔액</p>
                  <p className={`font-semibold tabular-nums ${overBudget ? 'text-rose-500' : 'text-slate-800'}`}>
                    {hasPlan ? formatWonFull(remain) : '-'}
                  </p>
                </div>
              </div>
              {editing || it.note ? (
                <div className="mt-2 border-t border-slate-100 pt-2">
                  {editing ? (
                    <input
                      type="text"
                      value={it.note}
                      onChange={e => onChange(it.key, { note: e.target.value })}
                      placeholder="메모"
                      className={`${field.input} min-w-0 placeholder:text-slate-200`}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-300">{it.note}</p>
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
        {!editing && extraDetails.length > 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
            <p className="text-[11px] text-slate-400 mb-1">(예산 외)</p>
            <p className="text-[10px] text-slate-400 mb-2">{extraDetails.map(([d]) => d || '(미분류)').join(', ')}</p>
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-slate-400">누적</span>
              <span className="text-sm text-slate-600 tabular-nums">{formatWonFull(extraTotal)}</span>
            </div>
          </div>
        ) : null}
        {/* 합계 */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 mt-2">
          <p className="text-sm font-bold text-slate-700 mb-2">합계</p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <p className="text-slate-400">연간계획</p>
              <p className="text-slate-700 tabular-nums font-semibold">{formatWonFull(totalPlan)}</p>
            </div>
            <div>
              <p className="text-slate-400">누적</p>
              <p className="text-slate-700 tabular-nums font-semibold">{formatWonFull(totalUsed)}</p>
            </div>
            <div>
              <p className="text-slate-400">잔액</p>
              <p className={`font-bold tabular-nums ${totalRemain < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                {formatWonFull(totalRemain)}
              </p>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-[11px] text-slate-400">잔여 / 기간</span>
            {totalPlan > 0 ? (
              <span className="text-sm font-semibold tabular-nums">
                <span className={totalRemainPct < remainPeriodPct ? 'text-rose-500' : 'text-[#1A237E]'}>
                  {(totalRemainPct * 100).toFixed(1)}%
                </span>
                <span className="text-slate-300 mx-1">/</span>
                <span className="text-slate-400 font-normal">{(remainPeriodPct * 100).toFixed(1)}%</span>
              </span>
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
          </div>
        </div>
      </div>

      {/* 데스크탑: 테이블 */}
      <div className="hidden sm:block overflow-x-auto max-[1200px]:overflow-visible">
        <table className="w-full table-fixed text-xs">
          <colgroup>
            <col className="w-[22%] max-[1200px]:w-[30%]" />
            <col className="w-[24%] max-[1200px]:hidden" />
            <col className="w-[15%] max-[1200px]:w-[18%]" />
            <col className="w-[15%] max-[1200px]:w-[18%]" />
            <col className="w-[14%] max-[1200px]:w-[18%]" />
            <col className="w-[10%] max-[1200px]:w-[16%]" />
            {editing ? <col className="w-8" /> : null}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-2 text-slate-400 font-medium">구분</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium max-[1200px]:hidden">메모</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium">연간계획</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium">누적 사용금액</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium">잔액</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium">잔여%</th>
              {editing ? <th className="w-8" /> : null}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((it) => {
              const used = getItemUsed(category, it.detail, usageByDetail)
              const hasPlan = it.annual_plan > 0
              const remain = hasPlan ? it.annual_plan - used : 0
              const pct = hasPlan ? remain / it.annual_plan : 0
              const overBudget = hasPlan && remain < 0
              return (
                <tr key={it.key} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="group relative py-2 px-2 min-w-0">
                    {editing ? (
                      <input
                        type="text"
                        value={it.detail}
                        onChange={e => onChange(it.key, { detail: e.target.value })}
                        placeholder="세부유형"
                        className={`${field.input} min-w-0`}
                      />
                    ) : (
                      <span className="block truncate text-slate-700 font-medium">{it.detail || '(미분류)'}</span>
                    )}
                    {it.note ? (
                      <div className="pointer-events-none absolute left-2 top-full z-20 mt-1 hidden max-w-[260px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] leading-relaxed text-slate-500 shadow-lg group-hover:max-[1200px]:block">
                        {it.note}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 px-2 min-w-0 max-[1200px]:hidden">
                    {editing ? (
                      <input
                        type="text"
                        value={it.note}
                        onChange={e => onChange(it.key, { note: e.target.value })}
                        placeholder="메모"
                        className={`${field.input} min-w-0`}
                      />
                    ) : (
                      <span className="block truncate text-slate-400 text-[11px]">{it.note}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {editing ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={it.annual_plan ? fmtAmountInput(String(it.annual_plan)) : ''}
                        onChange={e => onChange(it.key, { annual_plan: parseAmountInput(e.target.value) })}
                        placeholder="0"
                        className={`${field.inputFit} min-w-0 w-full text-right tabular-nums`}
                      />
                    ) : (
                      <span className="text-slate-600">{hasPlan ? formatWonFull(it.annual_plan) : '-'}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-600">{formatWonFull(used)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums font-semibold ${overBudget ? 'text-rose-500' : 'text-slate-700'}`}>
                    {hasPlan ? formatWonFull(remain) : '-'}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums">
                    {hasPlan ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        overBudget ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {(pct * 100).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  {editing ? (
                    <td className="py-2 px-1 text-right">
                      <button
                        type="button"
                        onClick={() => onRemove(it.key)}
                        className="text-slate-300 hover:text-rose-400 transition-colors text-base leading-none"
                        aria-label="삭제"
                      >×</button>
                    </td>
                  ) : null}
                </tr>
              )
            })}
            {!editing && extraDetails.length > 0 ? (
              <tr className="border-b border-slate-50 bg-slate-50/40">
                <td className="py-2 px-2 text-slate-400 text-[11px]">(예산 외)</td>
                <td className="py-2 px-2 text-slate-400 text-[10px] max-[1200px]:hidden">
                  {extraDetails.map(([d]) => d || '(미분류)').join(', ')}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-slate-400">-</td>
                <td className="py-2 px-2 text-right tabular-nums text-slate-500">{formatWonFull(extraTotal)}</td>
                <td className="py-2 px-2 text-right tabular-nums text-slate-400">-</td>
                <td className="py-2 px-2 text-right tabular-nums text-slate-400">-</td>
              </tr>
            ) : null}
            <tr className="border-t-2 border-slate-200 font-semibold">
              <td className="py-2 px-2 text-slate-700">합계</td>
              <td className="py-2 px-2 max-[1200px]:hidden" />
              <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatWonFull(totalPlan)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatWonFull(totalUsed)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${totalRemain < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                {formatWonFull(totalRemain)}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">
                {totalPlan > 0 ? (
                  <span className="inline-flex items-baseline gap-1">
                    <span className={totalRemainPct < remainPeriodPct ? 'text-rose-500' : 'text-[#1A237E]'}>
                      {(totalRemainPct * 100).toFixed(1)}%
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-400 font-normal">{(remainPeriodPct * 100).toFixed(1)}%</span>
                  </span>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              {editing ? <td /> : null}
            </tr>
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onAdd(category)}
            className="text-xs text-slate-500 hover:text-[#1A237E] transition-colors"
          >
            + 항목 추가
          </button>
        </div>
      ) : null}
      </div>
    </section>
  )
}

interface WeeklyTooltipDatum {
  week: number
  weekly: number
  cumulative: number
  baselineCumulative: number
}

function WeeklyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const datum = payload[0].payload as unknown as WeeklyTooltipDatum
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}주차</p>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-slate-500">주간 지출</span>
        <span className="font-medium text-slate-700 tabular-nums">{formatWonFull(datum.weekly)}</span>
      </div>
      <div className="flex justify-between gap-4 mb-1">
        <span className="text-slate-500">누적 지출</span>
        <span className="font-medium text-slate-700 tabular-nums">{formatWonFull(datum.cumulative)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-slate-500">누적 기준</span>
        <span className="font-medium text-slate-700 tabular-nums">{formatWonFull(datum.baselineCumulative)}</span>
      </div>
    </div>
  )
}

interface WeeklyChartProps {
  weeklyAmount: number
  weeklyUsage: Record<number, number>
  year: number
}

interface RechartsDotProps {
  cx?: number
  cy?: number
  index?: number
  payload?: { week: number }
}

function WeeklyChart({ weeklyAmount, weeklyUsage, year }: WeeklyChartProps) {
  const currentWeek = useMemo(() => {
    const now = new Date()
    if (now.getFullYear() !== year) return -1
    return Math.min(52, getIsoWeek(now))
  }, [year])

  const renderCumulativeDot = (props: RechartsDotProps) => {
    const { cx, cy, index, payload } = props
    if (cx == null || cy == null) return <g key={index} />
    const isCurrent = payload?.week === currentWeek
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={isCurrent ? 5 : 2}
        fill={isCurrent ? '#fff' : POSITIVE_BUDGET_COLOR}
        stroke={POSITIVE_BUDGET_COLOR}
        strokeWidth={isCurrent ? 2.5 : 0}
      />
    )
  }
  const data = useMemo(() => {
    const rows: WeeklyTooltipDatum[] = []
    let cumulative = 0
    for (let w = 1; w <= 52; w++) {
      const weekly = weeklyUsage[w] ?? 0
      cumulative += weekly
      rows.push({
        week: w,
        weekly,
        cumulative,
        baselineCumulative: weeklyAmount * w,
      })
    }
    return rows
  }, [weeklyAmount, weeklyUsage])

  const referenceWeek = currentWeek > 0 ? currentWeek : 52
  const referenceRow = data[referenceWeek - 1]
  const referenceUsed = referenceRow?.cumulative ?? 0
  const referenceBaseline = referenceRow?.baselineCumulative ?? weeklyAmount * 52
  const diff = referenceBaseline - referenceUsed

  return (
    <div className={`${card.base} p-3 sm:p-5`}>
      <div className="flex items-center justify-end mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">누적 차액</span>
            <span className={`font-semibold tabular-nums ${diff < 0 ? 'text-rose-500' : 'text-[#1A237E]'}`}>
              {diff.toLocaleString('ko-KR')}원
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 text-[11px]">{diff >= 0 ? 'Good' : 'Over'}</span>
          </div>
        </div>
      </div>
      <div className="h-[220px] sm:h-[260px] lg:h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => formatWonCompact(v)}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => formatWonCompact(v)}
            tick={{ fontSize: 10, fill: '#cbd5e1' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<WeeklyTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          <Bar yAxisId="right" dataKey="weekly" name="주간 지출" fill="#e2e8f0" radius={[2, 2, 0, 0]} />
          <Line yAxisId="left" type="monotone" dataKey="baselineCumulative" name="누적 기준" stroke="#c7d2fe" strokeWidth={2} dot={false} />
          <Line yAxisId="left" type="monotone" dataKey="cumulative" name="누적 지출" stroke={POSITIVE_BUDGET_COLOR} strokeWidth={2.5} dot={renderCumulativeDot} activeDot={renderCumulativeDot} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

interface Props {
  initialYear: number
}

export default function BudgetClient({ initialYear }: Props) {
  const [year, setYear] = useState(initialYear)
  const [data, setData] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [weeklyAmount, setWeeklyAmount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [years, setYears] = useState<number[]>([])

  useEffect(() => {
    fetch('/api/years')
      .then(r => r.ok ? r.json() : [])
      .then((data: { year: number }[]) => {
        const ys = Array.isArray(data) ? data.map(d => d.year) : []
        const now = new Date().getFullYear()
        const set = new Set<number>([...ys, now, now + 1])
        setYears(Array.from(set).sort((a, b) => b - a))
      })
      .catch(() => setYears([new Date().getFullYear()]))
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/budgets?year=${year}`)
      const json: BudgetData = await res.json()
      setData(json)
      if (json.initialized) {
        setDrafts(json.items.map((it, i) => ({
          key: `item-${it.id ?? i}`,
          id: it.id,
          category: it.category,
          detail: it.detail,
          annual_plan: it.annual_plan,
          note: it.note,
        })))
      } else {
        setDrafts((json.detailOptions ?? []).map((o, i) => ({
          key: `seed-${i}`,
          id: null,
          category: o.category,
          detail: o.name,
          annual_plan: 0,
          note: '',
        })))
      }
      setWeeklyAmount(json.weeklyAmount ?? 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  function startEdit() {
    setEditing(true)
  }

  function cancelEdit() {
    if (!data) return
    if (data.initialized) {
      setDrafts(data.items.map((it, i) => ({
        key: `item-${it.id ?? i}`,
        id: it.id,
        category: it.category,
        detail: it.detail,
        annual_plan: it.annual_plan,
        note: it.note,
      })))
    } else {
      setDrafts((data.detailOptions ?? []).map((o, i) => ({
        key: `seed-${i}`,
        id: null,
        category: o.category,
        detail: o.name,
        annual_plan: 0,
        note: '',
      })))
    }
    setWeeklyAmount(data.weeklyAmount ?? 0)
    setEditing(false)
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        year,
        items: drafts.map((d, i) => ({
          category: d.category,
          detail: d.detail,
          annual_plan: d.annual_plan,
          sort_order: i,
          note: d.note,
        })),
        weeklyAmount,
      }
      const res = await fetch('/api/budgets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error ?? '저장 실패')
        return
      }
      setEditing(false)
      await fetchData()
    } catch (e) {
      console.error(e)
      alert('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  function addItem(category: string) {
    const key = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDrafts(prev => [...prev, {
      key,
      id: null,
      category,
      detail: '',
      annual_plan: 0,
      note: '',
    }])
  }

  function patchItem(key: string, patch: Partial<DraftItem>) {
    setDrafts(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d))
  }

  function removeItem(key: string) {
    setDrafts(prev => prev.filter(d => d.key !== key))
  }

  const usageByCategory = data?.usageByCategory ?? {}
  const usageByDetail = data?.usageByDetail ?? {}

  const remainPeriodPct = useMemo(() => {
    const total = daysInYear(year)
    const elapsed = elapsedDays(year)
    return Math.max(0, Math.min(1, (total - elapsed) / total))
  }, [year])

  const totalAnnualPlan = drafts.reduce((s, d) => s + d.annual_plan, 0)
  const totalUsedAll = Object.values(usageByCategory).reduce((s, v) => s + v, 0)
  const totalRemainAll = totalAnnualPlan - totalUsedAll
  const totalRemainPctAll = totalAnnualPlan > 0 ? totalRemainAll / totalAnnualPlan : 0

  const variableWeeklySuggestion = useMemo(() => {
    const plan = drafts.filter(d => d.category === '변동비').reduce((s, d) => s + d.annual_plan, 0)
    return Math.round(plan / 52)
  }, [drafts])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>예산관리</h1>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => { setYear(parseInt(e.target.value)); setEditing(false) }}
            className="bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            disabled={editing}
          >
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          {editing ? (
            <>
              <button type="button" onClick={cancelEdit} className={btn.secondary} disabled={saving}>취소</button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: '#1A237E' }}
              >
                {saving ? '저장중...' : '저장'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ backgroundColor: '#1A237E' }}
            >
              수정
            </button>
          )}
        </div>
      </div>

      {loading || !data ? (
        <div className={`${card.base} p-10 text-center text-slate-400 text-sm`}>불러오는 중...</div>
      ) : (
        <>
          {/* 전체 요약 — KPI 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`${card.base} p-4`}>
              <p className={text.caption}>연간 계획 총액</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{formatWonFull(totalAnnualPlan)}</p>
            </div>
            <div className={`${card.base} p-4`}>
              <p className={text.caption}>누적 사용</p>
              <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{formatWonFull(totalUsedAll)}</p>
            </div>
            <div className={`${card.base} p-4`}>
              <p className={text.caption}>잔액</p>
              <p className={`text-lg font-bold tabular-nums mt-1 ${totalRemainAll < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                {formatWonFull(totalRemainAll)}
              </p>
            </div>
            <div className={`${card.base} p-4`}>
              <p className={text.caption}>잔여 / 기간</p>
              <p className="text-lg font-bold tabular-nums mt-1">
                <span className={totalRemainPctAll < remainPeriodPct ? 'text-rose-500' : 'text-[#1A237E]'}>
                  {(totalRemainPctAll * 100).toFixed(1)}%
                </span>
                <span className="text-slate-300 mx-1.5">/</span>
                <span className="text-slate-600">{(remainPeriodPct * 100).toFixed(1)}%</span>
              </p>
            </div>
          </div>

          {/* 섹션들 */}
          <BudgetSection
            category="여행공연비"
            items={drafts.filter(d => d.category === '여행공연비')}
            usageByDetail={usageByDetail['여행공연비'] ?? {}}
            totalUsed={usageByCategory['여행공연비'] ?? 0}
            remainPeriodPct={remainPeriodPct}
            editing={editing}
            onAdd={addItem}
            onChange={patchItem}
            onRemove={removeItem}
          />

          <BudgetSection
            category="고정비"
            items={drafts.filter(d => d.category === '고정비')}
            usageByDetail={usageByDetail['고정비'] ?? {}}
            totalUsed={usageByCategory['고정비'] ?? 0}
            remainPeriodPct={remainPeriodPct}
            editing={editing}
            onAdd={addItem}
            onChange={patchItem}
            onRemove={removeItem}
          />

          {(drafts.some(d => d.category === '대출상환') || (usageByCategory['대출상환'] ?? 0) > 0) ? (
            <BudgetSection
              category="대출상환"
              items={drafts.filter(d => d.category === '대출상환')}
              usageByDetail={usageByDetail['대출상환'] ?? {}}
              totalUsed={usageByCategory['대출상환'] ?? 0}
              remainPeriodPct={remainPeriodPct}
              editing={editing}
              onAdd={addItem}
              onChange={patchItem}
              onRemove={removeItem}
            />
          ) : null}

          <BudgetSection
            category="변동비"
            items={drafts.filter(d => d.category === '변동비')}
            usageByDetail={usageByDetail['변동비'] ?? {}}
            totalUsed={usageByCategory['변동비'] ?? 0}
            remainPeriodPct={remainPeriodPct}
            editing={editing}
            onAdd={addItem}
            onChange={patchItem}
            onRemove={removeItem}
          />

          {/* 변동비 주단위 기준 — KPI 카드 */}
          <section>
            <div className="flex items-center mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className={badge.base} style={catBadgeStyle('변동비')}>변동비</span>
                <h2 className="text-sm font-semibold text-slate-700">주단위 기준</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className={`${card.base} p-3 sm:p-4 min-w-0`}>
                <p className={text.caption}>연간 변동비 ÷ 52 (참고)</p>
                <p className="text-[13px] sm:text-lg font-bold text-slate-800 tabular-nums mt-1 truncate">{formatWonFull(variableWeeklySuggestion)}</p>
              </div>
              <div className={`${card.base} p-3 sm:p-4 min-w-0`}>
                <p className={text.caption}>주당 기준금액</p>
                {editing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={weeklyAmount ? fmtAmountInput(String(weeklyAmount)) : ''}
                    onChange={e => setWeeklyAmount(parseAmountInput(e.target.value))}
                    placeholder="0"
                    className={`${field.inputFit} min-w-0 w-full text-[13px] sm:text-lg font-bold tabular-nums mt-1`}
                  />
                ) : (
                  <p className="text-[13px] sm:text-lg font-bold text-slate-800 tabular-nums mt-1 truncate">{formatWonFull(weeklyAmount)}</p>
                )}
              </div>
            </div>
          </section>

          <WeeklyChart weeklyAmount={weeklyAmount} weeklyUsage={data.weeklyUsage} year={year} />
        </>
      )}
    </div>
  )
}
