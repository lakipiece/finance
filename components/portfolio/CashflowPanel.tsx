'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Cashflow, CashflowType } from '@/lib/portfolio/types'
import { CASHFLOW_INFLOW_TYPES, CASHFLOW_TYPE_LABELS } from '@/lib/portfolio/types'
import { field, btn, badge, brand, skeleton } from '@/lib/styles'
import { formatWonRound } from '@/lib/utils'
import DateInput from '@/components/ui/DateInput'

const TYPE_ORDER: CashflowType[] = ['deposit', 'withdrawal', 'opening']
const INFLOW_COLOR = brand.accent    // 입금 계열
const OUTFLOW_COLOR = '#690043'      // 출금 계열

export function isInflow(type: CashflowType) {
  return CASHFLOW_INFLOW_TYPES.includes(type)
}

function typeColor(type: CashflowType) {
  return type === 'opening' ? '#64748b' : isInflow(type) ? INFLOW_COLOR : OUTFLOW_COLOR
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtAmountInput(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString('ko-KR') : ''
}

function parseAmountInput(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0
}

/* ── 계좌 모달의 입출금 탭 본문 (입력 폼 인라인 포함) ── */
export default function CashflowPanel({ accountId, marketValue, onChanged }: {
  accountId: string
  /** 해당 계좌의 현재 평가액 (수익금액 계산용). 모르면 생략 */
  marketValue?: number
  onChanged?: () => void
}) {
  const [items, setItems] = useState<Cashflow[] | null>(null)

  // 인라인 폼 상태 — editId가 있으면 수정 모드
  const [editId, setEditId] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [type, setType] = useState<CashflowType>('deposit')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portfolio/cashflows?account_id=${accountId}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
  }, [accountId])

  useEffect(() => { setItems(null); resetForm(); load() }, [load])  // eslint-disable-line react-hooks/exhaustive-deps

  function resetForm() {
    setEditId(null)
    setDate(todayStr())
    setType('deposit')
    setAmount('')
    setMemo('')
    setErr('')
  }

  function startEdit(cf: Cashflow) {
    setEditId(cf.id)
    setDate(cf.flow_date)
    setType(cf.type)
    setAmount(fmtAmountInput(String(cf.amount)))
    setMemo(cf.memo)
    setErr('')
  }

  // 수익금액 = 평가금액 + 누적출금 − 누적입금 (배당 인출 포함)
  const totals = useMemo(() => {
    const list = items ?? []
    const inflow = list.filter(c => isInflow(c.type)).reduce((s, c) => s + c.amount, 0)
    const outflow = list.filter(c => !isInflow(c.type)).reduce((s, c) => s + c.amount, 0)
    const profit = marketValue != null ? marketValue + outflow - inflow : null
    const rate = profit != null && inflow > 0 ? profit / inflow : null
    return { inflow, outflow, profit, rate }
  }, [items, marketValue])

  async function handleSave() {
    const amt = parseAmountInput(amount)
    if (!date || amt <= 0) { setErr('날짜와 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const url = editId ? `/api/portfolio/cashflows/${editId}` : '/api/portfolio/cashflows'
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, flow_date: date, type, amount: amt, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      resetForm()
      load()
      onChanged?.()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    await fetch(`/api/portfolio/cashflows/${id}`, { method: 'DELETE' })
    if (editId === id) resetForm()
    load()
    onChanged?.()
  }

  return (
    <>
      {/* 요약 */}
      <div className="px-5 py-3 border-b border-slate-100 shrink-0">
        <div className="grid grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] text-slate-400">투자원금 <span className="text-slate-300">누적입금</span></p>
            <p className="text-xs font-semibold tabular-nums" style={{ color: INFLOW_COLOR }}>{formatWonRound(totals.inflow)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">누적출금</p>
            <p className="text-xs font-semibold tabular-nums" style={{ color: OUTFLOW_COLOR }}>{formatWonRound(totals.outflow)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">평가금액</p>
            <p className="text-xs font-semibold text-slate-700 tabular-nums">{marketValue != null ? formatWonRound(marketValue) : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400">수익금액</p>
            {totals.profit != null && totals.inflow > 0 ? (
              <p className={`text-xs font-semibold tabular-nums ${totals.profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                {totals.profit >= 0 ? '+' : ''}{formatWonRound(totals.profit)}
                {totals.rate != null ? (
                  <span className="text-[10px] ml-1 opacity-80">({totals.rate >= 0 ? '+' : ''}{(totals.rate * 100).toFixed(1)}%)</span>
                ) : null}
              </p>
            ) : <p className="text-xs text-slate-300">—</p>}
          </div>
        </div>
      </div>

      {/* 입력 폼 — 탭 안 인라인 */}
      <div className={`px-5 py-4 border-b border-slate-100 shrink-0 ${editId ? 'bg-amber-50/40' : 'bg-slate-50/60'}`}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <div>
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-32" />
          </div>
          <div>
            <label className={field.label}>유형</label>
            <div className="flex flex-wrap gap-1">
              {TYPE_ORDER.map(t => {
                const active = type === t
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={btn.pill(active)}
                    style={active ? { backgroundColor: typeColor(t), borderColor: typeColor(t) } : undefined}>
                    {CASHFLOW_TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="w-32">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmountInput(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="0" className={`${field.input} text-right`} />
          </div>
          <div className="flex-1 min-w-36">
            <label className={field.label}>메모</label>
            <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
              placeholder="메모 (선택)" maxLength={100} className={field.input} />
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            {editId ? (
              <button onClick={resetForm} className={btn.ghost}>취소</button>
            ) : null}
            <button onClick={handleSave} disabled={saving}
              className={btn.primary} style={{ backgroundColor: brand.primary }}>
              {saving ? '저장 중…' : editId ? '수정' : '저장'}
            </button>
          </div>
        </div>
        {type === 'opening' ? (
          <p className="text-[10px] text-slate-400 mt-2">기초잔액: 기록 시작 시점의 계좌 평가액을 입금으로 간주하는 앵커. 계좌당 1건만 넣고 이후는 실제 입출금만 기록하세요.</p>
        ) : null}
        {type === 'deposit' || type === 'withdrawal' ? (
          <p className="text-[10px] text-slate-400 mt-2">계좌 간 이체는 보내는 계좌에 출금, 받는 계좌에 입금을 각각 기록하세요.</p>
        ) : null}
        {editId ? (
          <p className="text-[10px] text-amber-600 mt-2">기존 기록을 수정하는 중입니다.</p>
        ) : null}
        {err ? <p className="text-xs text-rose-500 mt-2">{err}</p> : null}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items === null ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className={skeleton.line} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 px-5">
            <p className="text-xs text-slate-400">입출금 기록이 없습니다</p>
            <p className="text-[10px] text-slate-300 mt-1.5">
              <span className="font-medium text-slate-400">기초잔액</span>으로 현재 평가액을 먼저 넣으면
              그 시점부터의 수익금액이 계산됩니다
            </p>
          </div>
        ) : (
          items.map(cf => (
            <div key={cf.id}
              className={`flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors group ${editId === cf.id ? 'bg-amber-50/60' : ''}`}>
              <span className="text-[11px] text-slate-400 tabular-nums shrink-0 w-20">{cf.flow_date}</span>
              <span className={`${badge.sm} shrink-0`} style={{ backgroundColor: `${typeColor(cf.type)}18`, color: typeColor(cf.type) }}>
                {CASHFLOW_TYPE_LABELS[cf.type]}
              </span>
              <span className="text-[11px] text-slate-400 flex-1 min-w-0 truncate">{cf.memo}</span>
              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: typeColor(cf.type) }}>
                {isInflow(cf.type) ? '+' : '−'}{formatWonRound(cf.amount)}
              </span>
              <span className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(cf)} className={btn.icon} title="수정">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(cf.id)} className={btn.danger} title="삭제">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  )
}
