'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Sell, Dividend, Security, Account } from '@/lib/portfolio/types'

interface AccountSecurity { account_id: string; security_id: string }

interface Props {
  sells: (Sell & { security: Pick<Security, 'ticker' | 'name'>; account: Pick<Account, 'name' | 'broker'> })[]
  dividends: (Dividend & { security: Pick<Security, 'ticker' | 'name'>; account: Pick<Account, 'name' | 'broker'> })[]
  securities: Pick<Security, 'id' | 'ticker' | 'name'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker'>[]
  accountSecurities: AccountSecurity[]
}

const FALLBACK_EXCHANGE_RATE = 1350

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function groupByMonth(items: { date: string; value: number }[]) {
  const map: Record<string, number> = {}
  items.forEach(({ date, value }) => {
    const month = date.slice(0, 7)
    map[month] = (map[month] ?? 0) + value
  })
  return Object.entries(map).sort().map(([month, value]) => ({ month, value }))
}

export default function IncomeDashboard({ sells, dividends, securities, accounts, accountSecurities }: Props) {
  const [tab, setTab] = useState<'sells' | 'dividends'>('sells')

  const totalPnl = sells.reduce((s, r) => s + (r.realized_pnl_krw ?? 0), 0)
  const totalDiv = dividends.reduce((s, d) => s + (d.currency === 'USD' ? d.amount * FALLBACK_EXCHANGE_RATE : d.amount), 0)

  const sellChartData = groupByMonth(sells.map(s => ({ date: s.sold_at, value: s.realized_pnl_krw ?? 0 })))
  const divChartData = groupByMonth(dividends.map(d => ({ date: d.paid_at, value: d.currency === 'USD' ? d.amount * FALLBACK_EXCHANGE_RATE : d.amount })))

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '총 실현손익', value: totalPnl, color: totalPnl >= 0 ? 'text-rose-500' : 'text-blue-500' },
          { label: '총 배당수익', value: totalDiv, color: 'text-emerald-600' },
          { label: '합산 수익', value: totalPnl + totalDiv, color: 'text-slate-800' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.color}`}>{fmt(k.value)}원</p>
          </div>
        ))}
      </div>

      {/* Tab */}
      <div className="flex gap-2">
        {(['sells', 'dividends'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-700'}`}>
            {t === 'sells' ? '매도 기록' : '배당 기록'}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <h3 className="text-sm font-semibold text-slate-600 mb-4">
          {tab === 'sells' ? '월별 실현손익' : '월별 배당수익'}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tab === 'sells' ? sellChartData : divChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} width={60} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()}원`]} />
            <Bar dataKey="value" fill={tab === 'sells' ? '#6366f1' : '#10b981'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {tab === 'sells'
        ? <SellsTable sells={sells} securities={securities} accounts={accounts} accountSecurities={accountSecurities} />
        : <DividendsTable dividends={dividends} securities={securities} accounts={accounts} accountSecurities={accountSecurities} />
      }
    </div>
  )
}

function SellsTable({ sells, securities, accounts, accountSecurities }: {
  sells: Props['sells']
  securities: Props['securities']
  accounts: Props['accounts']
  accountSecurities: AccountSecurity[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({ security_id: '', account_id: '', sold_at: '', quantity: '', avg_cost_krw: '', sell_price_krw: '', realized_pnl_krw: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const linkedSecurities = form.account_id
    ? (() => {
        const ids = new Set(accountSecurities.filter(l => l.account_id === form.account_id).map(l => l.security_id))
        return securities.filter(s => ids.has(s.id))
      })()
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/portfolio/sells', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        quantity: parseFloat(form.quantity),
        avg_cost_krw: form.avg_cost_krw ? parseFloat(form.avg_cost_krw) : null,
        sell_price_krw: form.sell_price_krw ? parseFloat(form.sell_price_krw) : null,
        realized_pnl_krw: form.realized_pnl_krw ? parseFloat(form.realized_pnl_krw) : null,
      }),
    })
    setMsg(res.ok ? '저장 완료' : '저장 실패')
    setSaving(false)
    if (res.ok) router.refresh()
  }

  const sel = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'
  const inp = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">매도 기록 추가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Account first */}
          <select required value={form.account_id}
            onChange={e => setForm(p => ({ ...p, account_id: e.target.value, security_id: '' }))}
            className={sel}>
            <option value="">계좌 선택</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} {a.name}</option>)}
          </select>
          {/* Then security filtered by account */}
          <select required value={form.security_id}
            onChange={e => setForm(p => ({ ...p, security_id: e.target.value }))}
            disabled={!form.account_id}
            className={`${sel} disabled:opacity-50`}>
            <option value="">{form.account_id ? '종목 선택' : '계좌 먼저 선택'}</option>
            {linkedSecurities.map(s => <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>)}
          </select>
          <input type="date" required value={form.sold_at}
            onChange={e => setForm(p => ({ ...p, sold_at: e.target.value }))} className={inp} />
          <input type="number" step="any" required placeholder="수량" value={form.quantity}
            onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inp} />
          <input type="number" step="any" placeholder="평균매입단가(원)" value={form.avg_cost_krw}
            onChange={e => setForm(p => ({ ...p, avg_cost_krw: e.target.value }))} className={inp} />
          <input type="number" step="any" placeholder="매도가(원)" value={form.sell_price_krw}
            onChange={e => setForm(p => ({ ...p, sell_price_krw: e.target.value }))} className={inp} />
          <input type="number" step="any" placeholder="실현손익(원)" value={form.realized_pnl_krw}
            onChange={e => setForm(p => ({ ...p, realized_pnl_krw: e.target.value }))} className={inp} />
          <input type="text" placeholder="메모" value={form.memo}
            onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} className={inp} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={saving}
            className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '추가'}
          </button>
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">매도일</th>
              <th className="text-right px-4 py-3">수량</th>
              <th className="text-right px-4 py-3">평균단가</th>
              <th className="text-right px-4 py-3">매도가</th>
              <th className="text-right px-4 py-3">실현손익</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sells.map(s => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{s.security.ticker}</p>
                  <p className="text-xs text-slate-400">{s.security.name}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.account.broker} · {s.account.name}</td>
                <td className="px-4 py-3 text-right text-slate-500">{s.sold_at}</td>
                <td className="px-4 py-3 text-right font-mono">{s.quantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.avg_cost_krw ? `${fmt(s.avg_cost_krw)}원` : '-'}</td>
                <td className="px-4 py-3 text-right text-slate-600">{s.sell_price_krw ? `${fmt(s.sell_price_krw)}원` : '-'}</td>
                <td className={`px-4 py-3 text-right font-semibold ${(s.realized_pnl_krw ?? 0) >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                  {s.realized_pnl_krw != null ? `${s.realized_pnl_krw >= 0 ? '+' : ''}${fmt(s.realized_pnl_krw)}원` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DividendsTable({ dividends, securities, accounts, accountSecurities }: {
  dividends: Props['dividends']
  securities: Props['securities']
  accounts: Props['accounts']
  accountSecurities: AccountSecurity[]
}) {
  const router = useRouter()
  const [form, setForm] = useState({ security_id: '', account_id: '', paid_at: '', amount: '', currency: 'USD', tax: '', memo: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const linkedSecurities = form.account_id
    ? (() => {
        const ids = new Set(accountSecurities.filter(l => l.account_id === form.account_id).map(l => l.security_id))
        return securities.filter(s => ids.has(s.id))
      })()
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/portfolio/dividends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        tax: form.tax ? parseFloat(form.tax) : 0,
      }),
    })
    setMsg(res.ok ? '저장 완료' : '저장 실패')
    setSaving(false)
    if (res.ok) router.refresh()
  }

  const sel = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'
  const inp = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">배당/분배금 추가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Account first */}
          <select required value={form.account_id}
            onChange={e => setForm(p => ({ ...p, account_id: e.target.value, security_id: '' }))}
            className={sel}>
            <option value="">계좌 선택</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} {a.name}</option>)}
          </select>
          {/* Then security filtered by account */}
          <select required value={form.security_id}
            onChange={e => setForm(p => ({ ...p, security_id: e.target.value }))}
            disabled={!form.account_id}
            className={`${sel} disabled:opacity-50`}>
            <option value="">{form.account_id ? '종목 선택' : '계좌 먼저 선택'}</option>
            {linkedSecurities.map(s => <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>)}
          </select>
          <input type="date" required value={form.paid_at}
            onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))} className={inp} />
          <input type="number" step="any" required placeholder="금액" value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className={inp} />
          <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className={sel}>
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </select>
          <input type="number" step="any" placeholder="세금" value={form.tax}
            onChange={e => setForm(p => ({ ...p, tax: e.target.value }))} className={inp} />
          <input type="text" placeholder="메모" value={form.memo}
            onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
            className={`col-span-2 ${inp}`} />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={saving}
            className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '추가'}
          </button>
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        </div>
      </form>

      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">지급일</th>
              <th className="text-right px-4 py-3">금액</th>
              <th className="text-right px-4 py-3">세금</th>
              <th className="text-left px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dividends.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{d.security.ticker}</p>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{d.account.broker} · {d.account.name}</td>
                <td className="px-4 py-3 text-right text-slate-500">{d.paid_at}</td>
                <td className="px-4 py-3 text-right text-emerald-600 font-semibold">
                  {d.amount.toLocaleString()} {d.currency}
                </td>
                <td className="px-4 py-3 text-right text-slate-500">{d.tax > 0 ? `${d.tax.toLocaleString()} ${d.currency}` : '-'}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{d.memo ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
