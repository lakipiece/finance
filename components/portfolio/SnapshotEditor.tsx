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

interface Props {
  snapshot: Snapshot
  holdings: HoldingRow[]
  accounts: Account[]
  securities: Security[]
}

export default function SnapshotEditor({ snapshot, holdings, accounts, securities }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState<HoldingRow[]>(holdings)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const secMap = Object.fromEntries(securities.map(s => [s.id, s]))
  const accMap = Object.fromEntries(accounts.map(a => [a.id, a]))

  // 계좌별 그룹핑
  const grouped = rows.reduce<Record<string, HoldingRow[]>>((acc, r) => {
    if (!acc[r.account_id]) acc[r.account_id] = []
    acc[r.account_id].push(r)
    return acc
  }, {})

  function updateRow(idx: number, field: keyof HoldingRow, value: number | null) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      await Promise.all(rows.map(row =>
        fetch('/api/portfolio/holdings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...row,
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
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

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균매입가</th>
              <th className="text-right px-4 py-3">투자원금(원)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row, idx) => {
              const sec = secMap[row.security_id]
              const acc = accMap[row.account_id]
              const isUSD = sec?.currency === 'USD'
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2 text-xs text-slate-500">{acc?.broker} · {acc?.name}</td>
                  <td className="px-4 py-2">
                    <p className="font-semibold text-slate-800">{sec?.ticker}</p>
                    <p className="text-xs text-slate-400">{sec?.name}</p>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" step="any" value={row.quantity}
                      onChange={e => updateRow(idx, 'quantity', parseFloat(e.target.value))}
                      className="w-24 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 ml-auto block" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" step="any" value={row.avg_price ?? ''}
                        onChange={e => updateRow(idx, 'avg_price', e.target.value ? parseFloat(e.target.value) : null)}
                        className="w-28 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300" />
                      <span className="text-xs text-slate-400">{isUSD ? 'USD' : '원'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input type="number" step="any" value={row.total_invested ?? ''}
                      onChange={e => updateRow(idx, 'total_invested', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-32 text-right border border-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 block ml-auto" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
