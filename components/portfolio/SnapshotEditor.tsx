'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Snapshot, Account, Security } from '@/lib/portfolio/types'

interface HoldingRow {
  id?: string
  account_id: string
  security_id: string
  quantity: number
  avg_price: number | null
  total_invested: number | null
}

interface AccountSecurity { account_id: string; security_id: string }

interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
  accountSecurities: AccountSecurity[]
}

function fmt(val: number | null): string {
  if (val === null || val === undefined) return ''
  return val.toLocaleString('ko-KR')
}

function parseNum(s: string): number | null {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? null : n
}

function NumInput({ value, onChange, placeholder, className }: {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  className?: string
}) {
  const [focused, setFocused] = useState(false)
  const [raw, setRaw] = useState('')
  return (
    <input
      type="text" inputMode="decimal"
      value={focused ? raw : fmt(value)}
      placeholder={placeholder}
      onFocus={() => { setRaw(value != null ? String(value) : ''); setFocused(true) }}
      onBlur={() => { onChange(parseNum(raw)); setFocused(false) }}
      onChange={e => setRaw(e.target.value)}
      className={className}
    />
  )
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities, accountSecurities }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<HoldingRow[]>(holdings)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    accounts.length > 0 ? accounts[0].id : null
  )
  const [addingNew, setAddingNew] = useState(false)
  const [newRow, setNewRow] = useState({ security_id: '', quantity: '', avg_price: '', total_invested: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  const grouped = rows.reduce<Record<string, HoldingRow[]>>((acc, r) => {
    if (!acc[r.account_id]) acc[r.account_id] = []
    acc[r.account_id].push(r)
    return acc
  }, {})

  function linkedSecIds(account_id: string) {
    return new Set(accountSecurities.filter(l => l.account_id === account_id).map(l => l.security_id))
  }

  function updateRow(account_id: string, idx: number, field: keyof HoldingRow, value: number | null) {
    setRows(prev => {
      const acRows = prev.filter(r => r.account_id === account_id)
      const rest = prev.filter(r => r.account_id !== account_id)
      return [...rest, ...acRows.map((r, i) => i === idx ? { ...r, [field]: value } : r)]
    })
  }

  function removeRow(account_id: string, idx: number) {
    setRows(prev => {
      const acRows = prev.filter(r => r.account_id === account_id)
      const rest = prev.filter(r => r.account_id !== account_id)
      return [...rest, ...acRows.filter((_, i) => i !== idx)]
    })
  }

  function confirmAdd() {
    if (!selectedAccountId || !newRow.security_id || !newRow.quantity) return
    const q = parseNum(newRow.quantity)
    if (q === null) return
    setRows(prev => [...prev, {
      account_id: selectedAccountId,
      security_id: newRow.security_id,
      quantity: q,
      avg_price: parseNum(newRow.avg_price),
      total_invested: parseNum(newRow.total_invested),
    }])
    setAddingNew(false)
    setNewRow({ security_id: '', quantity: '', avg_price: '', total_invested: '' })
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      await Promise.all(rows.map(row =>
        fetch('/api/portfolio/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...row, snapshot_id: snapshot.id, snapshot_date: snapshot.date }),
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

  const inputCls = 'w-full border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-slate-50'
  const selectedRows = selectedAccountId ? (grouped[selectedAccountId] ?? []) : []
  const linked = selectedAccountId ? linkedSecIds(selectedAccountId) : new Set<string>()
  const usedInAccount = new Set(selectedRows.map(r => r.security_id))
  const addableSecurities = securities.filter(s => linked.has(s.id) && !usedInAccount.has(s.id))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <button onClick={() => router.push('/portfolio/snapshots')}
            className="text-xs text-slate-400 hover:text-slate-600 mb-1">← 목록</button>
          <h2 className="text-lg font-bold text-slate-800">스냅샷 편집 — {snapshot.date}</h2>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
          <button onClick={handleSave} disabled={saving}
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left: account list — compact cards */}
        <div className="w-40 shrink-0 space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-2">계좌</p>
          {accounts.map(a => {
            const count = grouped[a.id]?.length ?? 0
            const isSelected = selectedAccountId === a.id
            return (
              <div key={a.id}
                onClick={() => { setSelectedAccountId(a.id); setAddingNew(false) }}
                className={`rounded-xl border px-3 py-2 cursor-pointer transition-all ${
                  isSelected ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                      {a.name}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {a.broker}
                    </p>
                  </div>
                  <span className={`text-[9px] font-medium shrink-0 ml-1 mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-300'}`}>
                    {count}
                  </span>
                </div>
                {a.type && (
                  <p className={`text-[9px] mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-300'}`}>{a.type}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: holdings grid */}
        <div className="flex-1 min-w-0">
          {selectedAccountId ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">
                  {accMap[selectedAccountId]?.broker} · {accMap[selectedAccountId]?.name}
                </p>
                <button onClick={() => setAddingNew(true)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  종목 추가
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {selectedRows.map((row, idx) => {
                  const sec = secMap[row.security_id]
                  const isUSD = sec?.currency === 'USD'
                  return (
                    <div key={idx} className="bg-white rounded-xl border border-slate-100 p-3 relative group">
                      {/* Delete button */}
                      <button onClick={() => removeRow(selectedAccountId, idx)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all z-10">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>

                      {/* Security info row */}
                      <div className="flex items-start justify-between mb-2.5 pr-5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded font-mono shrink-0">
                            {sec?.ticker}
                          </span>
                          <span className="text-xs font-medium text-slate-700 truncate">{sec?.name}</span>
                        </div>
                        {isUSD && (
                          <span className="text-[9px] text-slate-400 shrink-0 ml-1">USD</span>
                        )}
                      </div>

                      {/* 3-column inputs */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <p className="text-[9px] text-slate-400 mb-0.5">수량</p>
                          <NumInput value={row.quantity} onChange={v => updateRow(selectedAccountId, idx, 'quantity', v ?? 0)} className={inputCls} />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 mb-0.5">{isUSD ? '평균가(USD)' : '평균가(원)'}</p>
                          <NumInput value={row.avg_price} onChange={v => updateRow(selectedAccountId, idx, 'avg_price', v)} className={inputCls} />
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-400 mb-0.5">원금(원)</p>
                          <NumInput value={row.total_invested} onChange={v => updateRow(selectedAccountId, idx, 'total_invested', v)} className={inputCls} />
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Add new card */}
                {addingNew && (
                  <div className="bg-blue-50 rounded-xl border border-blue-100 p-3">
                    <p className="text-[10px] font-semibold text-blue-700 mb-2">종목 추가</p>
                    <select value={newRow.security_id}
                      onChange={e => setNewRow(p => ({ ...p, security_id: e.target.value }))}
                      className="w-full border border-blue-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 mb-2">
                      <option value="">종목 선택</option>
                      {addableSecurities.map(s => (
                        <option key={s.id} value={s.id}>{s.ticker} · {s.name}</option>
                      ))}
                    </select>
                    {addableSecurities.length === 0 && (
                      <p className="text-[9px] text-blue-500 mb-2">연결된 종목 없음 — 관리 &gt; 계좌에서 설정</p>
                    )}
                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                      <div>
                        <p className="text-[9px] text-slate-500 mb-0.5">수량 *</p>
                        <input type="text" inputMode="decimal" value={newRow.quantity}
                          onChange={e => setNewRow(p => ({ ...p, quantity: e.target.value }))} placeholder="0"
                          className="w-full border border-blue-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 mb-0.5">평균가</p>
                        <input type="text" inputMode="decimal" value={newRow.avg_price}
                          onChange={e => setNewRow(p => ({ ...p, avg_price: e.target.value }))} placeholder="0"
                          className="w-full border border-blue-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-500 mb-0.5">원금</p>
                        <input type="text" inputMode="decimal" value={newRow.total_invested}
                          onChange={e => setNewRow(p => ({ ...p, total_invested: e.target.value }))} placeholder="0"
                          className="w-full border border-blue-200 rounded-md px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={confirmAdd} disabled={!newRow.security_id || !newRow.quantity}
                        className="bg-blue-600 text-white px-2.5 py-1 rounded-md text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
                        추가
                      </button>
                      <button onClick={() => setAddingNew(false)}
                        className="text-slate-500 px-2.5 py-1 rounded-md text-xs font-medium hover:bg-slate-100 transition-colors">
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {selectedRows.length === 0 && !addingNew && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-sm text-slate-400">이 계좌에 종목이 없습니다</p>
                    <button onClick={() => setAddingNew(true)}
                      className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">+ 종목 추가</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-slate-400">
              왼쪽에서 계좌를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
