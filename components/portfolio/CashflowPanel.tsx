'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Cashflow, CashflowType } from '@/lib/portfolio/types'
import { CASHFLOW_INFLOW_TYPES, CASHFLOW_TYPE_LABELS } from '@/lib/portfolio/types'
import { field, btn, badge, brand, skeleton } from '@/lib/styles'
import { formatWonRound } from '@/lib/utils'
import DateInput from '@/components/ui/DateInput'

const TYPE_ORDER: CashflowType[] = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'opening']
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

/* ── 입력/수정 폼 (계좌 모달 위에 뜨는 중첩 모달) ── */
function CashflowForm({ accountId, editItem, onClose, onSaved }: {
  accountId: string
  editItem: Cashflow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(editItem?.flow_date ?? todayStr())
  const [type, setType] = useState<CashflowType>(editItem?.type ?? 'deposit')
  const [amount, setAmount] = useState(editItem ? fmtAmountInput(String(editItem.amount)) : '')
  const [memo, setMemo] = useState(editItem?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmountInput(amount)
    if (!date || amt <= 0) { setErr('날짜와 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const url = editItem ? `/api/portfolio/cashflows/${editItem.id}` : '/api/portfolio/cashflows'
      const res = await fetch(url, {
        method: editItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, flow_date: date, type, amount: amt, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">{editItem ? '입출금 수정' : '입출금 기록'}</p>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600" aria-label="닫기">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div>
            <label className={field.label}>유형</label>
            <div className="flex flex-wrap gap-1 mt-1">
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
            {type === 'opening' ? (
              <p className="text-[10px] text-slate-400 mt-1.5">기록 시작 시점의 계좌 평가액. 계좌당 1건만 넣고 이후는 실제 입출금만 기록하세요.</p>
            ) : null}
            {type === 'transfer_in' || type === 'transfer_out' ? (
              <p className="text-[10px] text-slate-400 mt-1.5">보내는 계좌에 이체출금, 받는 계좌에 이체입금을 각각 기록하세요.</p>
            ) : null}
          </div>
          <div>
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmountInput(e.target.value))}
              placeholder="0" className={`${field.input} text-right`} />
          </div>
          <div>
            <label className={field.label}>메모</label>
            <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
              placeholder="메모 (선택)" maxLength={100} className={field.input} />
          </div>
          {err ? <p className="text-xs text-rose-500">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className={btn.ghost}>취소</button>
          <button onClick={handleSave} disabled={saving}
            className={btn.primary} style={{ backgroundColor: brand.primary }}>
            {saving ? '저장 중…' : editItem ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── 계좌 모달의 입출금 탭 본문 ── */
export default function CashflowPanel({ accountId, marketValue, onChanged }: {
  accountId: string
  /** 해당 계좌의 현재 평가액 (실질수익 계산용). 모르면 생략 */
  marketValue?: number
  onChanged?: () => void
}) {
  const [items, setItems] = useState<Cashflow[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Cashflow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/portfolio/cashflows?account_id=${accountId}`)
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch { setItems([]) }
  }, [accountId])

  useEffect(() => { setItems(null); load() }, [load])

  // 수익금액 = 평가금액 + 누적출금 − 누적입금 (배당 인출 포함)
  const totals = useMemo(() => {
    const list = items ?? []
    const inflow = list.filter(c => isInflow(c.type)).reduce((s, c) => s + c.amount, 0)
    const outflow = list.filter(c => !isInflow(c.type)).reduce((s, c) => s + c.amount, 0)
    const profit = marketValue != null ? marketValue + outflow - inflow : null
    const rate = profit != null && inflow > 0 ? profit / inflow : null
    return { inflow, outflow, profit, rate }
  }, [items, marketValue])

  function handleSaved() {
    setShowForm(false)
    setEditItem(null)
    load()
    onChanged?.()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    await fetch(`/api/portfolio/cashflows/${id}`, { method: 'DELETE' })
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
            {totals.profit != null ? (
              <p className={`text-xs font-semibold tabular-nums ${totals.profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                {totals.profit >= 0 ? '+' : ''}{formatWonRound(totals.profit)}
                {totals.rate != null ? (
                  <span className="text-[10px] ml-1 opacity-80">({totals.rate >= 0 ? '+' : ''}{(totals.rate * 100).toFixed(1)}%)</span>
                ) : null}
              </p>
            ) : <p className="text-xs text-slate-300">—</p>}
          </div>
        </div>
        {marketValue != null && totals.inflow > 0 ? (
          <p className="text-[10px] text-slate-400 mt-2">
            수익금액 = 평가금액 + 출금 − 입금 (배당 인출·원금 회수 포함)
          </p>
        ) : null}
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
              그 시점부터의 실질수익이 계산됩니다
            </p>
          </div>
        ) : (
          items.map(cf => (
            <div key={cf.id} className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors group">
              <span className="text-[11px] text-slate-400 tabular-nums shrink-0 w-20">{cf.flow_date}</span>
              <span className={`${badge.sm} shrink-0`} style={{ backgroundColor: `${typeColor(cf.type)}18`, color: typeColor(cf.type) }}>
                {CASHFLOW_TYPE_LABELS[cf.type]}
              </span>
              <span className="text-[11px] text-slate-400 flex-1 min-w-0 truncate">{cf.memo}</span>
              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: typeColor(cf.type) }}>
                {isInflow(cf.type) ? '+' : '−'}{formatWonRound(cf.amount)}
              </span>
              <span className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditItem(cf); setShowForm(true) }} className={btn.icon} title="수정">
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

      {/* 추가 버튼 */}
      <div className="px-5 py-3 border-t border-slate-100 shrink-0">
        <button onClick={() => { setEditItem(null); setShowForm(true) }}
          className="w-full py-2 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors">
          + 입출금 기록
        </button>
      </div>

      {showForm ? (
        <CashflowForm
          accountId={accountId}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
