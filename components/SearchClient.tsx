'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, formatWonFull, catBadgeStyle } from '@/lib/utils'
import { useFilter } from '@/lib/FilterContext'
import { field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'

interface IncomeItem {
  id: number
  year: number
  month: number
  date: string
  category: string
  description: string
  amount: number
  member: string | null
  memo: string
}

interface Props {
  initialExpenses: ExpenseItem[]
  initialYear: number
  availableYears: number[]
}

const MONTH_OPTIONS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const PAGE_SIZES = [20, 50, 100] as const

const METHODS = ['카드', '현금', '지역화폐'] as const

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtAmount(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString('ko-KR') : ''
}
function parseAmount(v: string) { return parseInt(v.replace(/[^0-9]/g, '')) || 0 }

/* ── Pill button ── */
function PillBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  const { palette } = useTheme()
  const bg = active ? (color ?? palette.colors[0]) : undefined
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${active ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
      style={bg ? { backgroundColor: bg, borderColor: bg } : undefined}>
      {children}
    </button>
  )
}

function MemberToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {['L', 'P'].map(m => <PillBtn key={m} active={value === m} onClick={() => onChange(m)}>{m}</PillBtn>)}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

/* ── Modal Shell ── */
function ModalShell({ onClose, title, onDelete, children }: { onClose: () => void; title: string; onDelete: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-1">
            <button onClick={onDelete} title="삭제" className="p-1.5 rounded-lg text-slate-200 hover:text-rose-400 hover:bg-rose-50 transition-all"><TrashIcon /></button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ── Expense Edit Modal ── */
function ExpenseEditModal({ record, onClose, onSaved, onDelete }: {
  record: ExpenseItem & { id: number }; onClose: () => void; onSaved: () => void; onDelete: () => void
}) {
  const [date, setDate] = useState(record.date)
  const [member, setMember] = useState(record.member ?? 'L')
  const [category, setCategory] = useState(record.category)
  const [detail, setDetail] = useState(record.detail)
  const [method, setMethod] = useState(record.method)
  const [amount, setAmount] = useState(fmtAmount(String(record.amount)))
  const [memo, setMemo] = useState(record.memo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || amt <= 0) { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/expenses/${record.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo, memos: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="지출 수정" onDelete={onDelete}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1"><label className={field.label}>날짜</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} /></div>
          <div className="flex flex-col gap-1"><label className={field.label}>작성자</label><MemberToggle value={member} onChange={setMember} /></div>
        </div>
        <div><label className={field.label}>지출유형</label><div className="flex flex-wrap gap-1.5 mt-1">{CATEGORIES.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)}>{c}</PillBtn>)}</div></div>
        <div><label className={field.label}>세부유형</label><input type="text" value={detail} onChange={e => setDetail(e.target.value)} maxLength={30} className={field.input} /></div>
        <div><label className={field.label}>결제수단</label><div className="flex flex-wrap gap-1.5 mt-1">{METHODS.map(m => <PillBtn key={m} active={method === m} onClick={() => setMethod(m)}>{m}</PillBtn>)}</div></div>
        <div><label className={field.label}>금액 (원)</label><input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(fmtAmount(e.target.value))} className={`${field.input} text-right`} /></div>
        <div><label className={field.label}>비고</label><textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className={`${field.input} resize-none leading-snug`} /></div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200">취소</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#1A237E' }}>{saving ? '저장 중…' : '수정'}</button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Income Edit Modal ── */
function IncomeEditModal({ record, onClose, onSaved, onDelete }: {
  record: IncomeItem; onClose: () => void; onSaved: () => void; onDelete: () => void
}) {
  const [date, setDate] = useState(record.date)
  const [member, setMember] = useState(record.member ?? 'L')
  const [category, setCategory] = useState(record.category)
  const [description, setDescription] = useState(record.description)
  const [amount, setAmount] = useState(fmtAmount(String(record.amount)))
  const [memo, setMemo] = useState(record.memo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || !description || amt <= 0) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/incomes/${record.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: amt, member, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="수입 수정" onDelete={onDelete}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1"><label className={field.label}>날짜</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} /></div>
          <div className="flex flex-col gap-1"><label className={field.label}>작성자</label><MemberToggle value={member} onChange={setMember} /></div>
        </div>
        <div><label className={field.label}>카테고리</label><div className="flex flex-wrap gap-1.5 mt-1">{INCOME_CATEGORIES.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]}>{c}</PillBtn>)}</div></div>
        <div><label className={field.label}>설명</label><input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={50} className={field.input} /></div>
        <div><label className={field.label}>금액 (원)</label><input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(fmtAmount(e.target.value))} className={`${field.input} text-right`} /></div>
        <div><label className={field.label}>비고</label><textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className={`${field.input} resize-none leading-snug`} /></div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200">취소</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60" style={{ backgroundColor: '#1A237E' }}>{saving ? '저장 중…' : '수정'}</button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Unified row type ── */
type UnifiedItem =
  | ({ kind: 'expense' } & ExpenseItem & { id: number })
  | ({ kind: 'income' } & IncomeItem)

type SortKey = 'date' | 'category' | 'detail' | 'memo' | 'method' | 'amount' | 'member'
type SortDir = 'asc' | 'desc'

export default function SearchClient({ initialExpenses, initialYear, availableYears }: Props) {
  const { excludeLoan } = useFilter()

  const [expYearCache, setExpYearCache] = useState<Record<number, (ExpenseItem & { id: number })[]>>({ [initialYear]: initialExpenses as (ExpenseItem & { id: number })[] })
  const [incYearCache, setIncYearCache] = useState<Record<number, IncomeItem[]>>({})
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const fetchedExpRef = useRef<Set<number>>(new Set([initialYear]))
  const fetchedIncRef = useRef<Set<number>>(new Set())

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [category, setCategory] = useState('전체')
  const [month, setMonth] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [editItem, setEditItem] = useState<UnifiedItem | null>(null)

  const fetchExpYear = useCallback(async (year: number) => {
    if (fetchedExpRef.current.has(year)) return
    fetchedExpRef.current.add(year)
    setLoading(true)
    try {
      const res = await fetch(`/api/year-data?year=${year}`)
      if (res.ok) {
        const data = await res.json()
        setExpYearCache(prev => ({ ...prev, [year]: data?.allExpenses ?? [] }))
      }
    } finally { setLoading(false) }
  }, [])

  const fetchIncYear = useCallback(async (year: number) => {
    if (fetchedIncRef.current.has(year)) return
    fetchedIncRef.current.add(year)
    try {
      const res = await fetch(`/api/incomes?year=${year}`)
      if (res.ok) {
        const data = await res.json()
        const items: IncomeItem[] = (Array.isArray(data) ? data : []).map((r: {
          id: number; income_date: string; year: number; month: number
          category: string; description: string; amount: number; member: string | null; memo: string
        }) => ({
          id: r.id, year: r.year, month: r.month, date: r.income_date,
          category: r.category, description: r.description ?? '',
          amount: r.amount, member: r.member, memo: r.memo ?? '',
        }))
        setIncYearCache(prev => ({ ...prev, [year]: items }))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    availableYears.forEach(y => { fetchExpYear(y); fetchIncYear(y) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleYearChange(value: string) {
    if (value === 'all') {
      setSelectedYear('all')
    } else {
      const y = Number(value)
      setSelectedYear(y)
      fetchExpYear(y)
      fetchIncYear(y)
    }
    setPage(1)
  }

  const allExpenses = useMemo(
    () => selectedYear === 'all'
      ? Object.values(expYearCache).flat()
      : expYearCache[selectedYear] ?? [],
    [selectedYear, expYearCache]
  )

  const allIncomes = useMemo(
    () => selectedYear === 'all'
      ? Object.values(incYearCache).flat()
      : incYearCache[selectedYear] ?? [],
    [selectedYear, incYearCache]
  )

  const activeExpenseCategories = useMemo(() =>
    excludeLoan ? CATEGORIES.filter(c => c !== '대출상환') : CATEGORIES,
    [excludeLoan]
  )

  const allCategories = useMemo(() => [
    ...activeExpenseCategories,
    ...INCOME_CATEGORIES,
  ], [activeExpenseCategories])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir(key === 'amount' ? 'desc' : 'asc') }
    setPage(1)
  }

  const results: UnifiedItem[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const monthNum = month === '전체' ? null : parseInt(month)

    const expenses: UnifiedItem[] = (typeFilter === 'income' ? [] : (
      (excludeLoan ? allExpenses.filter(e => e.category !== '대출상환') : allExpenses)
        .filter(e => {
          if (q && !e.detail.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q) && !(e.memo ?? '').toLowerCase().includes(q)) return false
          if (category !== '전체' && e.category !== category) return false
          if (monthNum !== null && e.month !== monthNum) return false
          return true
        })
        .map(e => ({ kind: 'expense' as const, ...e }))
    ))

    const incomes: UnifiedItem[] = (typeFilter === 'expense' ? [] : (
      allIncomes.filter(i => {
        if (q && !i.description.toLowerCase().includes(q) && !i.category.toLowerCase().includes(q) && !(i.memo ?? '').toLowerCase().includes(q)) return false
        if (category !== '전체' && i.category !== category) return false
        if (monthNum !== null && i.month !== monthNum) return false
        return true
      }).map(i => ({ kind: 'income' as const, ...i }))
    ))

    const combined = [...expenses, ...incomes]

    const dir = sortDir === 'asc' ? 1 : -1
    combined.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'category': cmp = a.category.localeCompare(b.category); break
        case 'detail': {
          const la = a.kind === 'expense' ? a.detail : a.description
          const lb = b.kind === 'expense' ? b.detail : b.description
          cmp = la.localeCompare(lb); break
        }
        case 'memo': cmp = (a.memo ?? '').localeCompare(b.memo ?? ''); break
        case 'method': {
          const ma = a.kind === 'expense' ? a.method : ''
          const mb = b.kind === 'expense' ? b.method : ''
          cmp = ma.localeCompare(mb); break
        }
        case 'member': cmp = (a.member ?? '').localeCompare(b.member ?? ''); break
        case 'amount': cmp = a.amount - b.amount; break
      }
      if (cmp !== 0) return dir * cmp
      const dateCmp = b.date.localeCompare(a.date)
      return dateCmp !== 0 ? dateCmp : b.amount - a.amount
    })
    return combined
  }, [allExpenses, allIncomes, query, category, month, typeFilter, sortKey, sortDir, excludeLoan])

  useEffect(() => { setPage(1) }, [query, category, month, selectedYear, typeFilter])

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = results.slice((safePage - 1) * pageSize, safePage * pageSize)

  const sortIcon = (key: SortKey) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'
  const thClass = 'text-left py-2 px-3 text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600 select-none'

  async function handleDelete() {
    if (!editItem) return
    if (!confirm('삭제하시겠습니까?')) return
    const url = editItem.kind === 'expense' ? `/api/expenses/${editItem.id}` : `/api/incomes/${editItem.id}`
    await fetch(url, { method: 'DELETE' })
    setEditItem(null)
    // Refresh caches
    if (editItem.kind === 'expense') {
      fetchedExpRef.current.delete(editItem.year)
      fetchExpYear(editItem.year)
    } else {
      fetchedIncRef.current.delete(editItem.year)
      fetchIncYear(editItem.year)
    }
  }

  function handleSaved() {
    if (!editItem) return
    setEditItem(null)
    if (editItem.kind === 'expense') {
      fetchedExpRef.current.delete(editItem.year)
      fetchExpYear(editItem.year)
    } else {
      fetchedIncRef.current.delete(editItem.year)
      fetchIncYear(editItem.year)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>검색</h1>
          <p className="text-xs text-slate-400 mt-0.5">전체 수입·지출 내역 검색</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-5">
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
            className="flex-1 min-w-48 border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-[#1A237E] transition-colors"
          />
          <select value={selectedYear} onChange={(e) => handleYearChange(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none">
            <option value="all">전체</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          {/* 유형 필터 */}
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as 'all' | 'expense' | 'income')}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none">
            <option value="all">전체유형</option>
            <option value="expense">지출</option>
            <option value="income">수입</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none">
            <option>전체</option>
            {allCategories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none">
            {MONTH_OPTIONS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm text-slate-400 mb-4">
          {loading ? '로딩 중...' : `검색 결과 ${results.length.toLocaleString()}건`}
        </p>
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}</div>
        ) : results.length === 0 ? (
          <p className="text-center text-slate-400 py-12">검색 결과가 없습니다</p>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden">
              <div className="flex gap-2 mb-3 flex-wrap">
                {(['date', 'category', 'detail', 'amount'] as const).map(key => (
                  <button key={key} onClick={() => handleSort(key)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors ${sortKey !== key ? 'bg-slate-100 text-slate-500' : ''}`}
                    style={sortKey === key ? { background: '#1A237E', color: '#fff' } : undefined}>
                    {{ date: '날짜', category: '분류', detail: '내역', amount: '금액' }[key]}{sortIcon(key)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {slice.map((item, i) => {
                  const isExpense = item.kind === 'expense'
                  const label = isExpense ? item.detail : item.description
                  const incomeColor = !isExpense ? (INCOME_COLORS[item.category] ?? '#5A6476') : undefined
                  return (
                    <button key={i} onClick={() => setEditItem(item)}
                      className={`w-full text-left border rounded-xl p-3 hover:shadow-sm transition-all ${isExpense ? 'border-slate-100 hover:border-slate-300' : 'border-l-4 border-slate-100 hover:border-slate-200'}`}
                      style={!isExpense ? { borderLeftColor: incomeColor } : undefined}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isExpense
                            ? <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={catBadgeStyle(item.category)}>{item.category}</span>
                            : <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: incomeColor }}>{item.category}</span>
                          }
                          {label && <span className="text-xs text-slate-700">{label}</span>}
                        </div>
                        <span className="font-semibold text-sm shrink-0 ml-2" style={!isExpense ? { color: incomeColor } : { color: '#1e293b' }}>{formatWonFull(item.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{item.date}</span>
                        <div className="flex items-center gap-2">
                          {isExpense && item.method && <span>{item.method}</span>}
                          {item.member && <span className={`font-bold px-1.5 py-0.5 rounded ${item.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>{item.member}</span>}
                        </div>
                      </div>
                      {item.memo && <p className="text-xs text-slate-400 mt-1 break-words">{item.memo}</p>}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={thClass} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                    <th className={thClass}>유형</th>
                    <th className={thClass} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                    <th className={thClass} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
                    <th className={thClass} onClick={() => handleSort('memo')}>비고{sortIcon('memo')}</th>
                    <th className={thClass} onClick={() => handleSort('method')}>결제수단{sortIcon('method')}</th>
                    <th className={thClass} onClick={() => handleSort('member')}>작성자{sortIcon('member')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((item, i) => {
                    const isExpense = item.kind === 'expense'
                    const label = isExpense ? item.detail : item.description
                    const incomeColor = !isExpense ? (INCOME_COLORS[item.category] ?? '#5A6476') : undefined
                    return (
                      <tr key={i} onClick={() => setEditItem(item)}
                        className={`border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                        <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{item.date}</td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpense ? 'bg-slate-100 text-slate-500' : 'text-white'}`}
                            style={!isExpense ? { backgroundColor: incomeColor } : undefined}>
                            {isExpense ? '지출' : '수입'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {isExpense
                            ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(item.category)}>{item.category}</span>
                            : <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: incomeColor }}>{item.category}</span>
                          }
                        </td>
                        <td className="py-2 px-3">
                          {label
                            ? <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{label}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px]">
                          {item.memo ? <span className="block truncate" title={item.memo}>{item.memo}</span> : <span className="text-slate-200">—</span>}
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-xs">
                          {isExpense && item.method ? item.method : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 px-3">
                          {item.member
                            ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>{item.member}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-xs whitespace-nowrap"
                          style={!isExpense ? { color: incomeColor } : { color: '#1e293b' }}>
                          {formatWonFull(item.amount)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>총 {results.length.toLocaleString()}건</span>
                <span className="text-slate-200">|</span>
                <span>페이지당</span>
                {PAGE_SIZES.map(size => (
                  <button key={size} onClick={() => { setPageSize(size); setPage(1) }}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${pageSize !== size ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'font-semibold'}`}
                    style={pageSize === size ? { background: '#1A237E', color: '#fff' } : undefined}>{size}</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30">처음</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30">이전</button>
                <span className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30">다음</button>
                <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30">끝</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit modals */}
      {editItem?.kind === 'expense' && (
        <ExpenseEditModal record={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} onDelete={handleDelete} />
      )}
      {editItem?.kind === 'income' && (
        <IncomeEditModal record={editItem} onClose={() => setEditItem(null)} onSaved={handleSaved} onDelete={handleDelete} />
      )}
    </div>
  )
}
