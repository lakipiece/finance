'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'

interface AccountSecurity { account_id: string; security_id: string }

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner'>
}

interface Props {
  dividends: DividendRow[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner'>[]
  accountSecurities: AccountSecurity[]
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function toKrw(d: Pick<Dividend, 'amount' | 'currency' | 'exchange_rate'>) {
  return d.currency === 'KRW' ? Number(d.amount) : Number(d.amount) * (Number(d.exchange_rate) || 1)
}
function taxKrw(d: Pick<Dividend, 'tax' | 'currency' | 'exchange_rate'>) {
  return d.currency === 'KRW' ? Number(d.tax) : Number(d.tax) * (Number(d.exchange_rate) || 1)
}
function fmtDate(val: unknown): string {
  if (val instanceof Date) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`
  }
  return String(val ?? '')
}
function fmt(n: number) {
  if (Math.abs(n) >= 100_000_000) return `${(n / 100_000_000).toFixed(2)}억`
  if (Math.abs(n) >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만`
  return n.toLocaleString()
}
function fmtFull(n: number) {
  return `${Math.round(n).toLocaleString()}원`
}
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function thisYear() {
  return new Date().getFullYear()
}

// 숫자 문자열에 콤마 포매팅
function fmtNumber(s: string) {
  const raw = s.replace(/,/g, '')
  if (raw === '' || raw === '-') return raw
  const n = parseFloat(raw)
  if (isNaN(n)) return s
  const [int, dec] = raw.split('.')
  return parseInt(int, 10).toLocaleString() + (dec !== undefined ? '.' + dec : '')
}
function parseNum(s: string) {
  return parseFloat(s.replace(/,/g, '')) || 0
}

function groupByMonth(items: { date: unknown; amount: number }[]) {
  const map: Record<string, number> = {}
  items.forEach(({ date, amount }) => {
    const month = fmtDate(date).slice(0, 7)
    if (!month) return
    map[month] = (map[month] ?? 0) + amount
  })
  return Object.entries(map).sort().map(([month, amount]) => ({ month, amount }))
}

// ─── 스타일 ──────────────────────────────────────────────────────────────────

const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 font-normal focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'
const sel = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-500 font-normal focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white'
const filterBtn = (active: boolean) =>
  `text-xs px-2.5 py-1 rounded-full border transition-colors ${
    active ? 'bg-slate-600 text-white border-slate-600' : 'border-slate-200 text-slate-500 hover:border-slate-400'
  }`

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-[11px] font-semibold text-emerald-600">
        {Math.round(payload[0].value).toLocaleString()}원
      </p>
    </div>
  )
}

// ─── 빈 폼 상태 ─────────────────────────────────────────────────────────────

const emptyForm = () => ({
  account_id: '', security_id: '', paid_at: todayStr(),
  currency: 'KRW', amount: '', exchange_rate: '', tax: '', memo: '',
})

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function IncomeDashboard({ dividends: initialDividends, securities, accounts, accountSecurities }: Props) {
  const router = useRouter()

  const [dividends, setDividends] = useState(initialDividends)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DividendRow | null>(null)
  const [selectedOwner, setSelectedOwner] = useState<string>('')
  const [modalOwner, setModalOwner] = useState<string>('')
  const [search, setSearch] = useState('')

  // ── 연간 KPI ─────────────────────────────────────────────────────────────
  const year = thisYear()
  const yearDividends = useMemo(
    () => dividends.filter(d => fmtDate(d.paid_at).startsWith(String(year))),
    [dividends, year]
  )
  const totalGross = yearDividends.reduce((s, d) => s + toKrw(d), 0)
  const totalTax = yearDividends.reduce((s, d) => s + taxKrw(d), 0)
  const totalNet = totalGross - totalTax

  // ── 차트 ─────────────────────────────────────────────────────────────────
  const chartData = groupByMonth(
    yearDividends.map(d => ({ date: d.paid_at, amount: toKrw(d) }))
  )

  // ── 사용자 목록 (owner) ───────────────────────────────────────────────────
  const owners = useMemo(() => {
    const s = new Set(accounts.map(a => a.owner ?? '').filter(Boolean))
    return [...s]
  }, [accounts])

  // ── 모달용 계좌 목록 (modalOwner 기준) ───────────────────────────────────
  const modalAccounts = useMemo(
    () => modalOwner ? accounts.filter(a => a.owner === modalOwner) : accounts,
    [accounts, modalOwner]
  )

  // ── 모달용 종목 목록 (form.account_id 기준) ───────────────────────────────
  const modalSecurities = useMemo(() => {
    if (!form.account_id) return securities
    const ids = new Set(accountSecurities.filter(l => l.account_id === form.account_id).map(l => l.security_id))
    const filtered = securities.filter(s => ids.has(s.id))
    return filtered.length > 0 ? filtered : securities
  }, [form.account_id, securities, accountSecurities])

  // ── 테이블 필터 ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return dividends
    return dividends.filter(d =>
      d.security.ticker.toLowerCase().includes(q) ||
      d.security.name.toLowerCase().includes(q) ||
      d.account.name.toLowerCase().includes(q) ||
      d.account.broker.toLowerCase().includes(q) ||
      (d.memo ?? '').toLowerCase().includes(q)
    )
  }, [dividends, search])

  // ── 핸들러 ───────────────────────────────────────────────────────────────

  function openAddModal() {
    setEditTarget(null)
    setModalOwner('')
    setForm(emptyForm())
    setShowModal(true)
  }

  function openEditModal(d: DividendRow) {
    setEditTarget(d)
    setModalOwner(d.account.owner ?? '')
    setForm({
      account_id: d.account_id,
      security_id: d.security_id,
      paid_at: fmtDate(d.paid_at),
      currency: d.currency,
      amount: Number(d.amount).toLocaleString(),
      exchange_rate: d.currency === 'USD' ? String(d.exchange_rate) : '',
      tax: Number(d.tax) > 0 ? Number(d.tax).toLocaleString() : '',
      memo: d.memo ?? '',
    })
    setShowModal(true)
  }

  function handleSecurityChange(security_id: string) {
    const sec = securities.find(s => s.id === security_id)
    const currency = sec?.currency === 'USD' ? 'USD' : 'KRW'
    setForm(p => ({ ...p, security_id, currency, exchange_rate: '', tax: '' }))
  }

  function handleAmountChange(raw: string) {
    const plain = raw.replace(/,/g, '')
    const n = parseFloat(plain)
    const autoTax = !isNaN(n) && n > 0 ? (n * 0.154).toFixed(2) : ''
    setForm(p => ({ ...p, amount: fmtNumber(plain), tax: autoTax ? fmtNumber(autoTax) : '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        security_id: form.security_id,
        account_id: form.account_id,
        paid_at: form.paid_at,
        currency: form.currency,
        amount: parseNum(form.amount),
        exchange_rate: form.currency === 'USD' && form.exchange_rate ? parseNum(form.exchange_rate) : 1,
        tax: form.tax ? parseNum(form.tax) : 0,
        memo: form.memo || null,
      }

      const isEdit = !!editTarget
      const url = isEdit ? `/api/portfolio/dividends/${editTarget!.id}` : '/api/portfolio/dividends'
      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        setShowModal(false)
        router.refresh()
        // 낙관적 업데이트 대신 router.refresh로 서버 재로드
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/portfolio/dividends/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  // ── 렌더링 ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: `${year}년 총 수령액`, value: totalGross, color: 'text-emerald-600' },
          { label: `${year}년 납부 세금`, value: totalTax, color: 'text-rose-400' },
          { label: `${year}년 세후 수령액`, value: totalNet, color: 'text-slate-800' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 px-5 py-4">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className={`text-xl font-bold text-right ${color}`}>{fmt(value)}원</p>
          </div>
        ))}
      </div>

      {/* 차트 */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-500 mb-4">{year}년 월별 배당·분배금 수령액</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" fill="#a7f3d0" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 배당 추가 버튼 */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-600">배당·분배금 내역</h3>
        <button
          onClick={openAddModal}
          className="bg-slate-700 text-white px-4 py-1.5 rounded-lg text-xs hover:bg-slate-800 transition-colors">
          + 배당 추가
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <input
          type="text"
          placeholder="계좌, 종목, 메모 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300 pl-8"
        />
        <svg className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-[11px] text-slate-400 uppercase tracking-wider">
              <th className="text-left px-4 py-3">종목</th>
              <th className="text-left px-4 py-3">계좌</th>
              <th className="text-right px-4 py-3">지급일</th>
              <th className="text-right px-4 py-3">원본</th>
              <th className="text-right px-4 py-3">수령액 (KRW)</th>
              <th className="text-right px-4 py-3">세금 (KRW)</th>
              <th className="text-right px-4 py-3">세후 (KRW)</th>
              <th className="text-left px-4 py-3">메모</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-xs">내역이 없습니다</td></tr>
            )}
            {filtered.map(d => {
              const gross = toKrw(d)
              const tax = taxKrw(d)
              const net = gross - tax
              return (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-700 text-[13px]">{d.security.ticker}</p>
                    <p className="text-[11px] text-slate-400">{d.security.name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.account.broker} · {d.account.name}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums">{fmtDate(d.paid_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
                    {Number(d.amount).toLocaleString()} {d.currency}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-semibold text-[13px]">
                    {fmtFull(gross)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-400">
                    {tax > 0 ? fmtFull(tax) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700 text-[13px]">
                    {fmtFull(net)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{d.memo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEditModal(d)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="수정">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-slate-400 hover:text-rose-500 transition-colors"
                        title="삭제">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-slate-700">
                {editTarget ? '배당·분배금 수정' : '배당·분배금 추가'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* 사용자 선택 (버튼 필터) */}
              {owners.length > 0 && (
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">계좌 사용자</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button"
                      onClick={() => { setModalOwner(''); setForm(p => ({ ...p, account_id: '', security_id: '' })) }}
                      className={filterBtn(modalOwner === '')}>전체</button>
                    {owners.map(o => (
                      <button type="button" key={o}
                        onClick={() => { setModalOwner(o); setForm(p => ({ ...p, account_id: '', security_id: '' })) }}
                        className={filterBtn(modalOwner === o)}>{o}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* 계좌 선택 */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">계좌</p>
                <select required value={form.account_id}
                  onChange={e => setForm(p => ({ ...p, account_id: e.target.value, security_id: '' }))}
                  className={sel}>
                  <option value="">계좌 선택</option>
                  {modalAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.broker} {a.name}</option>
                  ))}
                </select>
              </div>

              {/* 종목 선택 */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">종목</p>
                <select required value={form.security_id}
                  onChange={e => handleSecurityChange(e.target.value)}
                  className={sel}>
                  <option value="">종목 선택</option>
                  {modalSecurities.map(s => (
                    <option key={s.id} value={s.id}>{s.ticker} {s.name}</option>
                  ))}
                </select>
              </div>

              {/* 수령일 */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">수령일</p>
                <input type="date" required value={form.paid_at}
                  onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
                  className={inp} />
              </div>

              {/* 통화 선택 (버튼 필터) */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">통화</p>
                <div className="flex gap-1.5">
                  {['KRW', 'USD'].map(c => (
                    <button type="button" key={c}
                      onClick={() => setForm(p => ({ ...p, currency: c, exchange_rate: '', tax: '' }))}
                      className={filterBtn(form.currency === c)}>{c}</button>
                  ))}
                </div>
              </div>

              {/* 금액 + 환율 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1.5">금액 ({form.currency})</p>
                  <input type="text" inputMode="decimal" required
                    placeholder="0"
                    value={form.amount}
                    onChange={e => handleAmountChange(e.target.value)}
                    className={`${inp} text-right`} />
                </div>
                {form.currency === 'USD' ? (
                  <div>
                    <p className="text-xs text-slate-400 mb-1.5">환율 (₩/USD)</p>
                    <input type="text" inputMode="decimal" required
                      placeholder="0"
                      value={form.exchange_rate}
                      onChange={e => setForm(p => ({ ...p, exchange_rate: fmtNumber(e.target.value.replace(/,/g, '')) }))}
                      className={`${inp} text-right`} />
                  </div>
                ) : <div />}
              </div>

              {/* USD 환산 미리보기 */}
              {form.currency === 'USD' && form.amount && form.exchange_rate && (
                <p className="text-xs text-slate-400 -mt-2">
                  ≈ {Math.round(parseNum(form.amount) * parseNum(form.exchange_rate)).toLocaleString()}원
                </p>
              )}

              {/* 세금 */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">세금 ({form.currency}) <span className="text-slate-300">· 15.4% 자동계산</span></p>
                <input type="text" inputMode="decimal"
                  placeholder="0"
                  value={form.tax}
                  onChange={e => setForm(p => ({ ...p, tax: fmtNumber(e.target.value.replace(/,/g, '')) }))}
                  className={`${inp} text-right`} />
              </div>

              {/* 메모 */}
              <div>
                <p className="text-xs text-slate-400 mb-1.5">메모</p>
                <textarea
                  rows={3}
                  placeholder="메모 (선택)"
                  value={form.memo}
                  onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
                  className={`${inp} resize-none`} />
              </div>

              {/* 저장 버튼 */}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 border border-slate-200">
                  취소
                </button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 rounded-lg text-sm bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50">
                  {saving ? '저장 중...' : editTarget ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
