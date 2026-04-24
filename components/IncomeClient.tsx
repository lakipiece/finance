'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'
import { btn, tbl, badge } from '@/lib/styles'
import { formatWon, formatWonFull } from '@/lib/utils'
import IncomeFormModal, { type IncomeItem } from '@/components/IncomeFormModal'
import type { ChartTooltipProps, TooltipEntry } from '@/lib/chartTypes'

interface IncomeSummary {
  totals: {
    total: number
    salary: number
    bonus: number
    other: number
  }
  monthly: {
    month: number
    total: number
    salary: number
    bonus: number
    other: number
  }[]
}

const CAT_COLORS: Record<string, string> = {
  '급여': '#3b82f6',
  '보너스': '#8b5cf6',
  '기타': '#10b981',
}

const CAT_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  '급여':  { backgroundColor: 'rgba(59,130,246,0.10)', color: '#1d4ed8' },
  '보너스': { backgroundColor: 'rgba(139,92,246,0.10)', color: '#6d28d9' },
  '기타':  { backgroundColor: 'rgba(16,185,129,0.10)', color: '#047857' },
}

function IncomeCategoryBadge({ category }: { category: string }) {
  const style = CAT_BADGE_STYLE[category] ?? { backgroundColor: 'rgba(100,116,139,0.08)', color: '#64748b' }
  return (
    <span className={badge.base} style={style}>
      {category}
    </span>
  )
}

function IncomeTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: TooltipEntry) => s + (p.value ?? 0), 0)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p: TooltipEntry) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
          <span className="text-slate-500">{p.dataKey}</span>
          <span className="ml-auto font-medium text-slate-700">{formatWonFull(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-2 pt-2 flex justify-between">
        <span className="text-slate-500">합계</span>
        <span className="font-semibold text-slate-800">{formatWonFull(total)}</span>
      </div>
    </div>
  )
}

interface KpiCardProps {
  label: string
  value: string
  sub: string
  color: string
}

function KpiCard({ label, value, sub, color }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-1 text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

export default function IncomeClient({ year }: { year: number }) {
  const { palette } = useTheme()
  const [summary, setSummary] = useState<IncomeSummary | null>(null)
  const [items, setItems] = useState<IncomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<IncomeItem | null>(null)

  function loadData() {
    setLoading(true)
    Promise.all([
      fetch(`/api/incomes/summary?year=${year}`).then(r => r.json()),
      fetch(`/api/incomes?year=${year}`).then(r => r.json()),
    ]).then(([summaryData, itemsData]) => {
      setSummary(summaryData)
      setItems(Array.isArray(itemsData) ? itemsData : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  function handleEdit(item: IncomeItem) {
    setEditItem(item)
    setShowModal(true)
  }

  function handleDelete(id: number) {
    if (!confirm('이 수입 내역을 삭제하시겠습니까?')) return
    fetch(`/api/incomes/${id}`, { method: 'DELETE' })
      .then(r => {
        if (r.ok) loadData()
      })
  }

  function handleOpenCreate() {
    setEditItem(null)
    setShowModal(true)
  }

  // 월별 차트 데이터 (12개월 전체)
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const m = summary?.monthly.find((r) => r.month === i + 1)
    return {
      month: `${i + 1}월`,
      급여: m?.salary ?? 0,
      보너스: m?.bonus ?? 0,
      기타: m?.other ?? 0,
    }
  })

  // KPI 계산
  const totalIncome = Number(summary?.totals.total ?? 0)
  const monthlyAvg = summary
    ? Math.round(totalIncome / Math.max(summary.monthly.filter(m => m.total > 0).length, 1))
    : 0
  const maxMonthEntry = summary?.monthly.reduce(
    (max, m) => (m.total > (max?.total ?? 0) ? m : max),
    null as IncomeSummary['monthly'][0] | null
  )
  const maxMonth = maxMonthEntry ? `${maxMonthEntry.month}월 ${formatWon(maxMonthEntry.total)}` : '-'
  const maxCatAmount = summary
    ? Math.max(
        Number(summary.totals.salary ?? 0),
        Number(summary.totals.bonus ?? 0),
        Number(summary.totals.other ?? 0)
      )
    : 0
  const maxCatName = summary
    ? (
        Number(summary.totals.salary ?? 0) >= Number(summary.totals.bonus ?? 0) &&
        Number(summary.totals.salary ?? 0) >= Number(summary.totals.other ?? 0)
          ? '급여'
          : Number(summary.totals.bonus ?? 0) >= Number(summary.totals.other ?? 0)
            ? '보너스'
            : '기타'
      )
    : '-'

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded-xl w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
          </div>
          <div className="h-72 bg-slate-100 rounded-2xl" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>수입 관리</h1>
          <p className="text-xs text-slate-400 mt-0.5">{year}년 수입 현황</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className={btn.primary}
          style={{ backgroundColor: palette.colors[0] }}
        >
          + 수입 입력
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="연간 총 수입"
          value={formatWon(totalIncome)}
          sub={`${year}년 전체`}
          color="#3b82f6"
        />
        <KpiCard
          label="월 평균"
          value={formatWon(monthlyAvg)}
          sub="수입 있는 달 기준"
          color="#8b5cf6"
        />
        <KpiCard
          label="최대 월"
          value={maxMonth}
          sub="가장 많은 달"
          color="#10b981"
        />
        <KpiCard
          label={`카테고리 최대 (${maxCatName})`}
          value={summary ? formatWon(maxCatAmount) : '-'}
          sub="가장 많은 카테고리"
          color={CAT_COLORS[maxCatName] ?? '#6b7280'}
        />
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">월별 수입</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 10000)}만`}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip content={<IncomeTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>}
            />
            <Bar dataKey="급여"  stackId="a" fill={CAT_COLORS['급여']}  radius={[0, 0, 0, 0]} />
            <Bar dataKey="보너스" stackId="a" fill={CAT_COLORS['보너스']} radius={[0, 0, 0, 0]} />
            <Bar dataKey="기타"  stackId="a" fill={CAT_COLORS['기타']}  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 수입 내역 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">수입 내역</h2>
        </div>
        {items.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-300">
            {year}년 수입 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className={tbl.th}>날짜</th>
                  <th className={tbl.th}>카테고리</th>
                  <th className={tbl.th}>설명</th>
                  <th className={tbl.thRight}>금액</th>
                  <th className={tbl.th}>작성자</th>
                  <th className={tbl.th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? tbl.rowEven : tbl.rowOdd}>
                    <td className={tbl.td}>{item.income_date}</td>
                    <td className={tbl.td}>
                      <IncomeCategoryBadge category={item.category} />
                    </td>
                    <td className={tbl.td}>{item.description}</td>
                    <td className={tbl.tdRight}>{formatWonFull(item.amount)}</td>
                    <td className={tbl.td}>
                      {item.member ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600">
                          {item.member}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors text-xs"
                          title="수정"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-colors text-xs"
                          title="삭제"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 수입 입력/수정 모달 */}
      <IncomeFormModal
        show={showModal}
        onClose={() => { setShowModal(false); setEditItem(null) }}
        onSaved={loadData}
        palette={palette}
        editItem={editItem}
      />
    </div>
  )
}
