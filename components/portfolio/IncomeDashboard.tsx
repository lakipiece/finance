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

const PAGE_SIZES = [20, 50, 100] as const
type SortMode = 'date' | 'amount'

export default function IncomeDashboard({ dividends: initialDividends, securities, accounts, accountSecurities }: Props) {
  const router = useRouter()

  const [dividends, setDividends] = useState(initialDividends)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DividendRow | null>(null)
  const [modalOwner, setModalOwner] = useState<string>('')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('date')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

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

  // ── 테이블 필터 + 정렬 ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = dividends
    if (q) list = list.filter(d =>
      d.security.ticker.toLowerCase().includes(q) ||
      d.security.name.toLowerCase().includes(q) ||
      d.account.name.toLowerCase().includes(q) ||
      d.account.broker.toLowerCase().includes(q) ||
      (d.account.owner ?? '').toLowerCase().includes(q) ||
      (d.memo ?? '').toLowerCase().includes(q)
    )
    return [...list].sort((a, b) =>
      sortMode === 'amount'
        ? toKrw(b) - toKrw(a)
        : fmtDate(b.paid_at).localeCompare(fmtDate(a.paid_at))
    )
  }, [dividends, search, sortMode])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

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

      {/* 테이블 헤더: 타이틀 + 검색 + 추가 버튼 */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700 shrink-0">배당·분배금 내역</h3>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="relative w-64">
            <input
              type="text"
              placeholder="내역 / 계좌 / 사용자 / 메모 검색..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-xs text-slate-500 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-200 bg-white"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <button
            onClick={openAddModal}
            className="bg-slate-700 text-white px-3 py-1.5 rounded-lg text-xs hover:bg-slate-800 transition-colors whitespace-nowrap">
            + 배당 추가
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">종목</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">계좌</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">사용자</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">메모</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">원본금액</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">수령액</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">세금</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">세후</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={11} className="py-10 text-center text-slate-400 text-xs">내역이 없습니다</td></tr>
            )}
            {slice.map((d, i) => {
              const gross = toKrw(d)
              const tax = taxKrw(d)
              const net = gross - tax
              return (
                <tr key={d.id}
                  className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                  <td className="py-2.5 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(d.paid_at)}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                      {d.security.ticker}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5 max-w-[100px] truncate" title={d.security.name}>{d.security.name}</p>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                      {d.account.broker}
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{d.account.name}</p>
                  </td>
                  <td className="py-2 px-3">
                    {d.account.owner ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
                        {d.account.owner}
                      </span>
                    ) : <span className="text-slate-300 text-xs">-</span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[160px]">
                    {d.memo
                      ? <span className="block truncate" title={d.memo}>{d.memo}</span>
                      : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right text-xs text-slate-400 tabular-nums whitespace-nowrap">
                    {Number(d.amount).toLocaleString()} {d.currency}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-800 whitespace-nowrap">
                    {fmtFull(gross)}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-xs text-slate-400 whitespace-nowrap">
                    {tax > 0 ? fmtFull(tax) : <span className="text-slate-200">—</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-emerald-600 whitespace-nowrap">
                    {fmtFull(net)}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => openEditModal(d)} className="text-slate-300 hover:text-slate-500 transition-colors" title="수정">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-rose-400 transition-colors" title="삭제">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* 페이지네이션 푸터 */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>총 {filtered.length.toLocaleString()}건</span>
          <span className="text-slate-200">|</span>
          {(['date', 'amount'] as const).map(mode => (
            <button key={mode} onClick={() => { setSortMode(mode); setPage(1) }}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                sortMode === mode ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {mode === 'date' ? '날짜순' : '수령액순'}
            </button>
          ))}
          <span className="text-slate-200">|</span>
          <span>페이지당</span>
          {PAGE_SIZES.map(size => (
            <button key={size} onClick={() => { setPageSize(size as 20 | 50 | 100); setPage(1) }}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                pageSize === size ? 'bg-slate-700 text-white font-semibold' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(['처음', '이전', null, '다음', '끝'] as const).map((label, idx) => {
            const disabled = idx < 2 ? safePage === 1 : safePage === totalPages
            const onClick = [
              () => setPage(1),
              () => setPage(p => Math.max(1, p - 1)),
              null,
              () => setPage(p => Math.min(totalPages, p + 1)),
              () => setPage(totalPages),
            ][idx]
            if (label === null) return (
              <span key="cur" className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
            )
            return (
              <button key={label} onClick={onClick!} disabled={disabled}
                className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">
                {label}
              </button>
            )
          })}
        </div>
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
