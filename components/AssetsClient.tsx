'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useTheme } from '@/lib/ThemeContext'
import { btn, badge, field, modal } from '@/lib/styles'
import { formatWonFull } from '@/lib/utils'
import { createPortal } from 'react-dom'
import AssetFormModal, { type AssetItem } from '@/components/AssetFormModal'
import AssetValuationModal from '@/components/AssetValuationModal'

// ── Types ────────────────────────────────────────────────
interface ValuationItem {
  id: string
  val_date: string
  amount: number
  note: string
}

interface PensionAsset {
  id: string
  name: string
  description: string
  current_amount: number | null
  last_snapshot_date: string | null
  created_at: string
}

interface PensionSnapshot {
  id: string
  pension_asset_id: string
  snapshot_date: string
  amount: number
  note: string
}

interface PortfolioSnapshot {
  id: string
  date: string
  memo: string | null
  total_market_value: number | null
  total_invested: number | null
}

// ── Constants ────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  '부동산': '#1A237E',
  '자동차': '#f59e0b',
}
const PENSION_COLOR = '#00695C'
const FINANCIAL_COLOR = '#4527A0'

// ── Utility ──────────────────────────────────────────────
function fmtAmt(n: number | null | undefined): string {
  if (n == null) return '-'
  return formatWonFull(Math.round(n))
}

function sliceDate(v: unknown): string {
  return String(v ?? '').slice(0, 10)
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── KPI Card ─────────────────────────────────────────────
function KpiCard({ label, value, sub, color, tooltip }: {
  label: string; value: string; sub: string; color: string; tooltip?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:-translate-y-0.5 transition-all">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        <div className="relative group flex items-center gap-1">
          <p className="text-xs text-slate-400 font-medium">{label}</p>
          {tooltip && (
            <>
              <svg className="w-3 h-3 text-slate-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:block z-10 w-48 bg-slate-800 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none">
                {tooltip}
              </div>
            </>
          )}
        </div>
      </div>
      <p className="text-base font-bold mt-1 text-slate-800">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  )
}

// ── TypeBadge ────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#6b7280'
  return (
    <span className={badge.base} style={{ backgroundColor: `${color}1a`, color }}>
      {type}
    </span>
  )
}

// ── AssetCard (유형자산) ──────────────────────────────────
function AssetCard({ item, onEdit, onDelete, onValuation, palette }: {
  item: AssetItem
  onEdit: (item: AssetItem) => void
  onDelete: (id: string) => void
  onValuation: (item: AssetItem) => void
  palette: { colors: string[] }
}) {
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

  const gain = item.current_value != null && item.acquisition_price != null
    ? item.current_value - item.acquisition_price : null
  const gainPct = gain != null && item.acquisition_price != null && item.acquisition_price > 0
    ? (gain / item.acquisition_price) * 100 : null
  const gainColor = gain === null ? '#64748b' : gain >= 0 ? '#ef4444' : '#3b82f6'

  const chartData = (valuations ?? [])
    .slice().sort((a, b) => a.val_date.localeCompare(b.val_date))
    .map(v => ({ date: v.val_date, amount: v.amount }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={handleToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <TypeBadge type={item.asset_type} />
              <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
            </div>
            {item.description ? <p className="text-xs text-slate-400 mb-2">{item.description}</p> : null}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
              <span>취득가 <span className="font-medium text-slate-700">{item.acquisition_price != null ? fmtAmt(item.acquisition_price) : '-'}</span></span>
              <span className="text-slate-200">·</span>
              <span>현재 <span className="font-medium text-slate-700">{item.current_value != null ? fmtAmt(item.current_value) : '-'}</span></span>
              <span className="text-slate-200">·</span>
              <span>시세차익 <span className="font-medium" style={{ color: gainColor }}>
                {gain != null ? `${gain >= 0 ? '+' : ''}${fmtAmt(gain)}` : '-'}
                {gainPct !== null ? ` (${gainPct.toFixed(1)}%)` : ''}
              </span></span>
            </div>
            <p className="text-[10px] text-slate-300 mt-1">마지막 평가일: {item.last_val_date ?? '-'}</p>
          </div>
          <svg className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="flex items-center justify-end gap-2 mt-3" onClick={e => e.stopPropagation()}>
          <button onClick={() => onValuation(item)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors">
            평가액 업데이트
          </button>
          <button onClick={() => onEdit(item)} className={btn.icon} title="수정">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(item.id)} className={btn.danger} title="삭제">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          {loadingVal ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-300">로딩 중...</div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-slate-300">시세 이력이 없습니다</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(value: number) => [formatWonFull(value), '시세']}
                  labelStyle={{ fontSize: 11, color: '#64748b' }}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Line type="monotone" dataKey="amount" stroke={palette.colors[0]} strokeWidth={2}
                  dot={{ r: 3, fill: palette.colors[0] }} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  )
}

// ── Pension Snapshot Modal ────────────────────────────────
function PensionSnapshotModal({ show, pensionId, pensionName, onClose, onSaved, palette }: {
  show: boolean
  pensionId: string
  pensionName: string
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
}) {
  const [date, setDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (show) { setDate(todayStr()); setAmount(''); setNote(''); setError(null) }
  }, [show, pensionId])

  if (!show) return null

  async function handleSubmit() {
    const parsed = Number(amount)
    if (!date || isNaN(parsed) || parsed <= 0) {
      setError('날짜와 금액을 올바르게 입력해주세요.')
      return
    }
    setSaving(true); setError(null)
    try {
      const res = await fetch(`/api/pension-assets/${pensionId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot_date: date, amount: parsed, note: note.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장 실패')
      onSaved(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally { setSaving(false) }
  }

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">스냅샷 기록</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{pensionName}</p>
          </div>
          <button onClick={onClose} className={modal.close} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modal.body}>
          <div>
            <label className={field.label}>기준일</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field.input} />
          </div>
          <div>
            <label className={field.label}>금액 (원)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0" min={1} className={field.input} />
          </div>
          <div>
            <label className={field.label}>메모</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)}
              placeholder="메모" className={field.input} />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
        <div className={modal.footer}>
          <button type="button" onClick={onClose} className={btn.secondary}>취소</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Pension Form Modal ────────────────────────────────────
function PensionFormModal({ show, onClose, onSaved, palette, editItem }: {
  show: boolean
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
  editItem?: PensionAsset | null
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editItem) { setName(editItem.name); setDescription(editItem.description) }
    else { setName(''); setDescription('') }
    setError(null)
  }, [editItem, show])

  if (!show) return null

  async function handleSubmit() {
    if (!name.trim()) { setError('연금 항목명을 입력해주세요.'); return }
    setSaving(true); setError(null)
    try {
      const url = editItem ? `/api/pension-assets/${editItem.id}` : '/api/pension-assets'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장 실패')
      onSaved(); onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally { setSaving(false) }
  }

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        <div className={modal.header}>
          <h2 className="text-sm font-semibold text-slate-800">{editItem ? '연금자산 수정' : '연금자산 추가'}</h2>
          <button onClick={onClose} className={modal.close} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modal.body}>
          <div>
            <label className={field.label}>항목명</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="예: 국민연금, IRP, 퇴직연금" className={field.input} />
          </div>
          <div>
            <label className={field.label}>설명</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="설명 (선택)" className={field.input} />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
        <div className={modal.footer}>
          <button type="button" onClick={onClose} className={btn.secondary}>취소</button>
          <button type="button" onClick={handleSubmit} disabled={saving} className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : editItem ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── PensionCard ───────────────────────────────────────────
function PensionCard({ item, onEdit, onDelete, onSnapshot, palette }: {
  item: PensionAsset
  onEdit: (item: PensionAsset) => void
  onDelete: (id: string) => void
  onSnapshot: (item: PensionAsset) => void
  palette: { colors: string[] }
}) {
  const [expanded, setExpanded] = useState(false)
  const [snapshots, setSnapshots] = useState<PensionSnapshot[] | null>(null)
  const [loading, setLoading] = useState(false)

  function handleToggle() {
    if (!expanded && snapshots === null) {
      setLoading(true)
      fetch(`/api/pension-assets/${item.id}/snapshots`)
        .then(r => r.json())
        .then((data: PensionSnapshot[]) => setSnapshots(Array.isArray(data) ? data : []))
        .catch(() => setSnapshots([]))
        .finally(() => setLoading(false))
    }
    setExpanded(prev => !prev)
  }

  function refreshSnapshots() {
    setLoading(true)
    fetch(`/api/pension-assets/${item.id}/snapshots`)
      .then(r => r.json())
      .then((data: PensionSnapshot[]) => setSnapshots(Array.isArray(data) ? data : []))
      .catch(() => setSnapshots([]))
      .finally(() => setLoading(false))
  }

  async function handleDeleteSnapshot(sid: string) {
    if (!confirm('이 스냅샷을 삭제하시겠습니까?')) return
    await fetch(`/api/pension-assets/${item.id}/snapshots/${sid}`, { method: 'DELETE' })
    refreshSnapshots()
  }

  const chartData = (snapshots ?? [])
    .slice().sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    .map(s => ({ date: s.snapshot_date, amount: s.amount }))

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={handleToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={badge.base} style={{ backgroundColor: `${PENSION_COLOR}1a`, color: PENSION_COLOR }}>연금</span>
              <span className="text-sm font-semibold text-slate-800 truncate">{item.name}</span>
            </div>
            {item.description && <p className="text-xs text-slate-400 mb-2">{item.description}</p>}
            <div className="text-xs text-slate-500">
              {item.current_amount != null
                ? <span className="font-medium text-slate-700">{fmtAmt(item.current_amount)}</span>
                : <span className="text-slate-300">스냅샷 없음</span>
              }
            </div>
            {item.last_snapshot_date && (
              <p className="text-[10px] text-slate-300 mt-1">마지막 기록일: {item.last_snapshot_date}</p>
            )}
          </div>
          <svg className={`w-4 h-4 text-slate-300 flex-shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div className="flex items-center gap-2 mt-3" onClick={e => e.stopPropagation()}>
          <button onClick={() => onSnapshot(item)}
            className="px-3 py-1 rounded-lg text-[10px] font-medium border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors">
            스냅샷 기록
          </button>
          <button onClick={() => onEdit(item)} className={btn.icon} title="수정">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(item.id)} className={btn.danger} title="삭제">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-5 py-4">
          {loading ? (
            <div className="h-32 flex items-center justify-center text-xs text-slate-300">로딩 중...</div>
          ) : snapshots && snapshots.length === 0 ? (
            <div className="h-24 flex items-center justify-center text-xs text-slate-300">기록된 스냅샷이 없습니다</div>
          ) : (
            <>
              {chartData.length >= 2 && (
                <div className="mb-4">
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Tooltip
                        formatter={(value: number) => [formatWonFull(value), '잔액']}
                        labelStyle={{ fontSize: 11, color: '#64748b' }}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      />
                      <Line type="monotone" dataKey="amount" stroke={PENSION_COLOR} strokeWidth={2}
                        dot={{ r: 3, fill: PENSION_COLOR }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-1">
                {[...(snapshots ?? [])].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date)).map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-400">{s.snapshot_date}</span>
                    <span className="font-semibold text-slate-700">{fmtAmt(s.amount)}</span>
                    {s.note && <span className="text-slate-300 truncate max-w-[120px]">{s.note}</span>}
                    <button onClick={() => handleDeleteSnapshot(s.id)}
                      className="text-slate-200 hover:text-rose-400 transition-colors ml-2 opacity-0 group-hover:opacity-100">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Financial Assets Section ──────────────────────────────
function FinancialSection() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portfolio/snapshots')
      .then(r => r.json())
      .then((data: PortfolioSnapshot[]) => {
        const latest = Array.isArray(data) && data.length > 0 ? data[0] : null
        setSnapshot(latest)
      })
      .catch(() => setSnapshot(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-32 flex items-center justify-center text-xs text-slate-300 animate-pulse">로딩 중...</div>
  }

  if (!snapshot) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-xs text-slate-300">포트폴리오 스냅샷 데이터가 없습니다</p>
        <a href="/portfolio/snapshots" className="text-xs text-blue-400 hover:text-blue-600 mt-1 block">
          포트폴리오 스냅샷으로 이동 →
        </a>
      </div>
    )
  }

  const gain = snapshot.total_market_value != null && snapshot.total_invested != null
    ? snapshot.total_market_value - snapshot.total_invested : null
  const gainPct = gain != null && snapshot.total_invested && snapshot.total_invested > 0
    ? (gain / snapshot.total_invested) * 100 : null
  const gainColor = gain === null ? '#64748b' : gain >= 0 ? '#ef4444' : '#3b82f6'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <a href="/portfolio/snapshots"
              className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors">
              최신 포트폴리오 스냅샷 →
            </a>
            <p className="text-[10px] text-slate-300 mt-0.5">{sliceDate(snapshot.date)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">평가액</p>
            <p className="text-base font-bold text-slate-800">{fmtAmt(snapshot.total_market_value)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">투자원금</p>
            <p className="text-base font-bold text-slate-800">{fmtAmt(snapshot.total_invested)}</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 mb-0.5">평가손익</p>
            <p className="text-base font-bold" style={{ color: gainColor }}>
              {gain != null ? `${gain >= 0 ? '+' : ''}${fmtAmt(gain)}` : '-'}
              {gainPct != null && <span className="text-xs font-medium ml-1">({gainPct.toFixed(1)}%)</span>}
            </p>
          </div>
        </div>
        {snapshot.memo && <p className="text-xs text-slate-400 mt-3">{snapshot.memo}</p>}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────
export default function AssetsClient() {
  const { palette } = useTheme()
  const [activeTab, setActiveTab] = useState<'tangible' | 'pension' | 'financial'>('tangible')

  // Tangible assets state
  const [tangibleItems, setTangibleItems] = useState<AssetItem[]>([])
  const [tangibleLoading, setTangibleLoading] = useState(true)
  const [showFormModal, setShowFormModal] = useState(false)
  const [editItem, setEditItem] = useState<AssetItem | null>(null)
  const [showValModal, setShowValModal] = useState(false)
  const [valTarget, setValTarget] = useState<AssetItem | null>(null)

  // Pension state
  const [pensionItems, setPensionItems] = useState<PensionAsset[]>([])
  const [pensionLoading, setPensionLoading] = useState(true)
  const [showPensionForm, setShowPensionForm] = useState(false)
  const [editPensionItem, setEditPensionItem] = useState<PensionAsset | null>(null)
  const [showSnapshotModal, setShowSnapshotModal] = useState(false)
  const [snapshotTarget, setSnapshotTarget] = useState<PensionAsset | null>(null)

  // Portfolio snapshot for financial KPI
  const [portfolioSnapshot, setPortfolioSnapshot] = useState<PortfolioSnapshot | null>(null)

  function loadTangible() {
    setTangibleLoading(true)
    fetch('/api/assets')
      .then(r => r.json())
      .then((data: AssetItem[]) => setTangibleItems(Array.isArray(data) ? data.filter(i => i.asset_type === '부동산' || i.asset_type === '자동차' || i.asset_type === '차량') : []))
      .catch(() => setTangibleItems([]))
      .finally(() => setTangibleLoading(false))
  }

  function loadPension() {
    setPensionLoading(true)
    fetch('/api/pension-assets')
      .then(r => r.json())
      .then((data: PensionAsset[]) => setPensionItems(Array.isArray(data) ? data : []))
      .catch(() => setPensionItems([]))
      .finally(() => setPensionLoading(false))
  }

  useEffect(() => {
    loadTangible()
    loadPension()
    // Fetch latest portfolio snapshot for KPI
    fetch('/api/portfolio/snapshots')
      .then(r => r.json())
      .then((data: PortfolioSnapshot[]) => setPortfolioSnapshot(Array.isArray(data) && data.length > 0 ? data[0] : null))
      .catch(() => setPortfolioSnapshot(null))
  }, [])

  // KPI calculations
  const tangibleTotal = tangibleItems.reduce((s, i) => s + Number(i.current_value ?? 0), 0)
  const tangibleAcq = tangibleItems.reduce((s, i) => s + Number(i.acquisition_price ?? 0), 0)
  const pensionTotal = pensionItems.reduce((s, i) => s + Number(i.current_amount ?? 0), 0)
  const financialTotal = Number(portfolioSnapshot?.total_market_value ?? 0)
  const grandTotal = tangibleTotal + pensionTotal + financialTotal

  const TABS = [
    { key: 'tangible' as const, label: '유형자산', color: '#1A237E' },
    { key: 'pension' as const, label: '연금자산', color: PENSION_COLOR },
    { key: 'financial' as const, label: '금융자산', color: FINANCIAL_COLOR },
  ]

  if (tangibleLoading && pensionLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded-xl w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
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
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>자산</h1>
          <p className="text-xs text-slate-400 mt-0.5">유형자산, 연금자산, 금융자산 현황</p>
        </div>
        {activeTab === 'tangible' && (
          <button onClick={() => { setEditItem(null); setShowFormModal(true) }}
            className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>
            + 자산 추가
          </button>
        )}
        {activeTab === 'pension' && (
          <button onClick={() => { setEditPensionItem(null); setShowPensionForm(true) }}
            className={btn.primary} style={{ backgroundColor: palette.colors[0] }}>
            + 연금 추가
          </button>
        )}
      </div>

      {/* 전체 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="총 자산" value={fmtAmt(grandTotal)} sub="유형+연금+금융 합산" color="#1A237E"
          tooltip="유형자산, 연금자산, 금융자산 평가액 합계" />
        <KpiCard label="유형자산" value={fmtAmt(tangibleTotal)} sub="부동산·자동차" color="#1A237E"
          tooltip="부동산, 자동차의 현재 평가액 합계" />
        <KpiCard label="연금자산" value={fmtAmt(pensionTotal)} sub="연금 최신 잔액" color={PENSION_COLOR}
          tooltip="등록된 연금 항목의 최신 스냅샷 금액 합계" />
        <KpiCard label="금융자산" value={fmtAmt(financialTotal)} sub="포트폴리오 최신" color={FINANCIAL_COLOR}
          tooltip="포트폴리오 최신 스냅샷의 총 평가액" />
      </div>

      {/* 탭 */}
      <div className="flex gap-0.5 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={activeTab === tab.key
              ? { background: '#fff', color: tab.color, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
              : { color: '#94a3b8' }
            }>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === 'tangible' && (
        tangibleItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-16 text-center text-xs text-slate-300">
            등록된 유형자산이 없습니다. 자산을 추가해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tangibleItems.map(item => (
              <AssetCard key={item.id} item={item}
                onEdit={i => { setEditItem(i); setShowFormModal(true) }}
                onDelete={id => { if (confirm('이 자산을 삭제하시겠습니까?')) fetch(`/api/assets/${id}`, { method: 'DELETE' }).then(r => { if (r.ok) loadTangible() }) }}
                onValuation={i => { setValTarget(i); setShowValModal(true) }}
                palette={palette}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'pension' && (
        pensionItems.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-16 text-center text-xs text-slate-300">
            등록된 연금자산이 없습니다. 연금을 추가해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pensionItems.map(item => (
              <PensionCard key={item.id} item={item}
                onEdit={i => { setEditPensionItem(i); setShowPensionForm(true) }}
                onDelete={async id => {
                  if (!confirm('이 연금자산을 삭제하시겠습니까?')) return
                  await fetch(`/api/pension-assets/${id}`, { method: 'DELETE' })
                  loadPension()
                }}
                onSnapshot={i => { setSnapshotTarget(i); setShowSnapshotModal(true) }}
                palette={palette}
              />
            ))}
          </div>
        )
      )}

      {activeTab === 'financial' && <FinancialSection />}

      {/* Modals */}
      <AssetFormModal
        show={showFormModal}
        onClose={() => { setShowFormModal(false); setEditItem(null) }}
        onSaved={loadTangible}
        palette={palette}
        editItem={editItem}
      />
      {valTarget && (
        <AssetValuationModal
          show={showValModal}
          assetId={valTarget.id}
          assetName={valTarget.name}
          onClose={() => { setShowValModal(false); setValTarget(null) }}
          onSaved={loadTangible}
          palette={palette}
        />
      )}
      <PensionFormModal
        show={showPensionForm}
        onClose={() => { setShowPensionForm(false); setEditPensionItem(null) }}
        onSaved={loadPension}
        palette={palette}
        editItem={editPensionItem}
      />
      {snapshotTarget && (
        <PensionSnapshotModal
          show={showSnapshotModal}
          pensionId={snapshotTarget.id}
          pensionName={snapshotTarget.name}
          onClose={() => { setShowSnapshotModal(false); setSnapshotTarget(null) }}
          onSaved={loadPension}
          palette={palette}
        />
      )}
    </div>
  )
}
