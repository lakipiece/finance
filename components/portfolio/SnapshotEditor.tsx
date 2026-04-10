'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'

interface HoldingRow {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
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
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder={placeholder ?? '0'}
      tabIndex={tabIndex}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  )
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities, accountSecurities, typeColors = {} }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [snapshotDate, setSnapshotDate] = useState(snapshot.date)
  const [isDirty, setIsDirty] = useState(false)
  // security_id → KRW 환산 가격
  const [secPrices, setSecPrices] = useState<Record<string, number>>({})

  const secMap = useMemo(() => Object.fromEntries(securities.map(s => [s.id, s])), [securities])
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  const [rows, setRows] = useState<HoldingRow[]>(() => {
    const holdingMap = new Map(holdings.map(h => [`${h.account_id}__${h.security_id}`, h]))
    return accountSecurities.map(as => {
      const existing = holdingMap.get(`${as.account_id}__${as.security_id}`)
      return {
        account_id: as.account_id,
        security_id: as.security_id,
        quantity: existing ? Number(existing.quantity) : 0,
        avg_price: existing?.avg_price != null ? Number(existing.avg_price) : null,
        id: existing?.id,
      }
    })
  })

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '')

  const selectedRows = useMemo(() =>
    rows
      .filter(r => r.account_id === selectedAccountId)
      .sort((a, b) => (secMap[a.security_id]?.ticker ?? '').localeCompare(secMap[b.security_id]?.ticker ?? '')),
    [rows, selectedAccountId, secMap]
  )

  const lastTabIndex = selectedRows.length * 2
  const saveButtonTabIndex = lastTabIndex + 1

  // 날짜 기준 가격 조회
  const fetchPrices = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/portfolio/prices-at?date=${date}`)
      if (res.ok) {
        const data = await res.json()
        setSecPrices(data.secPrices ?? {})
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchPrices(snapshotDate)
  }, [snapshotDate, fetchPrices])

  // 페이지 이탈 경고
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
    return rows.find(r => r.account_id === account_id && r.security_id === security_id)
  }

  function handleBack() {
    if (isDirty && !confirm('저장하지 않은 내용이 있습니다. 저장 없이 나가시겠습니까?')) return
    router.push('/portfolio/snapshots')
  }

  async function handleSave() {
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
            total_invested: row.quantity != null && row.avg_price != null
              ? row.quantity * row.avg_price : null,
            snapshot_id: snapshot.id,
            snapshot_date: snapshotDate,
          }),
        })
      ))
      setMsg('저장 완료')
      setIsDirty(false)
      router.refresh()
    } catch {
      setMsg('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 text-right focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'

  // 계좌별 수량 보유 종목 수
  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      if (r.quantity > 0) counts[r.account_id] = (counts[r.account_id] ?? 0) + 1
    }
    return counts
  }, [rows])

  // 계좌별 평가금액
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

  const totalValue = useMemo(() =>
    Object.values(accountValues).reduce((a, b) => a + b, 0),
    [accountValues]
  )

  // 선택 계좌 평가금액
  const selectedAccountValue = accountValues[selectedAccountId] ?? 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <button onClick={handleBack}
            className="text-xs text-slate-400 hover:text-slate-600 mb-1">← 목록</button>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-700">스냅샷 편집</h2>
            <input
              type="date"
              value={snapshotDate}
              onChange={e => { setSnapshotDate(e.target.value); setIsDirty(true) }}
              className="border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          {isDirty && !msg && <span className="text-xs text-amber-500">미저장</span>}
          <button onClick={handleSave} disabled={saving} tabIndex={saveButtonTabIndex}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 전체 합계 */}
      <div className="bg-slate-50 rounded-xl border border-slate-100 px-4 py-3 mb-5 flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium">전체 평가금액</p>
        <p className="text-base font-semibold text-slate-700">
          {totalValue > 0 ? `${Math.round(totalValue).toLocaleString()}원` : '—'}
        </p>
      </div>

      <div className="flex gap-4 items-start">
        {/* Left: account tabs */}
        <div className="w-44 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">계좌</p>
          {accounts.map(a => {
            const isSelected = selectedAccountId === a.id
            const count = accountCounts[a.id] ?? 0
            const total = accountSecurities.filter(as => as.account_id === a.id).length
            const aVal = accountValues[a.id] ?? 0
            const typeColor = typeColors[a.type ?? ''] ?? null
            return (
              <div key={a.id} onClick={() => setSelectedAccountId(a.id)}
                style={!isSelected && typeColor ? { borderLeftColor: typeColor, borderLeftWidth: '3px' } : undefined}
                className={`rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                  isSelected ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                      {a.name}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>{a.broker}</p>
                  </div>
                  <span className={`text-[9px] shrink-0 ml-1 mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-300'}`}>
                    {count}/{total}
                  </span>
                </div>
                {aVal > 0 && (
                  <p className={`text-[10px] mt-1 font-medium tabular-nums ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
                    {Math.round(aVal).toLocaleString()}원
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: securities */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-600">
                {accMap[selectedAccountId]?.broker} · {accMap[selectedAccountId]?.name}
              </p>
              {selectedAccountValue > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">
                  평가금액 <span className="font-medium text-slate-600">{Math.round(selectedAccountValue).toLocaleString()}원</span>
                </p>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Tab으로 순서대로 입력</span>
          </div>

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
                const currentRow = getRow(row.account_id, row.security_id)!
                const totalPurchased = currentRow.quantity && currentRow.avg_price != null
                  ? currentRow.quantity * currentRow.avg_price : null
                const marketPrice = secPrices[row.security_id] ?? 0
                const marketValue = currentRow.quantity > 0 && marketPrice > 0
                  ? currentRow.quantity * marketPrice : null
                const qtyTabIdx = idx * 2 + 1
                const avgTabIdx = idx * 2 + 2

                return (
                  <div key={row.security_id}
                    className={`bg-white rounded-xl border p-3 transition-all ${
                      currentRow.quantity > 0 ? 'border-slate-200' : 'border-slate-100 opacity-60'
                    }`}>
                    {/* 종목 헤더 */}
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-mono">{sec.ticker}</span>
                      <span className="text-xs text-slate-600 truncate font-medium">{sec.name}</span>
                    </div>

                    {/* 입력 */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <p className="text-[9px] text-slate-400 mb-0.5">수량</p>
                        <NumInput
                          value={currentRow.quantity || null}
                          onChange={v => updateRow(row.account_id, row.security_id, 'quantity', v)}
                          placeholder="0"
                          tabIndex={qtyTabIdx}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 mb-0.5">평균매수단가({isKrw ? 'KRW' : currency})</p>
                        <NumInput
                          value={currentRow.avg_price}
                          onChange={v => updateRow(row.account_id, row.security_id, 'avg_price', v)}
                          placeholder="0"
                          tabIndex={avgTabIdx}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* 총 매수금액 / 평가금액 */}
                    <div className="pt-2 border-t border-slate-50 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-slate-400">총 매수금액</p>
                        <p className="text-xs font-medium text-slate-500">
                          {totalPurchased != null
                            ? isKrw
                              ? `${Math.round(totalPurchased).toLocaleString()}원`
                              : `${currency} ${totalPurchased.toFixed(2)}`
                            : '—'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-slate-400">평가금액</p>
                        <p className={`text-xs font-medium ${marketValue != null ? 'text-slate-600' : 'text-slate-300'}`}>
                          {marketValue != null
                            ? `${Math.round(marketValue).toLocaleString()}원`
                            : '—'}
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
    </div>
  )
}
