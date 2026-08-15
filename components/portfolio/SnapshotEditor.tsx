'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import DateInput from '@/components/ui/DateInput'

interface HoldingRow {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  orphaned?: boolean
}

interface AccountSecurity { account_id: string; security_id: string }

/** 계좌별 날짜별 입출금 합계 (오름차순 정렬 전제) */
interface AccountCashflowEvent { account_id: string; date: string; inflow: number; outflow: number }

interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
  typeColors?: Record<string, string>
  sectorColors?: Record<string, string>
  cashflowEvents?: AccountCashflowEvent[]
}

function formatWithCommas(v: number | null): string {
  if (v === null || v === undefined) return ''
  const str = v.toString()
  const [int, dec] = str.split('.')
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return dec !== undefined ? `${formatted}.${dec}` : formatted
}

function NumInput({ value, onChange, placeholder, tabIndex, className }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  tabIndex?: number
  className?: string
}) {
  const [raw, setRaw] = useState<string | null>(null)
  const displayValue = raw !== null ? raw : formatWithCommas(value)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRaw(e.target.value.replace(/[^0-9.]/g, ''))
  }
  function handleBlur() {
    const n = raw !== null ? parseFloat(raw) : NaN
    onChange(isNaN(n) ? null : n)
    setRaw(null)
  }
  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    setRaw(value !== null && value !== undefined ? String(value) : '')
    const target = e.target
    setTimeout(() => target.select(), 0)
  }

  return (
    <input type="text" inputMode="decimal" value={displayValue}
      placeholder={placeholder ?? '0'} tabIndex={tabIndex}
      onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur}
      className={className} />
  )
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities, accountSecurities, typeColors = {}, sectorColors = {}, cashflowEvents = [] }: Props) {
  const router = useRouter()
  const { palette } = useTheme()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [snapshotDate, setSnapshotDate] = useState(snapshot.date)
  const [isDirty, setIsDirty] = useState(false)
  const [secPrices, setSecPrices] = useState<Record<string, number>>({})
  const [exchangeRate, setExchangeRate] = useState<number>(1350)

  const [modalAccountId, setModalAccountId] = useState<string | null>(null)
  const [showDirtyAlert, setShowDirtyAlert] = useState(false)

  const secMap = useMemo(() => Object.fromEntries(securities.map(s => [s.id, s])), [securities])
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  const [rows, setRows] = useState<HoldingRow[]>(() => {
    const holdingMap = new Map(holdings.map(h => [`${h.account_id}__${h.security_id}`, h]))
    const asKeys = new Set(accountSecurities.map(as => `${as.account_id}__${as.security_id}`))

    // 현재 account_securities 기반 rows
    const fromLinks = accountSecurities.map(as => {
      const existing = holdingMap.get(`${as.account_id}__${as.security_id}`)
      return {
        account_id: as.account_id,
        security_id: as.security_id,
        quantity: existing ? Number(existing.quantity) : 0,
        avg_price: existing?.avg_price != null ? Number(existing.avg_price) : null,
        id: existing?.id,
        orphaned: false,
      }
    })

    // 연결 해제됐지만 holding 데이터가 남아있는 종목 (데이터 있는 것만)
    const orphaned = holdings
      .filter(h => !asKeys.has(`${h.account_id}__${h.security_id}`) && (Number(h.quantity) > 0 || h.avg_price != null))
      .map(h => ({
        account_id: h.account_id,
        security_id: h.security_id,
        quantity: Number(h.quantity),
        avg_price: h.avg_price != null ? Number(h.avg_price) : null,
        id: h.id,
        orphaned: true,
      }))

    return [...fromLinks, ...orphaned]
  })

  const selectedRows = useMemo(() =>
    rows
      .filter(r => r.account_id === modalAccountId)
      .sort((a, b) => {
        const valA = a.quantity * (secPrices[a.security_id] ?? 0)
        const valB = b.quantity * (secPrices[b.security_id] ?? 0)
        if (valB !== valA) return valB - valA
        return (secMap[a.security_id]?.ticker ?? '').localeCompare(secMap[b.security_id]?.ticker ?? '')
      }),
    [rows, modalAccountId, secMap, secPrices]
  )

  const lastTabIndex = selectedRows.length * 2
  const saveButtonTabIndex = lastTabIndex + 1

  const fetchPrices = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/portfolio/prices-at?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setSecPrices(data.secPrices ?? {})
        setExchangeRate(data.exchangeRate ?? 1350)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { fetchPrices(snapshotDate) }, [snapshotDate, fetchPrices])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  function updateRow(account_id: string, security_id: string, field: 'quantity' | 'avg_price', value: number | null) {
    setRows(prev => prev.map(r =>
      r.account_id === account_id && r.security_id === security_id
        ? { ...r, [field]: field === 'quantity' ? (value ?? 0) : value }
        : r
    ))
    setIsDirty(true)
  }

  function getRow(account_id: string, security_id: string) {
    return rows.find(r => r.account_id === account_id && r.security_id === security_id)!
  }

  async function deleteHolding(account_id: string, security_id: string) {
    if (!confirm('이 종목의 수량과 금액을 모두 삭제하시겠습니까?')) return
    const row = getRow(account_id, security_id)
    if (row?.id) {
      await fetch(`/api/portfolio/holdings/${row.id}`, { method: 'DELETE' })
    }
    setRows(prev => prev.filter(r => !(r.account_id === account_id && r.security_id === security_id)))
  }

  function handleBack() {
    if (isDirty && !confirm('저장하지 않은 내용이 있습니다. 저장 없이 나가시겠습니까?')) return
    router.push('/portfolio/snapshots')
  }

  async function handleSave(): Promise<boolean> {
    setSaving(true)
    setMsg('')
    try {
      if (snapshotDate !== snapshot.date) {
        const dateRes = await fetch(`/api/portfolio/snapshots/${snapshot.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: snapshotDate }),
        })
        if (!dateRes.ok) throw new Error('date update failed')
      }
      const toSave = rows.filter(r => r.quantity > 0)
      await Promise.all(toSave.map(row =>
        fetch('/api/portfolio/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...row,
            total_invested: row.quantity != null && row.avg_price != null ? row.quantity * row.avg_price : null,
            snapshot_id: snapshot.id,
            snapshot_date: snapshotDate,
          }),
        })
      ))
      setMsg('저장 완료')
      setIsDirty(false)
      router.refresh()
      return true
    } catch {
      setMsg('저장 실패')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleModalSave() {
    const ok = await handleSave()
    if (ok) setModalAccountId(null)
  }

  function handleModalClose() {
    if (isDirty) { setShowDirtyAlert(true) } else { setModalAccountId(null) }
  }

  const inputCls = 'w-full rounded-field bg-surface-low border-0 px-3 py-[9px] text-subhead text-ink text-right focus:outline-none focus:bg-surface-card focus:shadow-focus transition-colors'

  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      if (r.quantity > 0) counts[r.account_id] = (counts[r.account_id] ?? 0) + 1
    }
    return counts
  }, [rows])

  const accountValues = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const r of rows) {
      if (r.quantity > 0) {
        const price = secPrices[r.security_id] ?? 0
        vals[r.account_id] = (vals[r.account_id] ?? 0) + r.quantity * price
      }
    }
    return vals
  }, [rows, secPrices])

  const totalValue = useMemo(() => Object.values(accountValues).reduce((a, b) => a + b, 0), [accountValues])

  const accountInvested = useMemo(() => {
    const vals: Record<string, number> = {}
    for (const r of rows) {
      if (r.quantity > 0 && r.avg_price != null) {
        const sec = secMap[r.security_id]
        const isKrw = !sec || sec.currency === 'KRW' || sec.country === '국내'
        const priceKrw = isKrw ? r.avg_price : r.avg_price * exchangeRate
        vals[r.account_id] = (vals[r.account_id] ?? 0) + r.quantity * priceKrw
      }
    }
    return vals
  }, [rows, secMap, exchangeRate])

  const totalInvested = useMemo(() =>
    Object.values(accountInvested).reduce((a, b) => a + b, 0),
    [accountInvested]
  )

  // 스냅샷 날짜 기준 계좌별 누적 입금/출금 (입출금 원장)
  const cfAt = useMemo(() => {
    const map: Record<string, { inflow: number; outflow: number }> = {}
    for (const e of cashflowEvents) {
      if (e.date > snapshotDate) continue
      const m = (map[e.account_id] ??= { inflow: 0, outflow: 0 })
      m.inflow += e.inflow
      m.outflow += e.outflow
    }
    // 입금이 0이면 원장 미기록으로 취급
    for (const id of Object.keys(map)) {
      if (map[id].inflow <= 0) delete map[id]
    }
    return map
  }, [cashflowEvents, snapshotDate])

  /**
   * 계좌별 지표 (원장 있으면 누적입금 기준, 없으면 평균매수금액으로 폴백)
   *   투자원금 = 누적입금 | 평균매수금액
   *   수익     = 평가금액 + 누적출금 − 누적입금 | 평가금액 − 평균매수금액
   */
  const accountMetrics = useMemo(() => {
    const out: Record<string, { basis: number; profit: number; rate: number | null; hasLedger: boolean }> = {}
    const ids = new Set([...Object.keys(accountValues), ...Object.keys(accountInvested), ...Object.keys(cfAt)])
    for (const id of ids) {
      const value = accountValues[id] ?? 0
      const cf = cfAt[id]
      if (cf) {
        const profit = value + cf.outflow - cf.inflow
        out[id] = { basis: cf.inflow, profit, rate: cf.inflow > 0 ? profit / cf.inflow : null, hasLedger: true }
      } else {
        const cost = accountInvested[id] ?? 0
        const profit = value - cost
        out[id] = { basis: cost, profit, rate: cost > 0 ? profit / cost : null, hasLedger: false }
      }
    }
    return out
  }, [accountValues, accountInvested, cfAt])

  const totalMetrics = useMemo(() => {
    let basis = 0, profit = 0, hasLedger = false
    for (const m of Object.values(accountMetrics)) {
      basis += m.basis
      profit += m.profit
      if (m.hasLedger) hasLedger = true
    }
    return { basis, profit, rate: basis > 0 ? profit / basis : null, hasLedger }
  }, [accountMetrics])

  const modalAccount = accMap[modalAccountId ?? '']
  const modalAccountValue = accountValues[modalAccountId ?? ''] ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={handleBack} className="text-body text-ink-4 hover:text-ink-2 mb-1">← 목록</button>
          <div className="flex items-center gap-2.5">
            <h2 className="text-heading font-bold" style={{ color: '#1A237E' }}>스냅샷 편집</h2>
            <span className="text-ink-5 text-subhead">—</span>
            <DateInput
              value={snapshotDate}
              onChange={v => { setSnapshotDate(v); setIsDirty(true) }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-gain' : 'text-income'}`}>{msg}</span>}
          {isDirty && !msg && <span className="text-body text-warning">미저장</span>}
          {totalValue > 0 && (
            <div className="text-right leading-tight">
              <p className="text-micro tracking-normal text-ink-4 tabular-nums"
                title={totalMetrics.hasLedger ? '투자원금 (누적입금, 미기록 계좌는 평균매수금액)' : '평균매수금액 합계'}>
                투자원금 {Math.round(totalMetrics.basis).toLocaleString()}원
              </p>
              <p className="text-subhead font-bold text-ink tabular-nums">
                평가금액 {Math.round(totalValue).toLocaleString()}원
              </p>
              <p className={`text-[11px] font-medium tabular-nums ${totalMetrics.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                수익 {totalMetrics.profit >= 0 ? '+' : ''}{Math.round(totalMetrics.profit).toLocaleString()}원
                {totalMetrics.rate != null ? ` (${totalMetrics.rate >= 0 ? '+' : ''}${(totalMetrics.rate * 100).toFixed(1)}%)` : ''}
              </p>
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            className="text-white px-4 py-2 rounded-btn text-body font-medium hover:opacity-90 transition-opacity"
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Account Card Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {accounts.map(a => {
          const count = accountCounts[a.id] ?? 0
          const total = accountSecurities.filter(as => as.account_id === a.id).length
          const aVal = accountValues[a.id] ?? 0
          const typeColor = typeColors[a.type ?? ''] ?? null
          return (
            <div key={a.id}
              className="flex bg-surface-card rounded-card overflow-hidden hover:shadow-card transition-all min-h-[110px]">
              {/* 왼쪽 색상 바 */}
              <div className="w-1.5 shrink-0 rounded-l-2xl"
                style={{ backgroundColor: typeColor ?? '#e9ecf2' }} />
              {/* 카드 내용 */}
              <div onClick={() => setModalAccountId(a.id)} className="flex-1 p-3 cursor-pointer flex flex-col min-w-0">
                {/* 이름 + 뱃지 */}
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-subhead font-bold text-ink leading-tight flex-1 min-w-0">{a.name}</p>
                  {a.type && typeColor && (
                    <span className="text-micro tracking-normal px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ backgroundColor: typeColor + '20', color: typeColor }}>
                      {a.type}
                    </span>
                  )}
                </div>
                <p className="text-body text-ink-4">{a.broker}</p>
                {/* 하단: 종목수 + 투자원금/평가금액/수익 */}
                <div className="mt-auto pt-2 space-y-0.5">
                  <p className="text-micro tracking-normal text-ink-4">
                    <span className="font-medium text-ink-2 text-micro tracking-normal">{count}</span>종목
                  </p>
                  {aVal > 0 ? (() => {
                    const m = accountMetrics[a.id]
                    return (
                      <>
                        <div className="flex justify-between text-micro tracking-normal tabular-nums">
                          <span className="text-ink-4"
                            title={m?.hasLedger ? '투자원금 (누적입금)' : '평균매수금액 (원장 미기록)'}>
                            {Math.round(m?.basis ?? 0).toLocaleString()}원
                          </span>
                          <span className="text-ink-2 font-medium">평가금액 {Math.round(aVal).toLocaleString()}원</span>
                        </div>
                        {m != null ? (
                          <div className={`text-right text-[10px] font-medium tabular-nums ${m.profit >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {m.hasLedger ? '수익' : '평익'} {m.profit >= 0 ? '+' : ''}{Math.round(m.profit).toLocaleString()}원
                            {m.rate != null ? ` (${m.rate >= 0 ? '+' : ''}${(m.rate * 100).toFixed(1)}%)` : ''}
                          </div>
                        ) : null}
                      </>
                    )
                  })() : (
                    <p className="text-body text-ink-5">—</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Account Modal */}
      {modalAccountId && createPortal(
        <div className="modal-scrim fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-card w-full max-w-5xl flex flex-col shadow-dialog"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-[18px] py-[15px] border-b border-surface-low shrink-0">
              <div>
                <p className="font-bold text-ink text-heading leading-tight">{modalAccount?.name}</p>
                {modalAccount?.broker && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-micro tracking-normal text-ink-4 bg-surface-low">{modalAccount.broker}</span>
                )}
                {modalAccountValue > 0 ? (() => {
                  const id = modalAccountId ?? ''
                  const cf = cfAt[id]
                  const cost = accountInvested[id] ?? 0
                  const pnl = modalAccountValue - cost           // 평가손익 (평가금액 − 평균매수금액)
                  const m = accountMetrics[id]
                  const row = (label: string, val: string, cls = 'text-ink-2') => (
                    <div className="flex items-center justify-between gap-6 text-body">
                      <span className="text-ink-4 shrink-0">{label}</span>
                      <span className={`font-medium tabular-nums ${cls}`}>{val}</span>
                    </div>
                  )
                  const signed = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v).toLocaleString()}원`
                  const pct = (v: number, base: number) => base > 0 ? ` (${v >= 0 ? '+' : ''}${(v / base * 100).toFixed(1)}%)` : ''
                  return (
                    <div className="mt-2 space-y-0.5 min-w-[200px]">
                      {cf
                        ? row('투자원금 (누적입금)', `${Math.round(cf.inflow).toLocaleString()}원`)
                        : row('투자원금 (매수원가 기준)', `${Math.round(cost).toLocaleString()}원`)}
                      {cf && cf.outflow > 0 ? row('누적출금', `${Math.round(cf.outflow).toLocaleString()}원`) : null}
                      {cf ? row('평균매수금액', `${Math.round(cost).toLocaleString()}원`) : null}
                      {row('평가금액', `${Math.round(modalAccountValue).toLocaleString()}원`, 'text-ink font-medium')}
                      {cost > 0
                        ? row('평가손익', signed(pnl) + pct(pnl, cost), pnl >= 0 ? 'text-gain' : 'text-loss')
                        : null}
                      {cf && m != null
                        ? row('수익금액', signed(m.profit) + pct(m.profit, cf.inflow), m.profit >= 0 ? 'text-gain' : 'text-loss')
                        : null}
                    </div>
                  )
                })() : null}
              </div>
              <div className="flex items-center gap-2">
                {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-gain' : 'text-income'}`}>{msg}</span>}
                {isDirty && !msg && <span className="text-body text-warning">미저장</span>}
                <button onClick={handleModalSave} disabled={saving} tabIndex={saveButtonTabIndex}
                  className="text-white px-3 py-1.5 rounded-btn text-body font-medium hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: palette.colors[0] }}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button onClick={handleModalClose}
                  className="p-1.5 rounded-btn hover:bg-surface-low text-ink-4 hover:text-ink-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              {selectedRows.length === 0 ? (
                <div className="text-center py-12 text-subhead text-ink-4">
                  연결된 종목이 없습니다 — 계좌 관리에서 종목을 연결해주세요
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {selectedRows.map((row, idx) => {
                    const sec = secMap[row.security_id]
                    if (!sec) return null
                    const currency = sec.currency ?? 'KRW'
                    const isKrw = currency === 'KRW'
                    const currentRow = getRow(row.account_id, row.security_id)
                    const totalPurchased = currentRow.quantity && currentRow.avg_price != null
                      ? currentRow.quantity * currentRow.avg_price : null
                    const marketPrice = secPrices[row.security_id] ?? 0
                    const marketValue = currentRow.quantity > 0 && marketPrice > 0
                      ? currentRow.quantity * marketPrice : null
                    const qtyTabIdx = idx * 2 + 1
                    const avgTabIdx = idx * 2 + 2

                    return (
                      <div key={`${row.account_id}__${row.security_id}`}
                        className={`group rounded-xl border p-3 transition-all ${
                          currentRow.quantity > 0
                            ? row.orphaned ? 'border-orange-200 bg-orange-50/30' : 'border-surface-low bg-surface-card'
                            : 'border-surface-low bg-surface-card opacity-60'
                        }`}>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          {(() => {
                            const color = sec.sector ? sectorColors[sec.sector] : null
                            return (
                              <span
                                className="text-micro tracking-normal px-1.5 py-0.5 rounded font-mono"
                                style={color
                                  ? { backgroundColor: color + '22', color }
                                  : { backgroundColor: '#f1f5f9', color: '#8794a8' }}>
                                {sec.ticker}
                              </span>
                            )
                          })()}
                          <span className="text-body text-ink-2 truncate font-medium flex-1">{sec.name}</span>
                          {row.orphaned && (
                            <span className="text-micro tracking-normal bg-orange-100 text-warning px-1.5 py-0.5 rounded-full shrink-0">연결해제</span>
                          )}
                          <button
                            onClick={() => deleteHolding(row.account_id, row.security_id)}
                            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-gain/10 text-ink-5 hover:text-gain transition-all shrink-0"
                            title="홀딩 삭제">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <p className="text-micro tracking-normal text-ink-4 mb-0.5">수량</p>
                            <NumInput value={currentRow.quantity || null}
                              onChange={v => updateRow(row.account_id, row.security_id, 'quantity', v)}
                              placeholder="0" tabIndex={qtyTabIdx} className={inputCls} />
                          </div>
                          <div>
                            <p className="text-micro tracking-normal text-ink-4 mb-0.5">평균매수단가({isKrw ? 'KRW' : currency})</p>
                            <NumInput value={currentRow.avg_price}
                              onChange={v => updateRow(row.account_id, row.security_id, 'avg_price', v)}
                              placeholder="0" tabIndex={avgTabIdx} className={inputCls} />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-surface-low space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-micro tracking-normal text-ink-4">총 매수금액</p>
                            <p className="text-body font-medium text-ink-3">
                              {totalPurchased != null
                                ? isKrw ? `${Math.round(totalPurchased).toLocaleString()}원` : `${currency} ${totalPurchased.toFixed(2)}`
                                : '—'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-micro tracking-normal text-ink-4">평가금액</p>
                            <p className={`text-xs font-medium ${marketValue != null ? 'text-ink-2' : 'text-ink-5'}`}>
                              {marketValue != null ? `${Math.round(marketValue).toLocaleString()}원` : '—'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dirty Alert */}
      {showDirtyAlert && createPortal(
        <div className="modal-scrim fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="bg-surface-card rounded-card p-[13px] shadow-dialog max-w-sm w-full">
            <p className="text-subhead font-medium text-ink">저장하지 않은 변경사항</p>
            <p className="text-body text-ink-3 mt-1.5">수정한 내용이 저장되지 않았습니다.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDirtyAlert(false)}
                className="flex-1 text-white px-4 py-2 rounded-btn text-body font-medium hover:opacity-90 transition-opacity"
                style={{ backgroundColor: palette.colors[0] }}>
                계속 편집
              </button>
              <button onClick={() => { setShowDirtyAlert(false); setModalAccountId(null) }}
                className="flex-1 text-ink-3 px-4 py-2 rounded-btn text-body hover:bg-surface-low">
                저장안함
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
