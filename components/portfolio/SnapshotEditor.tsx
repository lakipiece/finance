'use client'

import { useState, useMemo } from 'react'
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
}

// 숫자/소수점만 허용하는 input
function NumInput({ value, onChange, placeholder, tabIndex, className }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  tabIndex?: number
  className?: string
}) {
  const [raw, setRaw] = useState<string | null>(null) // null = not focused

  const displayValue = raw !== null
    ? raw
    : (value === null || value === undefined ? '' : String(value))

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9.]/g, '') // 숫자, 소수점만
    setRaw(v)
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

export default function SnapshotEditor({ snapshot, holdings, accounts, securities, accountSecurities }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const secMap = useMemo(() => Object.fromEntries(securities.map(s => [s.id, s])), [securities])
  const accMap = useMemo(() => Object.fromEntries(accounts.map(a => [a.id, a])), [accounts])

  // 모든 account_securities 기준으로 rows 초기화 (기존 holding 있으면 merge)
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

  // 선택된 계좌의 rows (티커순 정렬)
  const selectedRows = useMemo(() =>
    rows
      .filter(r => r.account_id === selectedAccountId)
      .sort((a, b) => (secMap[a.security_id]?.ticker ?? '').localeCompare(secMap[b.security_id]?.ticker ?? '')),
    [rows, selectedAccountId, secMap]
  )

  function updateRow(account_id: string, security_id: string, field: 'quantity' | 'avg_price', value: number | null) {
    setRows(prev => prev.map(r =>
      r.account_id === account_id && r.security_id === security_id
        ? { ...r, [field]: field === 'quantity' ? (value ?? 0) : value }
        : r
    ))
  }

  function getRow(account_id: string, security_id: string) {
    return rows.find(r => r.account_id === account_id && r.security_id === security_id)
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      // quantity > 0인 rows만 저장 (0이면 스킵)
      const toSave = rows.filter(r => r.quantity > 0)
      await Promise.all(toSave.map(row =>
        fetch('/api/portfolio/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...row,
            total_invested: row.quantity != null && row.avg_price != null
              ? row.quantity * row.avg_price
              : null,
            snapshot_id: snapshot.id,
            snapshot_date: snapshot.date,
          }),
        })
      ))
      setMsg('저장 완료')
      router.refresh()
    } catch {
      setMsg('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'

  // 계좌별 총 보유 종목 수
  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of rows) {
      if (r.quantity > 0) counts[r.account_id] = (counts[r.account_id] ?? 0) + 1
    }
    return counts
  }, [rows])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={() => router.push('/portfolio/snapshots')}
            className="text-xs text-slate-400 hover:text-slate-600 mb-1">← 목록</button>
          <h2 className="text-base font-semibold text-slate-700">스냅샷 편집 — {snapshot.date}</h2>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        {/* Left: account tabs */}
        <div className="w-40 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">계좌</p>
          {accounts.map(a => {
            const isSelected = selectedAccountId === a.id
            const count = accountCounts[a.id] ?? 0
            const total = accountSecurities.filter(as => as.account_id === a.id).length
            return (
              <div key={a.id} onClick={() => setSelectedAccountId(a.id)}
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
              </div>
            )
          })}
        </div>

        {/* Right: all linked securities as cards */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-600">
              {accMap[selectedAccountId]?.broker} · {accMap[selectedAccountId]?.name}
            </p>
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
                const totalInvested = currentRow.quantity && currentRow.avg_price != null
                  ? currentRow.quantity * currentRow.avg_price
                  : null
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
                        <p className="text-[9px] text-slate-400 mb-0.5">평균매수가({isKrw ? 'KRW' : currency})</p>
                        <NumInput
                          value={currentRow.avg_price}
                          onChange={v => updateRow(row.account_id, row.security_id, 'avg_price', v)}
                          placeholder="0"
                          tabIndex={avgTabIdx}
                          className={inputCls}
                        />
                      </div>
                    </div>

                    {/* 원금 (자동계산) */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <p className="text-[9px] text-slate-400">원금</p>
                      <p className="text-xs font-medium text-slate-500">
                        {totalInvested != null
                          ? isKrw
                            ? `${Math.round(totalInvested).toLocaleString()}원`
                            : `${currency} ${totalInvested.toFixed(2)}`
                          : '—'}
                      </p>
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
