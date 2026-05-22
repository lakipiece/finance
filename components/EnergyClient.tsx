'use client'

import { Fragment, useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  ResponsiveContainer, BarChart, LineChart,
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { btn, card, field, modal, tbl, text } from '@/lib/styles'
import { formatWonFull } from '@/lib/utils'

type EnergyKind = 'electricity' | 'water' | 'hot_water' | 'heating'

interface KindMeta {
  key: EnergyKind
  label: string
  unit: string
  color: string
}

const KINDS: KindMeta[] = [
  { key: 'electricity', label: '전기료',   unit: 'kWh',  color: '#1A237E' },
  { key: 'water',       label: '수도료',   unit: 'm³',   color: '#0277BD' },
  { key: 'hot_water',   label: '온수',     unit: 'm³',   color: '#EF6C00' },
  { key: 'heating',     label: '난방비',   unit: 'Gcal', color: '#AD1457' },
]

interface EnergyRecord {
  id: number
  year: number
  month: number
  memo: string
  electricity_amount: number
  electricity_prev_reading: number
  electricity_curr_reading: number
  electricity_usage: number
  water_amount: number
  water_prev_reading: number
  water_curr_reading: number
  water_usage: number
  hot_water_amount: number
  hot_water_prev_reading: number
  hot_water_curr_reading: number
  hot_water_usage: number
  heating_amount: number
  heating_prev_reading: number
  heating_curr_reading: number
  heating_usage: number
}

function fieldKey(kind: EnergyKind, suffix: 'amount' | 'prev_reading' | 'curr_reading' | 'usage'): keyof EnergyRecord {
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
  // 숫자 + 소수점 1개 허용
  const cleaned = v.replace(/[^0-9.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot < 0) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
}

function parseReading(v: string) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
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

  // kind별 4개 필드 (문자열로 보관 — 입력 중 포맷 유지)
  const initFields = useMemo(() => {
    const out: Record<string, string> = {}
    for (const k of KINDS) {
      const amt = initial ? Number(initial[fieldKey(k.key, 'amount')] as number) : 0
      const prev = initial ? Number(initial[fieldKey(k.key, 'prev_reading')] as number) : 0
      const curr = initial ? Number(initial[fieldKey(k.key, 'curr_reading')] as number) : 0
      const usage = initial ? Number(initial[fieldKey(k.key, 'usage')] as number) : 0
      out[`${k.key}_amount`] = amt ? amt.toLocaleString('ko-KR') : ''
      out[`${k.key}_prev_reading`] = prev ? String(prev) : ''
      out[`${k.key}_curr_reading`] = curr ? String(curr) : ''
      out[`${k.key}_usage`] = usage ? String(usage) : ''
    }
    return out
  }, [initial])

  const [vals, setVals] = useState<Record<string, string>>(initFields)

  function update(k: string, v: string) {
    setVals(prev => ({ ...prev, [k]: v }))
  }

  // 전월/당월 지침 변경 시 사용량 자동 계산 (사용자가 직접 입력하지 않은 경우만)
  function handleReadingChange(kind: EnergyKind, suffix: 'prev_reading' | 'curr_reading', v: string) {
    const formatted = fmtReading(v)
    const next = { ...vals, [`${kind}_${suffix}`]: formatted }
    const prev = parseReading(suffix === 'prev_reading' ? formatted : next[`${kind}_prev_reading`])
    const curr = parseReading(suffix === 'curr_reading' ? formatted : next[`${kind}_curr_reading`])
    const diff = curr - prev
    if (diff > 0) {
      next[`${kind}_usage`] = String(diff % 1 === 0 ? diff : diff.toFixed(3))
    }
    setVals(next)
  }

  async function handleSave() {
    if (!year || month < 1 || month > 12) { setErr('년월을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const payload: Record<string, unknown> = { year, month, memo }
      for (const k of KINDS) {
        payload[`${k.key}_amount`] = parseAmount(vals[`${k.key}_amount`] ?? '')
        payload[`${k.key}_prev_reading`] = parseReading(vals[`${k.key}_prev_reading`] ?? '')
        payload[`${k.key}_curr_reading`] = parseReading(vals[`${k.key}_curr_reading`] ?? '')
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
          <div className="flex gap-4 items-end">
            <div className="flex flex-col gap-1">
              <label className={field.label}>년도</label>
              <input type="number" value={year}
                onChange={e => setYear(parseInt(e.target.value) || 0)}
                className={`${field.inputFit} w-24 text-right`} />
            </div>
            <div className="flex flex-col gap-1">
              <label className={field.label}>월</label>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                className={`${field.select} w-20`}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
          </div>

          {KINDS.map(k => (
            <div key={k.key} className="rounded-xl border border-slate-100 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                <span className="text-xs font-semibold text-slate-700">{k.label}</span>
                <span className="text-[10px] text-slate-400">({k.unit})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={field.label}>금액 (원)</label>
                  <input type="text" inputMode="numeric"
                    value={vals[`${k.key}_amount`] ?? ''}
                    onChange={e => update(`${k.key}_amount`, fmtAmount(e.target.value))}
                    placeholder="0"
                    className={`${field.input} text-right`} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={field.label}>전월 지침</label>
                  <input type="text" inputMode="decimal"
                    value={vals[`${k.key}_prev_reading`] ?? ''}
                    onChange={e => handleReadingChange(k.key, 'prev_reading', e.target.value)}
                    placeholder="0"
                    className={`${field.input} text-right`} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={field.label}>당월 지침</label>
                  <input type="text" inputMode="decimal"
                    value={vals[`${k.key}_curr_reading`] ?? ''}
                    onChange={e => handleReadingChange(k.key, 'curr_reading', e.target.value)}
                    placeholder="0"
                    className={`${field.input} text-right`} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={field.label}>사용량 ({k.unit})</label>
                  <input type="text" inputMode="decimal"
                    value={vals[`${k.key}_usage`] ?? ''}
                    onChange={e => update(`${k.key}_usage`, fmtReading(e.target.value))}
                    placeholder="0"
                    className={`${field.input} text-right`} />
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
  const chartData = useMemo(() => {
    const map = new Map<string, EnergyRecord>()
    for (const r of records) map.set(ymKey(r.year, r.month), r)
    const out: Array<Record<string, string | number>> = []
    for (let y = yearFrom; y <= yearTo; y++) {
      for (let m = 1; m <= 12; m++) {
        const key = ymKey(y, m)
        const r = map.get(key)
        const row: Record<string, string | number> = {
          ym: `${String(y).slice(2)}/${String(m).padStart(2, '0')}`,
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
    return out
  }, [records, yearFrom, yearTo])

  const activeKindList = KINDS.filter(k => activeKinds[k.key])

  function toggleKind(k: EnergyKind) {
    setActiveKinds(prev => ({ ...prev, [k]: !prev[k] }))
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
        <div>
          <h1 className={text.pageTitle}>에너지 지출관리</h1>
          <p className="text-xs text-slate-400 mt-1">월별 전기·수도·온수·난방 사용량과 금액을 기록합니다</p>
        </div>
        <button onClick={handleAddClick}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors"
          style={{ backgroundColor: '#1A237E' }}>
          + 입력
        </button>
      </div>

      {/* 필터 */}
      <div className={`${card.base} p-4 flex flex-wrap items-center gap-4`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">기준 년도</span>
          <select value={yearTo} onChange={e => setYearTo(parseInt(e.target.value))}
            className={`${field.select} w-24`}>
            {Array.from({ length: 10 }, (_, i) => currentYear - i).map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-1">기간</span>
          {[2, 3, 5].map(n => (
            <button key={n} onClick={() => setYearsBack(n as 2 | 3 | 5)}
              className={btn.pill(yearsBack === n)}
              style={yearsBack === n ? { backgroundColor: '#1A237E', borderColor: '#1A237E' } : undefined}>
              최근 {n}년
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          <span className="text-xs text-slate-500 mr-1">항목</span>
          {KINDS.map(k => {
            const on = activeKinds[k.key]
            return (
              <button key={k.key} onClick={() => toggleKind(k.key)}
                className={btn.pill(on)}
                style={on ? { backgroundColor: k.color, borderColor: k.color } : undefined}>
                {k.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${card.base} p-4`}>
          <p className="text-xs font-semibold text-slate-600 mb-3">월별 금액 (원)</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="ym" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v: number) => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                formatter={(v: number, name: string) => [formatWonFull(v), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>} />
              {activeKindList.map(k => (
                <Line key={k.key} type="monotone" dataKey={`${k.key}_amount`} name={k.label}
                  stroke={k.color} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={`${card.base} p-4`}>
          <p className="text-xs font-semibold text-slate-600 mb-3">월별 사용량 (누적)</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="ym" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                formatter={(v: number, name: string) => {
                  const meta = KINDS.find(k => k.label === name)
                  return [`${Number(v).toLocaleString('ko-KR')} ${meta?.unit ?? ''}`, name]
                }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>} />
              {activeKindList.map(k => (
                <Bar key={k.key} dataKey={`${k.key}_usage`} name={k.label} stackId="usage" fill={k.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 표 */}
      <div className={`${card.base} p-4`}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-600">월별 상세</p>
          <span className="text-[10px] text-slate-400">행 클릭 시 수정</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={tbl.th}>년월</th>
                {activeKindList.map(k => (
                  <th key={k.key} colSpan={2} className={`${tbl.thRight} border-l border-slate-100`}>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: k.color }} />
                      {k.label}
                    </span>
                  </th>
                ))}
                <th className={tbl.thRight}>합계</th>
              </tr>
              <tr className="border-b border-slate-100">
                <th></th>
                {activeKindList.map(k => (
                  <Fragment key={k.key}>
                    <th className={`${tbl.thRight} border-l border-slate-100`}>금액(원)</th>
                    <th className={tbl.thRight}>사용량({k.unit})</th>
                  </Fragment>
                ))}
                <th className={tbl.thRight}>금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={2 + activeKindList.length * 2} className="py-6 text-center text-slate-400">불러오는 중…</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={2 + activeKindList.length * 2} className="py-6 text-center text-slate-400">기록이 없습니다. 우측 상단 + 입력 버튼으로 추가하세요.</td></tr>
              ) : (
                records.map((r, idx) => {
                  const total = activeKindList.reduce((s, k) => s + Number(r[fieldKey(k.key, 'amount')] as number), 0)
                  return (
                    <tr key={r.id} onClick={() => handleRowClick(r)}
                      className={`${idx % 2 ? tbl.rowOdd : tbl.rowEven} cursor-pointer`}>
                      <td className={tbl.td}>{r.year}.{String(r.month).padStart(2, '0')}</td>
                      {activeKindList.map(k => (
                        <Fragment key={k.key}>
                          <td className={`${tbl.tdRight} border-l border-slate-100`}>
                            {Number(r[fieldKey(k.key, 'amount')] as number).toLocaleString('ko-KR')}
                          </td>
                          <td className={tbl.tdRight}>
                            {Number(r[fieldKey(k.key, 'usage')] as number).toLocaleString('ko-KR')}
                          </td>
                        </Fragment>
                      ))}
                      <td className={`${tbl.tdRight} font-semibold text-slate-800`}>
                        {total.toLocaleString('ko-KR')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
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
