'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Account, Cashflow, CashflowType } from '@/lib/portfolio/types'
import { CASHFLOW_INFLOW_TYPES, CASHFLOW_TYPE_LABELS } from '@/lib/portfolio/types'
import { card, field, modal, btn, tbl, badge, brand, layout } from '@/lib/styles'
import { formatWonRound } from '@/lib/utils'
import PageHeader from '@/components/ui/PageHeader'
import DateInput from '@/components/ui/DateInput'

interface Props {
  accounts: Account[]
  cashflows: Cashflow[]
  /** 계좌별 실시간 평가액 (KRW) */
  accountValues: Record<string, number>
  tableMissing: boolean
}

const TYPE_ORDER: CashflowType[] = ['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'opening']
const INFLOW_COLOR = brand.accent      // 입금 계열
const OUTFLOW_COLOR = '#690043'        // 출금 계열

function isInflow(type: CashflowType) {
  return CASHFLOW_INFLOW_TYPES.includes(type)
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

function TypeBadge({ type }: { type: CashflowType }) {
  const color = type === 'opening' ? '#64748b' : isInflow(type) ? INFLOW_COLOR : OUTFLOW_COLOR
  return (
    <span className={badge.sm} style={{ backgroundColor: `${color}18`, color }}>
      {CASHFLOW_TYPE_LABELS[type]}
    </span>
  )
}

/* ── 입력/수정 모달 ── */
function CashflowFormModal({ accounts, editItem, onClose, onSaved }: {
  accounts: Account[]
  editItem: Cashflow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [accountId, setAccountId] = useState(editItem?.account_id ?? accounts[0]?.id ?? '')
  const [date, setDate] = useState(editItem?.flow_date ?? todayStr())
  const [type, setType] = useState<CashflowType>(editItem?.type ?? 'deposit')
  const [amount, setAmount] = useState(editItem ? fmtAmountInput(String(editItem.amount)) : '')
  const [memo, setMemo] = useState(editItem?.memo ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmountInput(amount)
    if (!accountId || !date || amt <= 0) { setErr('계좌, 날짜, 금액을 확인해주세요.'); return }
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

  return (
    <div className={modal.overlay} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <p className="text-sm font-semibold text-slate-800">{editItem ? '입출금 수정' : '입출금 기록'}</p>
          <button onClick={onClose} className={modal.close} aria-label="닫기">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modal.body}>
          <div>
            <label className={field.label}>계좌</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} className={`${field.select} w-full`}>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.broker} · {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div>
            <label className={field.label}>유형</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {TYPE_ORDER.map(t => {
                const active = type === t
                const color = t === 'opening' ? '#64748b' : isInflow(t) ? INFLOW_COLOR : OUTFLOW_COLOR
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={btn.pill(active)}
                    style={active ? { backgroundColor: color, borderColor: color } : undefined}>
                    {CASHFLOW_TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
            {type === 'opening' ? (
              <p className="text-[10px] text-slate-400 mt-1.5">기록 시작 시점의 계좌 평가액을 입금으로 간주하는 앵커입니다. 계좌당 1건 권장.</p>
            ) : null}
            {type === 'transfer_in' || type === 'transfer_out' ? (
              <p className="text-[10px] text-slate-400 mt-1.5">계좌 간 이체는 보내는 계좌에 이체출금, 받는 계좌에 이체입금을 각각 기록하세요.</p>
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
        <div className={modal.footer}>
          <button onClick={onClose} className={btn.ghost}>취소</button>
          <button onClick={handleSave} disabled={saving}
            className={btn.primary} style={{ backgroundColor: brand.primary }}>
            {saving ? '저장 중…' : editItem ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── KPI 카드 ── */
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className={`${card.base} p-4 flex flex-col`}>
      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight mt-auto text-right" style={{ color: color ?? '#334155' }}>{value}</p>
      {sub ? <p className="text-[10px] text-slate-400 mt-0.5 text-right tabular-nums">{sub}</p> : null}
    </div>
  )
}

/* ── 메인 ── */
export default function CashflowManager({ accounts, cashflows, accountValues, tableMissing }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Cashflow | null>(null)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<number | null>(null)

  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  // 계좌별 입금/출금 집계 (전체 기간)
  const perAccount = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number }> = {}
    for (const cf of cashflows) {
      const m = (map[cf.account_id] ??= { inflow: 0, outflow: 0 })
      if (isInflow(cf.type)) m.inflow += cf.amount
      else m.outflow += cf.amount
    }
    return map
  }, [cashflows])

  // 원장이 기록된 계좌만 실질수익 계산 대상
  const recordedIds = useMemo(() => Object.keys(perAccount), [perAccount])

  const totals = useMemo(() => {
    let inflow = 0, outflow = 0, marketValue = 0
    for (const id of recordedIds) {
      inflow += perAccount[id].inflow
      outflow += perAccount[id].outflow
      marketValue += accountValues[id] ?? 0
    }
    const netDeposit = inflow - outflow
    const realProfit = marketValue - netDeposit
    const realRate = inflow > 0 ? realProfit / inflow : null
    return { inflow, outflow, netDeposit, marketValue, realProfit, realRate }
  }, [recordedIds, perAccount, accountValues])

  // 보유는 있지만 원장 미기록인 계좌
  const unrecorded = useMemo(() =>
    accounts.filter(a => (accountValues[a.id] ?? 0) > 0 && !perAccount[a.id]),
    [accounts, accountValues, perAccount]
  )

  const years = useMemo(() =>
    [...new Set(cashflows.map(cf => parseInt(cf.flow_date.slice(0, 4))))].sort((a, b) => b - a),
    [cashflows]
  )

  const filtered = useMemo(() =>
    cashflows.filter(cf =>
      (!accountFilter || cf.account_id === accountFilter) &&
      (!yearFilter || cf.flow_date.startsWith(String(yearFilter)))
    ),
    [cashflows, accountFilter, yearFilter]
  )

  function handleSaved() {
    setShowForm(false)
    setEditItem(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 기록을 삭제하시겠습니까?')) return
    await fetch(`/api/portfolio/cashflows/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  const profitColor = totals.realProfit >= 0 ? '#f43f5e' : '#3b82f6'

  return (
    <div className={layout.page}>
      <PageHeader title="입출금" description="계좌 입출금 원장 — 실제 투입금 대비 실질 수익">
        <button onClick={() => { setEditItem(null); setShowForm(true) }}
          className={btn.primary} style={{ backgroundColor: brand.primary }}>
          + 입출금 기록
        </button>
      </PageHeader>

      {tableMissing ? (
        <div className={`${card.base} p-6 text-center`}>
          <p className="text-sm text-slate-500 font-medium">account_cashflows 테이블이 아직 없습니다</p>
          <p className="text-xs text-slate-400 mt-1.5">
            마이그레이션을 먼저 적용하세요: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">docs/sql/2026-08-14-account-cashflows.sql</code>
          </p>
        </div>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="총 입금" value={formatWonRound(totals.inflow)} color={INFLOW_COLOR} />
            <KpiCard label="총 출금" value={formatWonRound(totals.outflow)} color={OUTFLOW_COLOR} />
            <KpiCard label="순투입" value={formatWonRound(totals.netDeposit)} />
            <KpiCard
              label="실질 수익"
              value={`${totals.realProfit >= 0 ? '+' : ''}${formatWonRound(totals.realProfit)}`}
              sub={totals.realRate != null ? `수익률 ${totals.realRate >= 0 ? '+' : ''}${(totals.realRate * 100).toFixed(1)}% · 평가액 ${formatWonRound(totals.marketValue)}` : undefined}
              color={profitColor}
            />
          </div>

          {/* 계좌별 요약 */}
          {recordedIds.length > 0 ? (
            <div className={`${card.base} overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-600">계좌별 실질 수익</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className={tbl.th}>계좌</th>
                      <th className={tbl.thRight}>입금</th>
                      <th className={tbl.thRight}>출금</th>
                      <th className={tbl.thRight}>순투입</th>
                      <th className={tbl.thRight}>평가액</th>
                      <th className={tbl.thRight}>실질수익</th>
                      <th className={tbl.thRight}>수익률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recordedIds
                      .map(id => {
                        const { inflow, outflow } = perAccount[id]
                        const net = inflow - outflow
                        const mv = accountValues[id] ?? 0
                        const profit = mv - net
                        const rate = inflow > 0 ? profit / inflow : null
                        return { id, inflow, outflow, net, mv, profit, rate }
                      })
                      .sort((a, b) => b.mv - a.mv)
                      .map(r => {
                        const acc = accMap[r.id]
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-5 py-2.5 text-xs font-medium text-slate-700">
                              {acc ? `${acc.broker} · ${acc.name}` : '(삭제된 계좌)'}
                            </td>
                            <td className={tbl.tdRight}>{formatWonRound(r.inflow)}</td>
                            <td className={tbl.tdRight}>{formatWonRound(r.outflow)}</td>
                            <td className={tbl.tdRight}>{formatWonRound(r.net)}</td>
                            <td className={tbl.tdRight}>{formatWonRound(r.mv)}</td>
                            <td className={`px-3 py-2.5 text-xs text-right tabular-nums font-semibold ${r.profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                              {r.profit >= 0 ? '+' : ''}{formatWonRound(r.profit)}
                            </td>
                            <td className={`px-3 py-2.5 text-xs text-right tabular-nums font-semibold ${r.profit >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                              {r.rate != null ? `${r.rate >= 0 ? '+' : ''}${(r.rate * 100).toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
              {unrecorded.length > 0 ? (
                <p className="px-5 py-2.5 text-[10px] text-slate-400 border-t border-slate-50">
                  원장 미기록 계좌 (실질수익 계산에서 제외): {unrecorded.map(a => a.name).join(', ')}
                  — 기초잔액부터 기록하면 포함됩니다
                </p>
              ) : null}
            </div>
          ) : (
            <div className={`${card.base} p-8 text-center`}>
              <p className="text-sm text-slate-400">기록이 없습니다</p>
              <p className="text-xs text-slate-300 mt-1.5">
                계좌마다 <span className="font-medium text-slate-400">기초잔액</span> 1건(현재 평가액)을 먼저 넣고, 이후 입출금만 기록하세요.
              </p>
            </div>
          )}

          {/* 이벤트 목록 */}
          {cashflows.length > 0 ? (
            <div className={`${card.base} overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold text-slate-600 mr-auto">기록 ({filtered.length}건)</p>
                <select value={accountFilter ?? ''} onChange={e => setAccountFilter(e.target.value || null)}
                  className={field.select}>
                  <option value="">전체 계좌</option>
                  {accounts.filter(a => perAccount[a.id]).map(a => (
                    <option key={a.id} value={a.id}>{a.broker} · {a.name}</option>
                  ))}
                </select>
                <select value={yearFilter ?? ''} onChange={e => setYearFilter(e.target.value ? parseInt(e.target.value) : null)}
                  className={field.select}>
                  <option value="">전체 연도</option>
                  {years.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className={tbl.th}>날짜</th>
                      <th className={tbl.th}>계좌</th>
                      <th className={tbl.th}>유형</th>
                      <th className={tbl.thRight}>금액</th>
                      <th className={tbl.th}>메모</th>
                      <th className={tbl.thRight}></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(cf => {
                      const inflow = isInflow(cf.type)
                      return (
                        <tr key={cf.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-3 py-2.5 text-xs text-slate-400 tabular-nums whitespace-nowrap">{cf.flow_date}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">
                            {cf.account ? `${cf.account.broker} · ${cf.account.name}` : accMap[cf.account_id]?.name ?? '—'}
                          </td>
                          <td className="px-3 py-2.5"><TypeBadge type={cf.type} /></td>
                          <td className="px-3 py-2.5 text-xs text-right tabular-nums font-semibold"
                            style={{ color: cf.type === 'opening' ? '#64748b' : inflow ? INFLOW_COLOR : OUTFLOW_COLOR }}>
                            {inflow ? '+' : '−'}{formatWonRound(cf.amount)}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">{cf.memo || '—'}</td>
                          <td className="px-3 py-2.5 text-right whitespace-nowrap">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditItem(cf); setShowForm(true) }} className={btn.icon} title="수정">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDelete(cf.id)} className={btn.danger} title="삭제">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      )}

      {showForm ? (
        <CashflowFormModal
          accounts={accounts}
          editItem={editItem}
          onClose={() => { setShowForm(false); setEditItem(null) }}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}
