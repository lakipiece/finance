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
import type { ChartTooltipProps, TooltipEntry } from '@/lib/chartTypes'

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

interface SectionProps {
  label: string
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

function BudgetSection({ label, category, items, usageByDetail, totalUsed, remainPeriodPct, editing, onAdd, onChange, onRemove }: SectionProps) {
  const totalPlan = items.reduce((s, it) => s + it.annual_plan, 0)
  const totalRemain = totalPlan - totalUsed
  const totalRemainPct = totalPlan > 0 ? totalRemain / totalPlan : 0
  const catBadge = catBadgeStyle(category)

  const knownDetails = new Set(items.map(it => it.detail))
  const extraDetails = Object.entries(usageByDetail).filter(([d, amt]) => !knownDetails.has(d) && amt > 0)
  const extraTotal = extraDetails.reduce((s, [, v]) => s + v, 0)

  return (
    <section>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className={badge.base} style={catBadge}>{category}</span>
          <h2 className="text-sm font-semibold text-slate-700">{label}</h2>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">잔여기간</span>
            <span className="font-semibold text-slate-600 tabular-nums">{(remainPeriodPct * 100).toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">잔여금액</span>
            <span
              className={`font-semibold tabular-nums ${totalRemainPct < remainPeriodPct ? 'text-rose-500' : 'text-emerald-600'}`}
            >
              {(totalRemainPct * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      <div className={`${card.base} p-3 sm:p-5`}>
      {/* 모바일: 카드 리스트 */}
      <div className="sm:hidden space-y-2">
        {items.map((it) => {
          const used = usageByDetail[it.detail] ?? 0
          const remain = it.annual_plan - used
          const pct = it.annual_plan > 0 ? remain / it.annual_plan : 0
          const overBudget = it.annual_plan > 0 && remain < 0
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
                      className={field.input}
                    />
                  ) : (
                    <p className="text-sm text-slate-700 font-semibold truncate">{it.detail || '(미분류)'}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-semibold tabular-nums ${overBudget ? 'text-rose-500' : 'text-slate-500'}`}>
                    {it.annual_plan > 0 ? `${(pct * 100).toFixed(1)}%` : '-'}
                  </span>
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
              {editing || it.note ? (
                <div className="mb-2">
                  {editing ? (
                    <input
                      type="text"
                      value={it.note}
                      onChange={e => onChange(it.key, { note: e.target.value })}
                      placeholder="메모"
                      className={field.input}
                    />
                  ) : (
                    <p className="text-[11px] text-slate-400">{it.note}</p>
                  )}
                </div>
              ) : null}
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
                    <p className="text-slate-700 tabular-nums">{formatWonFull(it.annual_plan)}</p>
                  )}
                </div>
                <div>
                  <p className="text-slate-400">누적</p>
                  <p className="text-slate-700 tabular-nums">{formatWonFull(used)}</p>
                </div>
                <div>
                  <p className="text-slate-400">잔액</p>
                  <p className={`font-semibold tabular-nums ${overBudget ? 'text-rose-500' : 'text-slate-800'}`}>
                    {formatWonFull(remain)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {!editing && extraDetails.length > 0 ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
            <p className="text-sm text-slate-400 italic mb-1">(예산 외)</p>
            <p className="text-[11px] text-slate-400 mb-2">{extraDetails.map(([d]) => d || '(미분류)').join(', ')}</p>
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
            <span className="text-[11px] text-slate-400">잔여%</span>
            <span className={`text-sm font-semibold tabular-nums ${totalRemain < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
              {totalPlan > 0 ? `${(totalRemainPct * 100).toFixed(1)}%` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 데스크탑: 테이블 */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-2 text-slate-400 font-medium w-1/4">구분</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">메모</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium w-28">연간계획</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium w-28">누적 사용금액</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium w-28">잔액</th>
              <th className="text-right py-2 px-2 text-slate-400 font-medium w-16">잔여%</th>
              {editing ? <th className="w-8" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const used = usageByDetail[it.detail] ?? 0
              const remain = it.annual_plan - used
              const pct = it.annual_plan > 0 ? remain / it.annual_plan : 0
              const overBudget = it.annual_plan > 0 && remain < 0
              return (
                <tr key={it.key} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-2 px-2">
                    {editing ? (
                      <input
                        type="text"
                        value={it.detail}
                        onChange={e => onChange(it.key, { detail: e.target.value })}
                        placeholder="세부유형"
                        className={field.input}
                      />
                    ) : (
                      <span className="text-slate-700 font-medium">{it.detail || '(미분류)'}</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {editing ? (
                      <input
                        type="text"
                        value={it.note}
                        onChange={e => onChange(it.key, { note: e.target.value })}
                        placeholder="메모"
                        className={field.input}
                      />
                    ) : (
                      <span className="text-slate-400 text-[11px]">{it.note}</span>
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
                        className={`${field.inputFit} text-right w-full`}
                      />
                    ) : (
                      <span className="text-slate-600">{formatWonFull(it.annual_plan)}</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-slate-600">{formatWonFull(used)}</td>
                  <td className={`py-2 px-2 text-right tabular-nums font-semibold ${overBudget ? 'text-rose-500' : 'text-slate-700'}`}>
                    {formatWonFull(remain)}
                  </td>
                  <td className={`py-2 px-2 text-right tabular-nums ${overBudget ? 'text-rose-500' : 'text-slate-500'}`}>
                    {it.annual_plan > 0 ? `${(pct * 100).toFixed(1)}%` : '-'}
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
                <td className="py-2 px-2 text-slate-400 italic">(예산 외)</td>
                <td className="py-2 px-2 text-slate-400 text-[11px]">
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
              <td className="py-2 px-2" />
              <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatWonFull(totalPlan)}</td>
              <td className="py-2 px-2 text-right tabular-nums text-slate-700">{formatWonFull(totalUsed)}</td>
              <td className={`py-2 px-2 text-right tabular-nums ${totalRemain < 0 ? 'text-rose-500' : 'text-slate-800'}`}>
                {formatWonFull(totalRemain)}
              </td>
              <td className={`py-2 px-2 text-right tabular-nums ${totalRemain < 0 ? 'text-rose-500' : 'text-slate-700'}`}>
                {totalPlan > 0 ? `${(totalRemainPct * 100).toFixed(1)}%` : '-'}
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
}

function WeeklyChart({ weeklyAmount, weeklyUsage }: WeeklyChartProps) {
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

  const totalUsed = data[data.length - 1]?.cumulative ?? 0
  const totalBaseline = weeklyAmount * 52
  const diff = totalBaseline - totalUsed

  return (
    <div className={`${card.base} p-5`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-700">변동비 — 주차별 사용 현황</h2>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">누적 차액</span>
            <span className={`font-semibold tabular-nums ${diff < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
              {diff.toLocaleString('ko-KR')}원
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 text-[11px]">{diff >= 0 ? 'Good' : 'Over'}</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
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
          <Line yAxisId="left" type="monotone" dataKey="cumulative" name="누적 지출" stroke="#1A237E" strokeWidth={2.5} dot={{ r: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
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
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>예산관리</h1>
          <select
            value={year}
            onChange={(e) => { setYear(parseInt(e.target.value)); setEditing(false) }}
            className="bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer"
            disabled={editing}
          >
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button type="button" onClick={cancelEdit} className={btn.secondary} disabled={saving}>취소</button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className={btn.primary}
                style={{ backgroundColor: '#1A237E' }}
              >
                {saving ? '저장중...' : '저장'}
              </button>
            </>
          ) : (
            <button type="button" onClick={startEdit} className={btn.secondary}>수정</button>
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
                <span className={totalRemainPctAll < remainPeriodPct ? 'text-rose-500' : 'text-emerald-600'}>
                  {(totalRemainPctAll * 100).toFixed(1)}%
                </span>
                <span className="text-slate-300 mx-1.5">/</span>
                <span className="text-slate-600">{(remainPeriodPct * 100).toFixed(1)}%</span>
              </p>
            </div>
          </div>

          {/* 섹션들 */}
          <BudgetSection
            label="여행/공연비 계획"
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
            label="고정비 계획"
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
              label="대출상환 계획"
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
            label="변동비 계획"
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
              <h2 className="text-sm font-semibold text-slate-700">변동비 주단위 기준</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`${card.base} p-4`}>
                <p className={text.caption}>연간 변동비 ÷ 52 (참고)</p>
                <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{formatWonFull(variableWeeklySuggestion)}</p>
              </div>
              <div className={`${card.base} p-4`}>
                <p className={text.caption}>주당 기준금액</p>
                {editing ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={weeklyAmount ? fmtAmountInput(String(weeklyAmount)) : ''}
                    onChange={e => setWeeklyAmount(parseAmountInput(e.target.value))}
                    placeholder="0"
                    className={`${field.inputFit} w-full text-lg font-bold tabular-nums mt-1`}
                  />
                ) : (
                  <p className="text-lg font-bold text-slate-800 tabular-nums mt-1">{formatWonFull(weeklyAmount)}</p>
                )}
              </div>
            </div>
          </section>

          <WeeklyChart weeklyAmount={weeklyAmount} weeklyUsage={data.weeklyUsage} />
        </>
      )}
    </div>
  )
}
