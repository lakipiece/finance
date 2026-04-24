'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'
import { btn, badge } from '@/lib/styles'
import { formatWon, formatWonFull } from '@/lib/utils'
import AssetFormModal, { type AssetItem } from '@/components/AssetFormModal'
import AssetValuationModal from '@/components/AssetValuationModal'

interface ValuationItem {
  id: string
  val_date: string
  amount: number
  note: string
}

const TYPE_COLORS: Record<string, string> = {
  '부동산': '#0ea5e9',
  '연금': '#8b5cf6',
  '차량': '#f59e0b',
  '기타': '#6b7280',
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

interface TypeBadgeProps {
  type: string
}

function TypeBadge({ type }: TypeBadgeProps) {
  const color = TYPE_COLORS[type] ?? '#6b7280'
  return (
    <span
      className={badge.base}
      style={{
        backgroundColor: `${color}1a`,
        color,
      }}
    >
      {type}
    </span>
  )
}

interface AssetCardProps {
  item: AssetItem
  onEdit: (item: AssetItem) => void
  onDelete: (id: string) => void
  onValuation: (item: AssetItem) => void
  palette: { colors: string[] }
}

function AssetCard({ item, onEdit, onDelete, onValuation, palette }: AssetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [valuations, setValuations] = useState<ValuationItem[] | null>(null)
  const [loadingVal, setLoadingVal] = useState(false)

  function handleToggle() {
    if (!expanded && valuations === null) {
      setLoadingVal(true)
      fetch(`/api/assets/${item.id}/valuations`)
        .then(r => r.json())
        .then((data: ValuationItem[]) => setValuations(Array.isArray(data) ? data : []))
        .catch(() => setValuations([]))
        .finally(() => setLoadingVal(false))
    }
    setExpanded(prev => !prev)
  }

  const gain =
    item.current_value != null && item.acquisition_price != null
      ? item.current_value - item.acquisition_price
      : null
  const gainPct =
    gain != null && item.acquisition_price != null && item.acquisition_price > 0
      ? (gain / item.acquisition_price) * 100
      : null

  const gainColor =
    gain === null ? '#64748b' : gain >= 0 ? '#ef4444' : '#3b82f6'

  const chartData = (valuations ?? [])
    .slice()
    .sort((a, b) => a.val_date.localeCompare(b.val_date))
    .map(v => ({
      date: v.val_date,
      amount: v.amount,
    }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* 카드 본문 */}
      <div
        className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={item.asset_type} />
              <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
            </div>
            {item.description ? (
              <p className="text-xs text-slate-400 mb-2">{item.description}</p>
            ) : null}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>취득가: {item.acquisition_price != null ? formatWon(item.acquisition_price) : '-'}</span>
              <span className="text-slate-300">→</span>
              <span>현재: {item.current_value != null ? formatWon(item.current_value) : '-'}</span>
              {gainPct !== null ? (
                <span className="font-medium" style={{ color: gainColor }}>
                  ({gain !== null && gain >= 0 ? '+' : ''}{formatWon(gain ?? 0)}, {gainPct.toFixed(1)}%)
                </span>
              ) : null}
            </div>
            <p className="text-[10px] text-slate-300 mt-1">
              마지막 평가일: {item.last_val_date ?? '-'}
            </p>
          </div>
          <svg
            className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onValuation(item)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            평가액 업데이트
          </button>
          <button
            onClick={() => onEdit(item)}
            className={btn.icon}
            title="수정"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className={btn.danger}
            title="삭제"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* 차트 — 펼쳐진 상태 */}
      {expanded ? (
        <div className="border-t border-slate-100 px-5 py-4">
          {loadingVal ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-300">
              로딩 중...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-300">
              시세 이력이 없습니다
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v.slice(2)}
                />
                <YAxis
                  tickFormatter={v => `${Math.round(v / 10000)}만`}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value: number) => [formatWonFull(value), '시세']}
                  labelStyle={{ fontSize: 11, color: '#64748b' }}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke={palette.colors[0]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: palette.colors[0] }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : null}
    </div>
  )
}

export default function AssetsClient() {
  const { palette } = useTheme()
  const [items, setItems] = useState<AssetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editItem, setEditItem] = useState<AssetItem | null>(null)
  const [showValModal, setShowValModal] = useState(false)
  const [valTarget, setValTarget] = useState<AssetItem | null>(null)

  function loadData() {
    setLoading(true)
    fetch('/api/assets')
      .then(r => r.json())
      .then((data: AssetItem[]) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleEdit(item: AssetItem) {
    setEditItem(item)
    setShowFormModal(true)
  }

  function handleDelete(id: string) {
    if (!confirm('이 자산을 삭제하시겠습니까?')) return
    fetch(`/api/assets/${id}`, { method: 'DELETE' }).then(r => {
      if (r.ok) loadData()
    })
  }

  function handleOpenCreate() {
    setEditItem(null)
    setShowFormModal(true)
  }

  function handleValuation(item: AssetItem) {
    setValTarget(item)
    setShowValModal(true)
  }

  function handleSaved(_item: AssetItem) {
    loadData()
  }

  // KPI 계산
  const totalCurrentValue = items.reduce(
    (sum, it) => (it.current_value != null ? sum + it.current_value : sum),
    0
  )
  const totalAcquisition = items.reduce(
    (sum, it) => (it.acquisition_price != null ? sum + it.acquisition_price : sum),
    0
  )
  const totalGain = totalCurrentValue - totalAcquisition

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded-xl w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>유형자산</h1>
          <p className="text-xs text-slate-400 mt-0.5">부동산, 연금, 차량 등 자산 현황</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className={btn.primary}
          style={{ backgroundColor: palette.colors[0] }}
        >
          + 자산 추가
        </button>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="유형자산 총액"
          value={formatWon(totalCurrentValue)}
          sub="현재 평가액 합산"
          color="#0ea5e9"
        />
        <KpiCard
          label="총 취득가액"
          value={formatWon(totalAcquisition)}
          sub="취득가액 합산"
          color="#8b5cf6"
        />
        <KpiCard
          label="총 평가손익"
          value={(totalGain >= 0 ? '+' : '') + formatWon(totalGain)}
          sub="총액 − 취득가액"
          color={totalGain >= 0 ? '#ef4444' : '#3b82f6'}
        />
      </div>

      {/* 자산 카드 리스트 */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-16 text-center text-xs text-slate-300">
          등록된 자산이 없습니다. 자산을 추가해보세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(item => (
            <AssetCard
              key={item.id}
              item={item}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onValuation={handleValuation}
              palette={palette}
            />
          ))}
        </div>
      )}

      {/* 자산 추가/수정 모달 */}
      <AssetFormModal
        show={showFormModal}
        onClose={() => { setShowFormModal(false); setEditItem(null) }}
        onSaved={handleSaved}
        palette={palette}
        editItem={editItem}
      />

      {/* 평가액 업데이트 모달 */}
      {valTarget ? (
        <AssetValuationModal
          show={showValModal}
          assetId={valTarget.id}
          assetName={valTarget.name}
          onClose={() => { setShowValModal(false); setValTarget(null) }}
          onSaved={loadData}
          palette={palette}
        />
      ) : null}
    </div>
  )
}
