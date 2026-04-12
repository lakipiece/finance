'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'

interface AccountSecurity { account_id: string; security_id: string }

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker'>
}

interface Props {
  dividends: DividendRow[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker'>[]
  accountSecurities: AccountSecurity[]
}

function toKrw(d: Pick<Dividend, 'amount' | 'currency' | 'exchange_rate'>) {
  return d.currency === 'KRW' ? d.amount : d.amount * (d.exchange_rate || 1)
}

function taxKrw(d: Pick<Dividend, 'tax' | 'currency' | 'exchange_rate'>) {
  return d.currency === 'KRW' ? d.tax : d.tax * (d.exchange_rate || 1)
}

function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}

function fmtFull(n: number) {
  return `${Math.round(n).toLocaleString()}원`
}

function groupByMonth(items: { date: string; gross: number; net: number }[]) {
  const map: Record<string, { gross: number; net: number }> = {}
  items.forEach(({ date, gross, net }) => {
    const month = date.slice(0, 7)
    if (!map[month]) map[month] = { gross: 0, net: 0 }
    map[month].gross += gross
    map[month].net += net
  })
  return Object.entries(map).sort().map(([month, v]) => ({ month, ...v }))
}

const sel = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'
const inp = 'border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300'

export default function IncomeDashboard({ dividends, securities, accounts, accountSecurities }: Props) {
  const router = useRouter()
  const [form, setForm] = useState({
    account_id: '', security_id: '', paid_at: '',
    currency: 'KRW', amount: '', exchange_rate: '', tax: '', memo: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // KPI
  const totalGross = dividends.reduce((s, d) => s + toKrw(d), 0)
  const totalTax = dividends.reduce((s, d) => s + taxKrw(d), 0)
  const totalNet = totalGross - totalTax

  // 차트
  const chartData = groupByMonth(dividends.map(d => ({
    date: d.paid_at,
    gross: toKrw(d),
    net: toKrw(d) - taxKrw(d),
  })))

  // 계좌에 연결된 종목 필터 (없으면 전체)
  const linkedSecurities = form.account_id
    ? (() => {
        const ids = new Set(accountSecurities.filter(l => l.account_id === form.account_id).map(l => l.security_id))
        const filtered = securities.filter(s => ids.has(s.id))
        return filtered.length > 0 ? filtered : securities
      })()
    : securities

  // 선택된 종목의 통화 자동 설정
  function handleSecurityChange(security_id: string) {
    const sec = securities.find(s => s.id === security_id)
    const currency = sec?.currency === 'USD' ? 'USD' : 'KRW'
    setForm(p => ({ ...p, security_id, currency, exchange_rate: '', tax: '' }))
  }

  // 금액 변경 시 15.6% 세금 자동계산
  function handleAmountChange(amount: string) {
    const n = parseFloat(amount)
    const autoTax = !isNaN(n) && n > 0 ? (n * 0.156).toFixed(2) : ''
    setForm(p => ({ ...p, amount, tax: autoTax }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/portfolio/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          security_id: form.security_id,
          account_id: form.account_id,
          paid_at: form.paid_at,
          currency: form.currency,
          amount: parseFloat(form.amount),
          exchange_rate: form.currency === 'USD' && form.exchange_rate ? parseFloat(form.exchange_rate) : 1,
          tax: form.tax ? parseFloat(form.tax) : 0,
          memo: form.memo || null,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setMsg('저장 완료')
        setForm(p => ({ ...p, security_id: '', paid_at: '', amount: '', exchange_rate: '', tax: '', memo: '' }))
        router.refresh()
      } else {
        setMsg(`저장 실패: ${json.error ?? res.status}`)
      }
    } catch (err: any) {
      setMsg(`오류: ${err?.message ?? '알 수 없는 오류'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">총 수령액</p>
          <p className="text-xl font-bold text-emerald-600">{fmt(totalGross)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">납부 세금</p>
          <p className="text-xl font-bold text-slate-600">{fmt(totalTax)}원</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 px-5 py-4">
          <p className="text-xs text-slate-400 mb-1">세후 수령액</p>
          <p className="text-xl font-bold text-slate-800">{fmt(totalNet)}원</p>
        </div>
      </div>

      {/* 차트 */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">월별 배당·분배금</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v: number, name: string) => [`${v.toLocaleString()}원`, name === 'gross' ? '수령액' : '세후']} />
              <Bar dataKey="gross" fill="#d1fae5" radius={[3, 3, 0, 0]} />
              <Bar dataKey="net" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 입력 폼 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-100 p-4">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">배당·분배금 추가</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select required value={form.account_id}
            onChange={e => setForm(p => ({ ...p, account_id: e.target.value, security_id: '' }))}
            className={sel}>
            <option value="">계좌 선택</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.broker} {a.name}</option>)}
          </select>

          <select required value={form.security_id}
            onChange={e => handleSecurityChange(e.target.value)}
            className={sel}>
            <option value="">종목 선택</option>
            {linkedSecurities.map(s => (
              <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>
            ))}
          </select>

          <input type="date" required value={form.paid_at}
            onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
            className={inp} />

          <select value={form.currency}
            onChange={e => setForm(p => ({ ...p, currency: e.target.value, exchange_rate: '' }))}
            className={sel}>
            <option value="KRW">KRW</option>
            <option value="USD">USD</option>
          </select>

          <input type="number" step="any" required
            placeholder={`금액 (${form.currency})`}
            value={form.amount}
            onChange={e => handleAmountChange(e.target.value)}
            className={inp} />

          {form.currency === 'USD' ? (
            <input type="number" step="any" required
              placeholder="환율 (₩/USD)"
              value={form.exchange_rate}
              onChange={e => setForm(p => ({ ...p, exchange_rate: e.target.value }))}
              className={inp} />
          ) : (
            <div /> /* 빈 자리 유지 */
          )}

          <input type="number" step="any"
            placeholder={`세금 (${form.currency})`}
            value={form.tax}
            onChange={e => setForm(p => ({ ...p, tax: e.target.value }))}
            className={inp} />

          <input type="text" placeholder="메모"
            value={form.memo}
            onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
            className={inp} />
        </div>

        {/* USD 환산 미리보기 */}
        {form.currency === 'USD' && form.amount && form.exchange_rate && (
          <p className="text-xs text-slate-400 mt-2">
            ≈ {Math.round(parseFloat(form.amount) * parseFloat(form.exchange_rate)).toLocaleString()}원
            {form.tax && ` · 세금 ${Math.round(parseFloat(form.tax) * parseFloat(form.exchange_rate)).toLocaleString()}원`}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button type="submit" disabled={saving}
            className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-slate-800 disabled:opacity-50">
            {saving ? '저장 중...' : '추가'}
          </button>
          {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-red-500' : 'text-green-600'}`}>{msg}</span>}
        </div>
      </form>

      {/* 내역 테이블 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">지급일</th>
              <th className="text-right px-4 py-3">원본 금액</th>
              <th className="text-right px-4 py-3">환율</th>
              <th className="text-right px-4 py-3">수령액 (KRW)</th>
              <th className="text-right px-4 py-3">세금 (KRW)</th>
              <th className="text-right px-4 py-3">세후 (KRW)</th>
              <th className="text-left px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dividends.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">내역이 없습니다</td></tr>
            )}
            {dividends.map(d => {
              const gross = toKrw(d)
              const tax = taxKrw(d)
              const net = gross - tax
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{d.security.ticker}</p>
                    <p className="text-xs text-slate-400">{d.security.name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.account.broker} · {d.account.name}</td>
                  <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{d.paid_at}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {d.amount.toLocaleString()} {d.currency}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400 text-xs">
                    {d.currency === 'USD' ? d.exchange_rate.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-semibold">
                    {fmtFull(gross)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                    {tax > 0 ? fmtFull(tax) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-800">
                    {fmtFull(net)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{d.memo ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
