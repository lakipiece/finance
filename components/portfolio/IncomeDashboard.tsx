'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import { formatWonCompact } from '@/lib/utils'
import type { ChartTooltipProps } from '@/lib/chartTypes'
import { toKrw, taxKrw, fmtDate } from '@/lib/portfolio/dividendUtils'
import DividendTable from './DividendTable'
import DividendFormModal from './DividendFormModal'
import BulkDividendModal from './BulkDividendModal'
import YearMonthPicker from '@/components/ui/YearMonthPicker'

interface AccountSecurity { account_id: string; security_id: string }
interface MemberOpt { code: string; color: string }
interface PositionLite { ticker: string; account_id: string; owner: string | null; invested: number; marketValue: number }

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner' | 'dividend_tax_rate'>
}

interface Props {
  dividends: DividendRow[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>[]
  accountSecurities: AccountSecurity[]
  positions: PositionLite[]
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const fmt = formatWonCompact

function inPeriod(dateStr: string, allPeriod: boolean, year: number, month: number | null) {
  if (allPeriod) return true
  if (!dateStr.startsWith(String(year))) return false
  if (month !== null && dateStr.slice(5, 7) !== String(month).padStart(2, '0')) return false
  return true
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

function groupByMonthAndTicker(items: DividendRow[]) {
  const map: Record<string, Record<string, number>> = {}
  for (const d of items) {
    const month = fmtDate(d.paid_at).slice(0, 7)
    if (!month) continue
    if (!map[month]) map[month] = {}
    const ticker = d.security.ticker
    map[month][ticker] = (map[month][ticker] ?? 0) + toKrw(d)
  }
  return map
}

function groupByAccount(
  items: DividendRow[],
  posMap: Record<string, { invested: number; marketValue: number }>,
) {
  const map: Record<string, { label: string; amount: number }> = {}
  for (const d of items) {
    const id = String(d.account_id)
    if (!map[id]) map[id] = { label: `${d.account.broker} · ${d.account.name}`, amount: 0 }
    map[id].amount += toKrw(d)
  }
  return Object.entries(map)
    .map(([id, { label, amount }]) => ({
      label,
      amount,
      invested: posMap[id]?.invested ?? 0,
      marketValue: posMap[id]?.marketValue ?? 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

function groupBySecurity(
  items: DividendRow[],
  posMap: Record<string, { invested: number; marketValue: number }>,
) {
  const map: Record<string, { name: string; amount: number }> = {}
  for (const d of items) {
    const ticker = d.security.ticker
    if (!map[ticker]) map[ticker] = { name: d.security.name || ticker, amount: 0 }
    map[ticker].amount += toKrw(d)
  }
  return Object.entries(map)
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([ticker, { name, amount }]) => ({
      label: name,
      ticker,
      amount,
      invested: posMap[ticker]?.invested ?? 0,
      marketValue: posMap[ticker]?.marketValue ?? 0,
    }))
}

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────

// 월별·계좌별·종목별 공통: 배당금 · 투자금 · 평가금 · 배당률(배당금/투자금)을 한번에 표시
function DividendTooltip({ active, payload, label, color }: ChartTooltipProps & { color?: string }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload as { label?: string; month?: string; amount?: number; invested?: number; marketValue?: number }
  const amount = p.amount ?? 0
  const invested = p.invested ?? 0
  const marketValue = p.marketValue ?? 0
  const pnl = marketValue - invested
  const yieldPct = invested > 0 ? (amount / invested) * 100 : null
  const title = p.label ?? p.month ?? label ?? ''
  const rows: { k: string; v: number; c: string }[] = [
    { k: '배당금', v: amount, c: color ?? '#10b981' },
    { k: '투자금', v: invested, c: '#64748b' },
    { k: '평가금', v: marketValue, c: '#1A237E' },
  ]
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-2 shadow-sm min-w-[160px]">
      <p className="text-[11px] font-semibold text-slate-700 mb-1.5">{title}</p>
      <div className="space-y-0.5">
        {rows.map(r => (
          <div key={r.k} className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-slate-400">{r.k}</span>
            <span className="text-[11px] font-medium tabular-nums" style={{ color: r.c }}>
              {Math.round(r.v).toLocaleString()}원
            </span>
          </div>
        ))}
        {yieldPct !== null ? (
          <div className="flex items-center justify-between gap-4 pt-1 mt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">배당률</span>
            <span className="text-[11px] font-semibold tabular-nums text-emerald-600">
              {yieldPct.toFixed(2)}%
            </span>
          </div>
        ) : null}
        {invested > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-slate-400">평가손익</span>
            <span className="text-[11px] font-medium tabular-nums" style={{ color: pnl >= 0 ? '#dc2626' : '#2563eb' }}>
              {pnl >= 0 ? '+' : ''}{Math.round(pnl).toLocaleString()}원
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function IncomeDashboard({ dividends, securities, accounts, accountSecurities, positions }: Props) {
  const router = useRouter()
  const { palette } = useTheme()

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DividendRow | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedSecurity, setSelectedSecurity] = useState<string | null>(null)
  const [tab, setTab] = useState<'month' | 'account' | 'security'>('month')
  const [taxUpdating, setTaxUpdating] = useState(false)

  // 필터: 년월 · 사용자 · 계좌
  const now = new Date()
  const [filterYear, setFilterYear] = useState(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [filterAllPeriod, setFilterAllPeriod] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>([])

  useEffect(() => {
    fetch('/api/options/members').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setMemberOpts(data)
    }).catch(() => {})
  }, [])

  // 필터 상태 복원 (배당 추가 등으로 새로고침돼도 유지)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('income-filter')
      if (!raw) return
      const f = JSON.parse(raw)
      if (typeof f.year === 'number') setFilterYear(f.year)
      if (f.month === null || typeof f.month === 'number') setFilterMonth(f.month)
      if (typeof f.allPeriod === 'boolean') setFilterAllPeriod(f.allPeriod)
      if (f.owner === null || typeof f.owner === 'string') setOwnerFilter(f.owner)
      if (f.account === null || typeof f.account === 'string') setAccountFilter(f.account)
    } catch { /* noop */ }
  }, [])

  function persistFilter(next: { year: number; month: number | null; allPeriod: boolean; owner: string | null; account: string | null }) {
    try { sessionStorage.setItem('income-filter', JSON.stringify(next)) } catch { /* noop */ }
  }

  const filteredDividends = useMemo(
    () => dividends.filter(d => {
      if (ownerFilter && (d.account.owner ?? '') !== ownerFilter) return false
      if (accountFilter && String(d.account_id) !== accountFilter) return false
      return inPeriod(fmtDate(d.paid_at), filterAllPeriod, filterYear, filterMonth)
    }),
    [dividends, ownerFilter, accountFilter, filterAllPeriod, filterYear, filterMonth]
  )

  const periodLabel = filterAllPeriod
    ? '전체 기간'
    : filterMonth
    ? `${filterYear}년 ${filterMonth}월`
    : `${filterYear}년`

  const monthTickerMap = useMemo(() => groupByMonthAndTicker(filteredDividends), [filteredDividends])

  const scopedDividends = useMemo(
    () => selectedMonth
      ? filteredDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
      : filteredDividends,
    [filteredDividends, selectedMonth]
  )

  // 투자금·평가금 — owner/계좌 필터를 배당 필터와 동일하게 반영해 집계 (종목/계좌/총계)
  const scopedPositions = useMemo(
    () => positions.filter(p => {
      if (ownerFilter && (p.owner ?? '') !== ownerFilter) return false
      if (accountFilter && String(p.account_id) !== accountFilter) return false
      return true
    }),
    [positions, ownerFilter, accountFilter]
  )

  const positionByTicker = useMemo(() => {
    const map: Record<string, { invested: number; marketValue: number }> = {}
    for (const p of scopedPositions) {
      if (!map[p.ticker]) map[p.ticker] = { invested: 0, marketValue: 0 }
      map[p.ticker].invested += p.invested
      map[p.ticker].marketValue += p.marketValue
    }
    return map
  }, [scopedPositions])

  const positionByAccount = useMemo(() => {
    const map: Record<string, { invested: number; marketValue: number }> = {}
    for (const p of scopedPositions) {
      const id = String(p.account_id)
      if (!map[id]) map[id] = { invested: 0, marketValue: 0 }
      map[id].invested += p.invested
      map[id].marketValue += p.marketValue
    }
    return map
  }, [scopedPositions])

  // 월별 툴팁용 총 투자금·평가금 (기간 무관, 현재 보유 기준)
  const totalPosition = useMemo(
    () => scopedPositions.reduce(
      (acc, p) => ({ invested: acc.invested + p.invested, marketValue: acc.marketValue + p.marketValue }),
      { invested: 0, marketValue: 0 }
    ),
    [scopedPositions]
  )

  const monthData = useMemo(
    () => groupByMonth(filteredDividends.map(d => ({ date: d.paid_at, amount: toKrw(d) })))
      .map(row => ({ ...row, invested: totalPosition.invested, marketValue: totalPosition.marketValue })),
    [filteredDividends, totalPosition]
  )

  const accountData = useMemo(
    () => groupByAccount(scopedDividends, positionByAccount),
    [scopedDividends, positionByAccount]
  )

  const securityData = useMemo(
    () => groupBySecurity(scopedDividends, positionByTicker).slice(0, 15),
    [scopedDividends, positionByTicker]
  )

  const owners = useMemo(() => {
    const s = new Set(accounts.map(a => a.owner ?? '').filter(Boolean))
    return [...s]
  }, [accounts])

  // 배당 내역이 있는 계좌만 (사용자 필터 반영)
  const filterAccounts = useMemo(() => {
    const ids = new Set(dividends.map(d => String(d.account_id)))
    return accounts.filter(a =>
      ids.has(String(a.id)) && (!ownerFilter || (a.owner ?? '') === ownerFilter)
    )
  }, [accounts, dividends, ownerFilter])

  function ownerColor(code: string) {
    return memberOpts.find(m => m.code === code)?.color ?? palette.colors[0]
  }

  function selectOwner(o: string) {
    const owner = ownerFilter === o ? null : o
    setOwnerFilter(owner)
    setAccountFilter(null)
    setSelectedMonth(null)
    setSelectedSecurity(null)
    persistFilter({ year: filterYear, month: filterMonth, allPeriod: filterAllPeriod, owner, account: null })
  }

  function selectAccount(id: string) {
    const account = accountFilter === id ? null : id
    setAccountFilter(account)
    setSelectedMonth(null)
    setSelectedSecurity(null)
    persistFilter({ year: filterYear, month: filterMonth, allPeriod: filterAllPeriod, owner: ownerFilter, account })
  }

  function handlePeriodChange(y: number, m: number | null, all: boolean) {
    setFilterYear(y)
    setFilterMonth(m)
    setFilterAllPeriod(all)
    setSelectedMonth(null)
    setSelectedSecurity(null)
    persistFilter({ year: y, month: m, allPeriod: all, owner: ownerFilter, account: accountFilter })
  }

  function openAddModal() {
    setEditTarget(null)
    setShowModal(true)
  }

  function openEditModal(d: DividendRow) {
    setEditTarget(d)
    setShowModal(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/portfolio/dividends/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function handleUpdateTax() {
    if (!confirm('세금이 0인 배당 건에 대해 계좌 세율로 자동 계산하여 저장합니다.\n계속하시겠습니까?')) return
    setTaxUpdating(true)
    const res = await fetch('/api/portfolio/dividends/update-tax', { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setTaxUpdating(false)
    if (res.ok) {
      alert(`${data.updated ?? 0}건 업데이트 완료`)
      router.refresh()
    } else {
      alert('업데이트 실패')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>배당 · 분배금</h1>
          <p className="text-xs text-slate-400 mt-0.5">기간별 배당·분배금 집계 및 세후 현황</p>
        </div>
        <div className="flex items-center gap-2">
          <YearMonthPicker
            year={filterYear} month={filterMonth} allPeriod={filterAllPeriod}
            align="right"
            onChange={handlePeriodChange}
          />
          <button
            onClick={handleUpdateTax}
            disabled={taxUpdating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 disabled:opacity-50 transition-colors"
          >
            {taxUpdating ? '계산 중…' : '세금 자동계산'}
          </button>
        </div>
      </div>

      {/* 필터: 사용자 · 계좌 */}
      <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">사용자</span>
        {owners.length > 0 ? owners.map(o => {
          const active = ownerFilter === o
          return (
            <button key={o} type="button" onClick={() => selectOwner(o)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${active ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              style={active ? { backgroundColor: ownerColor(o) } : undefined}>
              {o}
            </button>
          )
        }) : <span className="text-[11px] text-slate-300">없음</span>}
        <span className="text-slate-200 text-xs">|</span>
        <span className="text-[11px] font-semibold text-slate-400 shrink-0">계좌</span>
        {filterAccounts.length > 0 ? filterAccounts.map(a => {
          const active = accountFilter === String(a.id)
          return (
            <button key={a.id} type="button" onClick={() => selectAccount(String(a.id))}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {a.broker} · {a.name}
            </button>
          )
        }) : <span className="text-[11px] text-slate-300">없음</span>}
      </div>

      {/* KPI */}
      {(() => {
        const kpiRows = selectedMonth
          ? filteredDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
          : filteredDividends
        const gross = kpiRows.reduce((s, d) => s + toKrw(d), 0)
        const tax = kpiRows.reduce((s, d) => s + taxKrw(d), 0)
        const net = gross - tax
        const scopeLabel = selectedMonth ? selectedMonth.replace('-', '.') : periodLabel
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 총 배당금</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums" style={{ color: palette.colors[0] }}>{fmt(gross)}원</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 추정 세금</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums text-rose-400">{fmt(tax)}원</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 세후 배당금</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 tabular-nums text-slate-800">{fmt(net)}원</p>
            </div>
          </div>
        )
      })()}

      {/* 차트 탭 */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-700">
            {periodLabel} 배당·분배금 집계
            {selectedMonth ? <span className="text-xs text-slate-400 font-normal ml-2">· {selectedMonth}</span> : null}
          </h3>
          <div className="flex gap-1">
            {(['month', 'account', 'security'] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className="px-2.5 py-1 rounded text-xs transition-colors"
                style={tab === k
                  ? { background: palette.colors[0], color: '#fff' }
                  : { background: '#f1f5f9', color: '#64748b' }}>
                {k === 'month' ? '월별' : k === 'account' ? '계좌별' : '종목별'}
              </button>
            ))}
          </div>
        </div>

        {tab === 'month' && monthData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthData} barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              onClick={(data) => {
                const label = data?.activeLabel as string | undefined
                if (label) setSelectedMonth(prev => prev === label ? null : label)
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} axisLine={false} tickLine={false} />
              <Tooltip content={<DividendTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={32}
                fill={palette.colors[0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {tab === 'account' && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={accountData} layout="vertical"
              margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
              <Tooltip content={<DividendTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={18} fill={palette.colors[0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {tab === 'security' && (
          <ResponsiveContainer width="100%" height={Math.max(220, securityData.length * 24 + 20)}>
            <BarChart data={securityData} layout="vertical"
              margin={{ top: 0, right: 12, left: 8, bottom: 0 }}
              style={{ cursor: 'pointer' }}
              onClick={(data) => {
                const ticker = data?.activePayload?.[0]?.payload?.ticker as string | undefined
                if (ticker) setSelectedSecurity(prev => prev === ticker ? null : ticker)
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
              <Tooltip content={<DividendTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={14}
                fill={palette.colors[0]}
                label={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* 도넛 드릴다운 */}
      {selectedMonth && (() => {
        const breakdown = monthTickerMap[selectedMonth] ?? {}
        const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
        const total = entries.reduce((s, [, v]) => s + v, 0)
        const pieData = entries.map(([name, value], i) => ({
          name, value,
          fill: palette.colors[i % palette.colors.length] ?? '#94a3b8',
        }))
        return (
          <div className="bg-white rounded-2xl border border-slate-100 px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-600">{selectedMonth} 종목별 배당</h4>
              <button onClick={() => setSelectedMonth(null)} className="text-slate-300 hover:text-slate-500 text-xs">닫기</button>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={45} outerRadius={70}
                  dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString()}원`} />
              </PieChart>
              <div className="flex-1 space-y-1 min-w-0">
                {entries.map(([name, value], i) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: palette.colors[i % palette.colors.length] ?? '#94a3b8' }} />
                    <span className="text-[10px] text-slate-600 flex-1 truncate">{name}</span>
                    <span className="text-[10px] tabular-nums text-slate-500">
                      {total > 0 ? (value / total * 100).toFixed(1) : 0}%
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-400">
                      {Math.round(value).toLocaleString()}원
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 배당 테이블 */}
      <DividendTable
        dividends={filteredDividends}
        selectedMonth={selectedMonth}
        selectedSecurity={selectedSecurity}
        onClearSecurity={() => setSelectedSecurity(null)}
        onEdit={openEditModal}
        onDelete={handleDelete}
        openAddModal={openAddModal}
        palette={palette}
      />

      {/* 수정 모달 (단건) */}
      <DividendFormModal
        show={showModal && !!editTarget}
        onClose={() => setShowModal(false)}
        editTarget={editTarget}
        accounts={accounts}
        accountSecurities={accountSecurities}
        securities={securities}
        owners={owners}
        palette={palette}
      />

      {/* 추가 모달 (일괄) */}
      <BulkDividendModal
        show={showModal && !editTarget}
        onClose={() => setShowModal(false)}
        accounts={accounts}
        accountSecurities={accountSecurities}
        securities={securities}
        owners={owners}
        palette={palette}
      />

    </div>
  )
}
