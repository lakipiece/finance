'use client'

import { useState, useMemo } from 'react'
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

interface AccountSecurity { account_id: string; security_id: string }

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner'>
}

interface Props {
  dividends: DividendRow[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>[]
  accountSecurities: AccountSecurity[]
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

const fmt = formatWonCompact

function thisYear() { return new Date().getFullYear() }

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

function groupByAccount(items: DividendRow[]) {
  const map: Record<string, number> = {}
  for (const d of items) {
    const key = `${d.account.broker} · ${d.account.name}`
    map[key] = (map[key] ?? 0) + toKrw(d)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }))
}

function groupBySecurity(items: DividendRow[]) {
  const map: Record<string, number> = {}
  for (const d of items) {
    map[d.security.ticker] = (map[d.security.ticker] ?? 0) + toKrw(d)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ label, amount }))
}

// ─── 커스텀 툴팁 ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, color }: ChartTooltipProps & { color?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
      <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-semibold" style={{ color: color ?? '#10b981' }}>
        {Math.round(payload[0].value).toLocaleString()}원
      </p>
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function IncomeDashboard({ dividends, securities, accounts, accountSecurities }: Props) {
  const router = useRouter()
  const { palette } = useTheme()

  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<DividendRow | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [tab, setTab] = useState<'month' | 'account' | 'security'>('month')

  const year = thisYear()

  const yearDividends = useMemo(
    () => dividends.filter(d => fmtDate(d.paid_at).startsWith(String(year))),
    [dividends, year]
  )

  const chartData = groupByMonth(
    yearDividends.map(d => ({ date: d.paid_at, amount: toKrw(d) }))
  )
  const monthTickerMap = useMemo(() => groupByMonthAndTicker(yearDividends), [yearDividends])

  const scopedDividends = useMemo(
    () => selectedMonth
      ? yearDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
      : yearDividends,
    [yearDividends, selectedMonth]
  )

  const owners = useMemo(() => {
    const s = new Set(accounts.map(a => a.owner ?? '').filter(Boolean))
    return [...s]
  }, [accounts])

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>배당 · 분배금</h1>
          <p className="text-xs text-slate-400 mt-0.5">연도별 수령 현황 및 세후 집계</p>
        </div>
      </div>

      {/* KPI */}
      {(() => {
        const kpiRows = selectedMonth
          ? yearDividends.filter(d => fmtDate(d.paid_at).startsWith(selectedMonth))
          : yearDividends
        const gross = kpiRows.reduce((s, d) => s + toKrw(d), 0)
        const tax = kpiRows.reduce((s, d) => s + taxKrw(d), 0)
        const net = gross - tax
        const scopeLabel = selectedMonth ? selectedMonth.replace('-', '.') : `${year}년`
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 hover:-translate-y-0.5 transition-all">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{scopeLabel} 총 수령액</p>
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
            {year}년 배당·분배금 집계
            {selectedMonth && <span className="text-xs text-slate-400 font-normal ml-2">· {selectedMonth}</span>}
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

        {tab === 'month' && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
              onClick={(data) => {
                const label = data?.activeLabel as string | undefined
                if (label) setSelectedMonth(prev => prev === label ? null : label)
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={32}
                fill={palette.colors[0]} style={{ cursor: 'pointer' }} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {tab === 'account' && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={groupByAccount(scopedDividends)} layout="vertical"
              margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={120} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={18} fill={palette.colors[0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {tab === 'security' && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={groupBySecurity(scopedDividends).slice(0, 15)} layout="vertical"
              margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmt(v)} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} width={80} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip color={palette.colors[0]} />} cursor={{ fill: '#f8fafc' }} />
              <Bar dataKey="amount" radius={[0, 3, 3, 0]} maxBarSize={14} fill={palette.colors[0]} />
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
        dividends={dividends}
        onEdit={openEditModal}
        onDelete={handleDelete}
        openAddModal={openAddModal}
        palette={palette}
      />

      {/* 추가/수정 모달 */}
      <DividendFormModal
        show={showModal}
        onClose={() => setShowModal(false)}
        editTarget={editTarget}
        accounts={accounts}
        accountSecurities={accountSecurities}
        securities={securities}
        owners={owners}
        palette={palette}
      />

    </div>
  )
}
