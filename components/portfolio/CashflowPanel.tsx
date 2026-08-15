'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
  return type === 'opening' ? '#8794a8' : isInflow(type) ? INFLOW_COLOR : OUTFLOW_COLOR
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
  const amountRef = useRef<HTMLInputElement>(null)

  function onRowKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSave() }
    if (e.key === 'Escape' && editId) { e.preventDefault(); resetForm() }
  }

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
      // 닫기 개념이 없다 — 커서는 금액 칸에 남는다
      amountRef.current?.focus()
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
      <div className="px-5 py-3 border-b border-surface-low shrink-0">
        <div className="grid grid-cols-4 gap-2">
          <div>
            <p className="text-micro tracking-normal text-ink-4">투자원금 <span className="text-ink-5">누적입금</span></p>
            <p className="text-body font-bold tabular-nums" style={{ color: INFLOW_COLOR }}>{formatWonRound(totals.inflow)}</p>
          </div>
          <div>
            <p className="text-micro tracking-normal text-ink-4">누적출금</p>
            <p className="text-body font-bold tabular-nums" style={{ color: OUTFLOW_COLOR }}>{formatWonRound(totals.outflow)}</p>
          </div>
          <div>
            <p className="text-micro tracking-normal text-ink-4">평가금액</p>
            <p className="text-body font-bold text-ink tabular-nums">{marketValue != null ? formatWonRound(marketValue) : '—'}</p>
          </div>
          <div>
            <p className="text-micro tracking-normal text-ink-4">수익금액</p>
            {totals.profit != null && totals.inflow > 0 ? (
              <p className={`text-body font-bold tabular-nums ${totals.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                {totals.profit >= 0 ? '+' : ''}{formatWonRound(totals.profit)}
                {totals.rate != null ? (
                  <span className="text-micro tracking-normal ml-1 opacity-80">({totals.rate >= 0 ? '+' : ''}{(totals.rate * 100).toFixed(1)}%)</span>
                ) : null}
              </p>
            ) : <p className="text-body text-ink-5">—</p>}
          </div>
        </div>
      </div>

      {/* 입력 행 — D-03: 표 첫 행이 곧 입력 행.
          ⏎ 저장 후 행이 바로 아래 쌓이고 커서는 금액 칸에 남는다(닫기 개념 없음).
          입력 중에도 기존 내역이 보여 중복 입금을 즉시 확인할 수 있다.
          <640px에서는 인라인 행이 들어가지 않으므로 세로 폼으로 폴백한다. */}
      <div className="px-5 py-3 shrink-0">
        <div className={`rounded-[9px] p-1.5 ${editId ? 'bg-warning/10' : 'bg-surface-low'}`}>
          {/* ≥640px — 한 줄 인라인 행 */}
          <div className="hidden sm:flex items-center gap-[5px]">
            <DateInput value={date} onChange={setDate} variant="cell" className="w-[66px] shrink-0" />
            <div className="relative w-[92px] shrink-0">
              <select value={type} onChange={e => setType(e.target.value as CashflowType)}
                className="w-full appearance-none rounded-cell bg-surface-card border-0 pl-2 pr-5 py-1.5 text-body text-ink focus:outline-none focus:shadow-focus transition-shadow">
                {TYPE_ORDER.map(t => <option key={t} value={t}>{CASHFLOW_TYPE_LABELS[t]}</option>)}
              </select>
              <svg className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-ink-5 pointer-events-none"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
              onKeyDown={onRowKeyDown} placeholder="메모 (선택)" maxLength={100}
              className="flex-1 min-w-0 rounded-cell bg-surface-card border-0 px-2 py-1.5 text-body text-ink placeholder:text-ink-5 focus:outline-none focus:shadow-focus transition-shadow" />
            <input ref={amountRef} type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmountInput(e.target.value))}
              onKeyDown={onRowKeyDown} placeholder="0"
              className="w-24 shrink-0 rounded-cell bg-surface-card border-0 px-2 py-1.5 text-body font-bold text-right tabular-nums text-ink placeholder:text-ink-5 shadow-focus focus:outline-none" />
            {editId ? (
              <button onClick={resetForm} className="shrink-0 px-2 py-1.5 rounded-cell text-meta text-ink-3 hover:bg-surface-card transition-colors">취소</button>
            ) : null}
            <button onClick={() => handleSave()} disabled={saving}
              className="shrink-0 px-[11px] py-1.5 rounded-cell bg-action text-white text-meta font-bold disabled:opacity-60 hover:opacity-90 transition-opacity">
              {saving ? '…' : editId ? '수정' : '⏎'}
            </button>
          </div>

          {/* <640px — 세로 폼 폴백 */}
          <div className="sm:hidden grid gap-2 p-1">
            <DateInput value={date} onChange={setDate} />
            <div className="flex flex-wrap gap-1">
              {TYPE_ORDER.map(t => (
                <button key={t} type="button" onClick={() => setType(t)} className={btn.pill(type === t)}>
                  {CASHFLOW_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택)" maxLength={100} className={field.input} />
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmountInput(e.target.value))}
              placeholder="0" className={`${field.input} text-right font-bold`} />
            <div className="flex justify-end gap-2">
              {editId ? <button onClick={resetForm} className={btn.secondary}>취소</button> : null}
              <button onClick={() => handleSave()} disabled={saving} className={btn.primary}>
                {saving ? '저장 중…' : editId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>

        {type === 'opening' ? (
          <p className="text-micro tracking-normal text-ink-4 mt-2">기초잔액: 기록 시작 시점의 계좌 평가액을 입금으로 간주하는 앵커. 계좌당 1건만 넣고 이후는 실제 입출금만 기록하세요.</p>
        ) : null}
        {type === 'deposit' || type === 'withdrawal' ? (
          <p className="text-micro tracking-normal text-ink-4 mt-2">계좌 간 이체는 보내는 계좌에 출금, 받는 계좌에 입금을 각각 기록하세요.</p>
        ) : null}
        {editId ? (
          <p className="text-micro tracking-normal text-warning mt-2">기존 기록을 수정하는 중입니다.</p>
        ) : null}
        {err ? <p className="text-body text-danger mt-2">{err}</p> : null}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {items === null ? (
          <div className="p-5 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className={skeleton.line} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 px-5">
            <p className="text-body text-ink-4">입출금 기록이 없습니다</p>
            <p className="text-micro tracking-normal text-ink-5 mt-1.5">
              <span className="font-medium text-ink-4">기초잔액</span>으로 현재 평가액을 먼저 넣으면
              그 시점부터의 수익금액이 계산됩니다
            </p>
          </div>
        ) : (
          items.map(cf => (
            <div key={cf.id}
              className={`flex items-center gap-3 px-5 py-2.5 border-b border-surface-low hover:bg-surface-low transition-colors group ${editId === cf.id ? 'bg-warning/10' : ''}`}>
              <span className="text-meta text-ink-4 tabular-nums shrink-0 w-20">{cf.flow_date}</span>
              <span className={`${badge.sm} shrink-0`}>
                <span className={badge.dot} style={{ backgroundColor: typeColor(cf.type) }} />
                {CASHFLOW_TYPE_LABELS[cf.type]}
              </span>
              <span className="text-meta text-ink-4 flex-1 min-w-0 truncate">{cf.memo}</span>
              <span className="text-body font-bold tabular-nums shrink-0" style={{ color: typeColor(cf.type) }}>
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
