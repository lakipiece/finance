'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer, BarChart, LineChart,
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { btn, card, field, modal, text } from '@/lib/styles'
import { formatWonFull } from '@/lib/utils'
import { OPTION_COLORS } from '@/lib/palettes'
import YearMonthPicker from '@/components/ui/YearMonthPicker'
import type { ChartTooltipProps } from '@/lib/chartTypes'

type EnergyKind = 'electricity' | 'water' | 'hot_water' | 'heating'

interface KindMeta {
  key: EnergyKind
  label: string
  unit: string
  color: string
}

const KINDS: KindMeta[] = [
  { key: 'electricity', label: '전기', unit: 'kWh',  color: OPTION_COLORS[0] },
  { key: 'water',       label: '수도', unit: 'm³',   color: OPTION_COLORS[1] },
  { key: 'hot_water',   label: '온수', unit: 'm³',   color: OPTION_COLORS[2] },
  { key: 'heating',     label: '난방', unit: 'Gcal', color: OPTION_COLORS[3] },
]

interface EnergyRecord {
  id: number
  year: number
  month: number
  memo: string
  electricity_amount: number
  electricity_usage: number
  water_amount: number
  water_usage: number
  hot_water_amount: number
  hot_water_usage: number
  heating_amount: number
  heating_usage: number
}

function fieldKey(kind: EnergyKind, suffix: 'amount' | 'usage'): keyof EnergyRecord {
  return `${kind}_${suffix}` as keyof EnergyRecord
}

function fmtAmount(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  if (!n) return ''
  return Number(n).toLocaleString('ko-KR')
}

function parseAmount(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0
}

function fmtReading(v: string) {
  // 숫자 + 소수점 1개 허용 — 정수부에는 3자리 콤마 표시
  const cleaned = v.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  const intPart = firstDot < 0 ? cleaned : cleaned.slice(0, firstDot)
  const decPart = firstDot < 0 ? '' : '.' + cleaned.slice(firstDot + 1).replace(/\./g, '')
  if (!intPart) return decPart
  const intFmt = Number(intPart).toLocaleString('ko-KR')
  return intFmt + decPart
}

function parseReading(v: string) {
  const n = parseFloat(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

/* ── 차트 툴팁 ── */
function UsageTooltip({ active, payload, label, activeKinds }: ChartTooltipProps & { activeKinds: KindMeta[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Record<string, number | null>
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {activeKinds.map(k => {
        const v = Number(row[`${k.key}_usage`] ?? 0)
        return (
          <div key={k.key} className="flex items-center justify-between gap-3 mb-0.5 last:mb-0">
            <span className="flex items-center gap-1.5" style={{ color: k.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
              {k.label}
            </span>
            <span className="font-medium text-slate-700 tabular-nums">
              {v.toLocaleString('ko-KR')} {k.unit}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function AmountTooltip({ active, payload, label, activeKinds }: ChartTooltipProps & { activeKinds: KindMeta[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as Record<string, number>
  const total = activeKinds.reduce((s, k) => s + Number(row[`${k.key}_amount`] ?? 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[160px]">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {activeKinds.map(k => {
        const v = Number(row[`${k.key}_amount`] ?? 0)
        return (
          <div key={k.key} className="flex items-center justify-between gap-3 mb-0.5">
            <span className="flex items-center gap-1.5" style={{ color: k.color }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: k.color }} />
              {k.label}
            </span>
            <span className="font-medium text-slate-700 tabular-nums">
              {formatWonFull(v)}
            </span>
          </div>
        )
      })}
      <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-slate-100">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold text-slate-800 tabular-nums">{formatWonFull(total)}</span>
      </div>
    </div>
  )
}

/* ── 입력/수정 모달 ── */
function EnergyFormModal({ initial, defaultYear, defaultMonth, onClose, onSaved, onDelete }: {
  initial: EnergyRecord | null
  defaultYear: number
  defaultMonth: number
  onClose: () => void
  onSaved: () => void
  onDelete?: () => void
}) {
  const [year, setYear] = useState(initial?.year ?? defaultYear)
  const [month, setMonth] = useState(initial?.month ?? defaultMonth)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // kind별 2개 필드 (문자열로 보관 — 입력 중 포맷 유지)
  const initFields = useMemo(() => {
    const out: Record<string, string> = {}
    for (const k of KINDS) {
      const amt = initial ? Number(initial[fieldKey(k.key, 'amount')] as number) : 0
      const usage = initial ? Number(initial[fieldKey(k.key, 'usage')] as number) : 0
      out[`${k.key}_amount`] = amt ? amt.toLocaleString('ko-KR') : ''
      out[`${k.key}_usage`] = usage ? fmtReading(String(usage)) : ''
    }
    return out
  }, [initial])

  const [vals, setVals] = useState<Record<string, string>>(initFields)

  function update(k: string, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
  }

  async function handleSave() {
    if (!year || month < 1 || month > 12) { setErr('년월을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const payload: Record<string, unknown> = { year, month, memo }
      for (const k of KINDS) {
        payload[`${k.key}_amount`] = parseAmount(vals[`${k.key}_amount`] ?? '')
        payload[`${k.key}_usage`] = parseReading(vals[`${k.key}_usage`] ?? '')
      }
      const url = initial ? `/api/energy/${initial.id}` : '/api/energy'
      const method = initial ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className={modal.overlay} onClick={onClose}>
      <div className={modal.containerLg} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <h3 className="text-sm font-semibold text-slate-800">
            {initial ? '에너지 지출 수정' : '에너지 지출 입력'}
          </h3>
          <div className="flex items-center gap-1">
            {initial && onDelete ? (
              <button onClick={onDelete} title="삭제" className={btn.danger}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : null}
            <button onClick={onClose} className={modal.close}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className={modal.body}>
          <div className="flex flex-col gap-1">
            <label className={field.label}>년월</label>
            <YearMonthPicker
              mode="single"
              year={year}
              month={month}
              onChange={(y, m) => { setYear(y); setMonth(m) }}
            />
          </div>

          {KINDS.map(k => (
            <div key={k.key} className="rounded-xl border border-slate-100 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                <span className="text-xs font-semibold text-slate-700">{k.label}</span>
                <span className="text-[10px] text-slate-400">({k.unit})</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={field.label}>금액 (원)</label>
                  <input type="text" inputMode="numeric"
                    value={vals[`${k.key}_amount`] ?? ''}
                    onChange={e => update(`${k.key}_amount`, fmtAmount(e.target.value))}
                    placeholder="0"
                    className={`${field.input} text-right font-bold text-slate-800`} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={field.label}>사용량 ({k.unit})</label>
                  <input type="text" inputMode="decimal"
                    value={vals[`${k.key}_usage`] ?? ''}
                    onChange={e => update(`${k.key}_usage`, fmtReading(e.target.value))}
                    placeholder="0"
                    className={`${field.input} text-right font-bold text-slate-800`} />
                </div>
              </div>
            </div>
          ))}

          <div>
            <label className={field.label}>비고</label>
            <textarea value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모"
              className={field.textarea}
              rows={2} />
          </div>

          {err ? <p className="text-xs text-rose-500">{err}</p> : null}
        </div>
        <div className={modal.footer}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            {saving ? '저장 중…' : initial ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── 메인 클라이언트 ── */
export default function EnergyClient() {
  const currentYear = new Date().getFullYear()
  const [records, setRecords] = useState<EnergyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [yearTo, setYearTo] = useState(currentYear)
  const [yearsBack, setYearsBack] = useState<2 | 3 | 5>(3)
  const [activeKinds, setActiveKinds] = useState<Record<EnergyKind, boolean>>({
    electricity: true, water: true, hot_water: true, heating: true,
  })
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EnergyRecord | null>(null)

  const yearFrom = yearTo - yearsBack + 1

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ yearFrom: String(yearFrom), yearTo: String(yearTo) })
      const res = await fetch(`/api/energy?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (Array.isArray(data)) setRecords(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [yearFrom, yearTo])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  // 차트 데이터: yearFrom ~ yearTo의 모든 월을 0으로 채워 누락 월도 X축에 노출
  // usage_norm: 항목별 비-제로 데이터의 min/max로 0..1 정규화 (추세 비교용)
  const chartData = useMemo(() => {
    const map = new Map<string, EnergyRecord>()
    for (const r of records) map.set(ymKey(r.year, r.month), r)
    const out: Array<Record<string, string | number | null>> = []
    for (let y = yearFrom; y <= yearTo; y++) {
      for (let m = 1; m <= 12; m++) {
        const key = ymKey(y, m)
        const r = map.get(key)
        const row: Record<string, string | number | null> = {
          ym: `${y}.${String(m).padStart(2, '0')}`,
          year: y,
          month: m,
        }
        for (const k of KINDS) {
          row[`${k.key}_amount`] = r ? Number(r[fieldKey(k.key, 'amount')] as number) : 0
          row[`${k.key}_usage`] = r ? Number(r[fieldKey(k.key, 'usage')] as number) : 0
        }
        out.push(row)
      }
    }
    // 항목별 정규화 (값이 있는 달만 대상)
    for (const k of KINDS) {
      const vals = out.map(r => Number(r[`${k.key}_usage`])).filter(v => v > 0)
      if (vals.length === 0) {
        for (const r of out) r[`${k.key}_usage_norm`] = null
        continue
      }
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const span = max - min || 1
      for (const r of out) {
        const v = Number(r[`${k.key}_usage`])
        r[`${k.key}_usage_norm`] = v > 0 ? (v - min) / span : null
      }
    }
    return out
  }, [records, yearFrom, yearTo])

  const activeKindList = KINDS.filter(k => activeKinds[k.key])
  const allKindsOn = KINDS.every(k => activeKinds[k.key])

  function toggleKind(k: EnergyKind) {
    setActiveKinds(prev => ({ ...prev, [k]: !prev[k] }))
  }

  function toggleAllKinds() {
    if (allKindsOn) {
      setActiveKinds({ electricity: false, water: false, hot_water: false, heating: false })
    } else {
      setActiveKinds({ electricity: true, water: true, hot_water: true, heating: true })
    }
  }

  function handleAddClick() {
    setEditing(null)
    setShowModal(true)
  }

  function handleRowClick(rec: EnergyRecord) {
    setEditing(rec)
    setShowModal(true)
  }

  async function handleDelete() {
    if (!editing) return
    if (!confirm(`${editing.year}년 ${editing.month}월 기록을 삭제할까요?`)) return
    try {
      const res = await fetch(`/api/energy/${editing.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '삭제 실패')
      setShowModal(false)
      setEditing(null)
      fetchRecords()
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류')
    }
  }

  function handleSaved() {
    setShowModal(false)
    setEditing(null)
    fetchRecords()
  }

  // 다음 입력 모달 기본값: 가장 최근 기록의 다음 달
  const nextDefault = useMemo(() => {
    if (records.length === 0) {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() + 1 }
    }
    const latest = records[0]
    const nm = latest.month === 12 ? 1 : latest.month + 1
    const ny = latest.month === 12 ? latest.year + 1 : latest.year
    return { year: ny, month: nm }
  }, [records])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h1 className={text.pageTitle}>에너지 지출관리</h1>
            <p className="text-xs text-slate-400 mt-1">월별 전기·수도·온수·난방 사용량과 금액을 기록합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={yearTo} onChange={e => setYearTo(parseInt(e.target.value))}
            className="bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer">
            {Array.from({ length: 10 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <button onClick={handleAddClick}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            입력
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="px-1 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 flex-wrap">
          <button onClick={toggleAllKinds}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
              allKindsOn ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            전체
          </button>
          {KINDS.map(k => {
            const on = activeKinds[k.key]
            return (
              <button key={k.key} onClick={() => toggleKind(k.key)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  on ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={on ? { backgroundColor: k.color } : undefined}>
                {k.label}
              </button>
            )
          })}
        </div>
        <span className="text-slate-200 text-xs">|</span>
        <div className="flex gap-1 ml-auto">
          {[2, 3, 5].map(n => {
            const isActive = yearsBack === n
            return (
              <button key={n} onClick={() => setYearsBack(n as 2 | 3 | 5)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  isActive ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={isActive ? { backgroundColor: '#1A237E' } : undefined}>
                최근 {n}년
              </button>
            )
          })}
        </div>
      </div>

      {/* 차트 영역 — 좌: 월별 사용량(꺾은선), 우: 월별 금액(누적바) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${card.base} p-4`}>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">월별 사용량</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="ym" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis hide domain={[0, 1]} />
              <Tooltip content={<UsageTooltip activeKinds={activeKindList} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>} />
              {activeKindList.map(k => (
                <Line key={k.key} type="monotone" dataKey={`${k.key}_usage_norm`} name={k.label}
                  stroke={k.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`${card.base} p-4`}>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">월별 금액</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="ym" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<AmountTooltip activeKinds={activeKindList} />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>} />
              {activeKindList.map(k => (
                <Bar key={k.key} dataKey={`${k.key}_amount`} name={k.label} stackId="amount" fill={k.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 월별 상세 — 카드 리스트 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-slate-700">월별 상세</h2>
          <span className="text-[10px] text-slate-400">카드 클릭 시 수정</span>
        </div>
        {loading ? (
          <div className={`${card.base} py-8 text-center text-xs text-slate-400`}>불러오는 중…</div>
        ) : records.length === 0 ? (
          <div className={`${card.base} py-8 text-center text-xs text-slate-400`}>기록이 없습니다. 우측 상단 입력 버튼으로 추가하세요.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {records.map((r) => {
              const total = activeKindList.reduce((s, k) => s + Number(r[fieldKey(k.key, 'amount')] as number), 0)
              return (
                <button
                  key={r.id}
                  onClick={() => handleRowClick(r)}
                  className={`${card.base} w-full text-left p-3 sm:p-4 hover:border-slate-200 hover:shadow-sm transition-all`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {r.year}.{String(r.month).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-medium text-slate-700 tabular-nums">
                      {total.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0 divide-slate-100">
                    {activeKindList.map((k, idx) => {
                      const amount = Number(r[fieldKey(k.key, 'amount')] as number)
                      const usage = Number(r[fieldKey(k.key, 'usage')] as number)
                      // 2열 그리드에서 마지막 행을 제외하고 아래쪽에 옅은 구분선
                      const total = activeKindList.length
                      const lastRowStart = Math.floor((total - 1) / 2) * 2
                      const isBottomRow = idx >= lastRowStart
                      return (
                        <div
                          key={k.key}
                          className={`py-2 px-1 min-w-0 flex items-center justify-between gap-2 ${
                            isBottomRow ? '' : 'border-b border-slate-100'
                          }`}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: k.color }} />
                            <span className="text-xs font-medium truncate" style={{ color: k.color }}>{k.label}</span>
                          </div>
                          <div className="text-right min-w-0">
                            <div className="text-xs font-bold text-slate-800 tabular-nums">
                              {amount.toLocaleString('ko-KR')}원
                            </div>
                            <div className="text-[11px] text-slate-400 tabular-nums">
                              {usage.toLocaleString('ko-KR')} {k.unit}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {showModal ? (
        <EnergyFormModal
          initial={editing}
          defaultYear={nextDefault.year}
          defaultMonth={nextDefault.month}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={handleSaved}
          onDelete={editing ? handleDelete : undefined}
        />
      ) : null}
    </div>
  )
}
