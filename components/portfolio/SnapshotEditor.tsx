'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'

interface HoldingRow {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  orphaned?: boolean
}

interface AccountSecurity { account_id: string; security_id: string }

interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
  typeColors?: Record<string, string>
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
    e.target.select()
  }

  return (
    <input type="text" inputMode="decimal" value={displayValue}
      placeholder={placeholder ?? '0'} tabIndex={tabIndex}
      onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur}
      className={className} />
  )
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities, accountSecurities, typeColors = {} }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [snapshotDate, setSnapshotDate] = useState(snapshot.date)
  const [isDirty, setIsDirty] = useState(false)
  const [secPrices, setSecPrices] = useState<Record<string, number>>({})

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
      .sort((a, b) => (secMap[a.security_id]?.ticker ?? '').localeCompare(secMap[b.security_id]?.ticker ?? '')),
    [rows, modalAccountId, secMap]
  )

  const lastTabIndex = selectedRows.length * 2
  const saveButtonTabIndex = lastTabIndex + 1

  const fetchPrices = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/portfolio/prices-at?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setSecPrices(data.secPrices ?? {})
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

  const inputCls = 'w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 text-right focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'

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

  const modalAccount = accMap[modalAccountId ?? '']
  const modalAccountValue = accountValues[modalAccountId ?? ''] ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={handleBack} className="text-xs text-slate-400 hover:text-slate-600 mb-1">← 목록</button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-700">스냅샷 편집</h2>
            <input type="date" value={snapshotDate}
              onChange={e => { setSnapshotDate(e.target.value); setIsDirty(true) }}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          {isDirty && !msg && <span className="text-xs text-amber-500">미저장</span>}
          {totalValue > 0 && (
            <span className="text-sm font-semibold text-slate-600 tabular-nums">
              {Math.round(totalValue).toLocaleString()}원
            </span>
          )}
          <button onClick={handleSave} disabled={saving}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
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
              className="flex bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-md transition-all min-h-[110px]">
              {/* 왼쪽 색상 바 */}
              <div className="w-1.5 shrink-0 rounded-l-2xl"
                style={{ backgroundColor: typeColor ?? '#e2e8f0' }} />
              {/* 카드 내용 */}
              <div onClick={() => setModalAccountId(a.id)} className="flex-1 p-3 cursor-pointer flex flex-col min-w-0">
                {/* 이름 + 뱃지 */}
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <p className="text-sm font-bold text-slate-800 leading-tight flex-1 min-w-0">{a.name}</p>
                  {a.type && typeColor && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{ backgroundColor: typeColor + '20', color: typeColor }}>
                      {a.type}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{a.broker}</p>
                {/* 하단: 종목수(좌) + 평가금액(우) */}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <p className="text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-600">{count}</span>/{total}종목
                  </p>
                  {aVal > 0 ? (
                    <p className="text-xs font-medium text-slate-600 tabular-nums">
                      {Math.round(aVal).toLocaleString()}원
                    </p>
                  ) : (
                    <p className="text-xs text-slate-300">—</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Account Modal */}
      {modalAccountId && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4"
          onClick={handleModalClose}>
          <div className="bg-white rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
              <div>
                <p className="font-semibold text-slate-700">
                  {modalAccount?.broker} · {modalAccount?.name}
                </p>
                {modalAccountValue > 0 && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    평가금액 <span className="font-medium text-slate-600">{Math.round(modalAccountValue).toLocaleString()}원</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
                {isDirty && !msg && <span className="text-xs text-amber-500">미저장</span>}
                <span className="text-[10px] text-slate-400">Tab으로 순서대로 입력</span>
                <button onClick={handleModalSave} disabled={saving} tabIndex={saveButtonTabIndex}
                  className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
                  {saving ? '저장 중...' : '저장하기'}
                </button>
                <button onClick={handleModalClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 min-h-0">
              {selectedRows.length === 0 ? (
                <div className="text-center py-12 text-sm text-slate-400">
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
                        className={`rounded-xl border p-3 transition-all ${
                          currentRow.quantity > 0
                            ? row.orphaned ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200 bg-white'
                            : 'border-slate-100 bg-white opacity-60'
                        }`}>
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <span className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-mono">{sec.ticker}</span>
                          <span className="text-xs text-slate-600 truncate font-medium flex-1">{sec.name}</span>
                          {row.orphaned && (
                            <span className="text-[9px] bg-orange-100 text-orange-500 px-1.5 py-0.5 rounded-full shrink-0">연결해제</span>
                          )}
                          <button
                            onClick={() => deleteHolding(row.account_id, row.security_id)}
                            className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors shrink-0"
                            title="홀딩 삭제">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <p className="text-[9px] text-slate-400 mb-0.5">수량</p>
                            <NumInput value={currentRow.quantity || null}
                              onChange={v => updateRow(row.account_id, row.security_id, 'quantity', v)}
                              placeholder="0" tabIndex={qtyTabIdx} className={inputCls} />
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-400 mb-0.5">평균매수단가({isKrw ? 'KRW' : currency})</p>
                            <NumInput value={currentRow.avg_price}
                              onChange={v => updateRow(row.account_id, row.security_id, 'avg_price', v)}
                              placeholder="0" tabIndex={avgTabIdx} className={inputCls} />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-slate-50 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-slate-400">총 매수금액</p>
                            <p className="text-xs font-medium text-slate-500">
                              {totalPurchased != null
                                ? isKrw ? `${Math.round(totalPurchased).toLocaleString()}원` : `${currency} ${totalPurchased.toFixed(2)}`
                                : '—'}
                            </p>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] text-slate-400">평가금액</p>
                            <p className={`text-xs font-medium ${marketValue != null ? 'text-slate-600' : 'text-slate-300'}`}>
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
        <div className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full">
            <p className="text-sm font-semibold text-slate-800">저장하지 않은 변경사항</p>
            <p className="text-xs text-slate-500 mt-1.5">수정한 내용이 저장되지 않았습니다.</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDirtyAlert(false)}
                className="flex-1 bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800">
                계속 편집
              </button>
              <button onClick={() => { setShowDirtyAlert(false); setModalAccountId(null) }}
                className="flex-1 text-slate-500 px-4 py-2 rounded-lg text-xs hover:bg-slate-100 border border-slate-200">
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
