'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS } from '@/lib/utils'
import YearMonthPicker from '@/components/ui/YearMonthPicker'
import PageHeader from '@/components/ui/PageHeader'
import { field, color as tone } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'
import { DEFAULT_MEMBERS, DEFAULT_METHODS, FormCtx, MemberOpt, MethodOpt } from '@/components/input/shared'
import { AnyRecord, ExpenseCreateModal, ExpenseEditModal, ExpenseRecord, IncomeCreateModal, IncomeEditModal, IncomeRecord } from '@/components/input/modals'
import { CategoryBreakdown, RecordCard, SummaryCard } from '@/components/input/cards'

export default function InputPage() {
  const { palette, catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const [createType, setCreateType] = useState<'expense' | 'income' | null>(null)
  const [records, setRecords] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState<AnyRecord | null>(null)
  const [detailsByCategory, setDetailsByCategory] = useState<Record<string, string[]>>({})
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>(DEFAULT_MEMBERS)
  const [methodOpts, setMethodOpts] = useState<MethodOpt[]>(DEFAULT_METHODS)
  const [searchQuery, setSearchQuery] = useState('')
  // 전체기간 모드에서 실제로 서버 조회에 사용된 검색어 (버튼 클릭 시점에 확정)
  const [committedQuery, setCommittedQuery] = useState('')

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number | null>(now.getMonth() + 1)
  const [viewAllPeriod, setViewAllPeriod] = useState(false)

  useEffect(() => {
    fetch('/api/options/details').then(r => r.json()).then((data: { name: string; category: string }[]) => {
      if (Array.isArray(data)) {
        const grouped: Record<string, string[]> = {}
        for (const d of data) { const cat = d.category || '미분류'; (grouped[cat] ??= []).push(d.name) }
        setDetailsByCategory(grouped)
      }
    }).catch(() => {})
    fetch('/api/options/members').then(r => r.json()).then(data => { if (Array.isArray(data) && data.length) setMemberOpts(data) }).catch(() => {})
    fetch('/api/options/methods').then(r => r.json()).then((data: MethodOpt[]) => { if (Array.isArray(data) && data.length) setMethodOpts(data.map(m => ({ name: m.name, color: m.color ?? tone.ink5 }))) }).catch(() => {})
  }, [])

  const fetchData = useCallback(async (query: string) => {
    setLoading(true)
    const qs = viewAllPeriod
      ? `all=1&q=${encodeURIComponent(query.trim())}`
      : `year=${viewYear}${viewMonth !== null ? `&month=${viewMonth}` : ''}`
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/expenses?${qs}`),
      fetch(`/api/incomes?${qs}`),
    ])
    const [expData, incData] = await Promise.all([expRes.json(), incRes.json()])
    const expenses: ExpenseRecord[] = (expData.expenses ?? []).map((e: {
      id: number; expense_date: string; category: string; detail: string
      method: string; member: string; amount: number; memo: string
    }) => ({
      type: 'expense' as const, id: e.id, date: e.expense_date, category: e.category,
      detail: e.detail ?? '', method: e.method ?? '', member: e.member ?? '', amount: e.amount, memo: e.memo ?? '',
    }))
    const incomes: IncomeRecord[] = (Array.isArray(incData) ? incData : []).map((i: {
      id: number; income_date: string; category: string; description: string
      amount: number; member: string | null; memo: string
    }) => ({
      type: 'income' as const, id: i.id, date: i.income_date, category: i.category,
      description: i.description ?? '', amount: i.amount, member: i.member, memo: i.memo ?? '',
    }))
    const combined = [...expenses, ...incomes].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    setRecords(combined)
    setLoading(false)
  }, [viewYear, viewMonth, viewAllPeriod])

  // 월/년 모드: 기간 변경 시 자동 조회. 전체기간 모드: 자동 조회 없이 검색 버튼 대기.
  useEffect(() => {
    if (viewAllPeriod) {
      setRecords([])
      setCommittedQuery('')
      setSearchQuery('')
      setLoading(false)
      return
    }
    fetchData('')
  }, [fetchData, viewAllPeriod])

  function handleSearch() {
    const q = searchQuery.trim()
    setCommittedQuery(q)
    if (!q) { setRecords([]); return }
    fetchData(q)
  }

  function clearSearch() {
    setSearchQuery('')
    if (viewAllPeriod) { setCommittedQuery(''); setRecords([]) }
  }

  // 전체기간이면 마지막 검색어로, 아니면 현재 기간으로 재조회
  function refetch() {
    if (viewAllPeriod) {
      const q = committedQuery.trim()
      if (q) fetchData(q)
    } else {
      fetchData('')
    }
  }

  // keepOpen이면 목록만 갱신하고 모달은 열어 둔다 (연속 입력)
  function handleSaved(keepOpen = false) {
    refetch()
    if (keepOpen) return
    setEditRecord(null)
    setCreateType(null)
  }

  async function handleDelete() {
    if (!editRecord) return
    if (!confirm('삭제하시겠습니까?')) return
    const url = editRecord.type === 'expense' ? `/api/expenses/${editRecord.id}` : `/api/incomes/${editRecord.id}`
    await fetch(url, { method: 'DELETE' })
    setEditRecord(null)
    refetch()
  }

  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [detailFilter, setDetailFilter] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')

  const visibleExpenseCategories = useMemo(
    () => CATEGORIES.filter(c => !(excludeLoan && c === '대출상환')),
    [excludeLoan]
  )

  const availableCategories = useMemo(() => {
    if (typeFilter === 'expense') return visibleExpenseCategories
    if (typeFilter === 'income') return INCOME_CATEGORIES as readonly string[]
    return [...visibleExpenseCategories, ...INCOME_CATEGORIES] as string[]
  }, [typeFilter, visibleExpenseCategories])

  // Base list before detailFilter (used for breakdown computation)
  const baseFilteredList = useMemo(() => {
    let list = records
    if (excludeLoan) list = list.filter(r => !(r.type === 'expense' && r.category === '대출상환'))
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter)
    if (categoryFilter) list = list.filter(r => r.category === categoryFilter)
    if (memberFilter) list = list.filter(r => r.member === memberFilter)
    // 전체기간 모드는 서버에서 이미 검색어로 필터링됨 → 클라 텍스트 필터 생략
    if (!viewAllPeriod && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(r => {
        const label = r.type === 'expense' ? ((r as ExpenseRecord).detail || r.category) : (r as IncomeRecord).description
        return label.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.memo ?? '').toLowerCase().includes(q) ||
          (r.member ?? '').toLowerCase().includes(q) ||
          r.date.includes(q) ||
          (r.type === 'expense' && (r as ExpenseRecord).method.toLowerCase().includes(q))
      })
    }
    return list
  }, [records, excludeLoan, typeFilter, categoryFilter, memberFilter, searchQuery, viewAllPeriod])

  const filteredRecords = useMemo(() => {
    let list = baseFilteredList
    if (detailFilter) {
      list = list.filter(r => {
        const key = r.type === 'expense'
          ? ((r as ExpenseRecord).detail || '(미분류)')
          : (r as IncomeRecord).description || '(미분류)'
        return key === detailFilter
      })
    }
    return [...list].sort((a, b) => {
      if (sortMode === 'date_asc') return a.date.localeCompare(b.date) || a.id - b.id
      if (sortMode === 'date_desc') return b.date.localeCompare(a.date) || b.id - a.id
      if (sortMode === 'amount_asc') return a.amount - b.amount
      if (sortMode === 'amount_desc') return b.amount - a.amount
      return 0
    })
  }, [baseFilteredList, detailFilter, sortMode])

  const expenseCount = filteredRecords.filter(r => r.type === 'expense').length
  const incomeCount = filteredRecords.filter(r => r.type === 'income').length
  const expenseTotal = filteredRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const incomeTotal = filteredRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)

  const breakdown = useMemo(() => {
    if (!categoryFilter) return []
    const total = baseFilteredList.reduce((s, r) => s + r.amount, 0)
    if (total === 0) return []
    const groups: Record<string, number> = {}
    for (const r of baseFilteredList) {
      const key = r.type === 'expense'
        ? ((r as ExpenseRecord).detail || '(미분류)')
        : (r as IncomeRecord).description || '(미분류)'
      groups[key] = (groups[key] ?? 0) + r.amount
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount, pct: amount / total }))
  }, [baseFilteredList, categoryFilter])

  return (
    <FormCtx.Provider value={{ memberOpts, methodOpts, detailsByCategory }}>
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="수입 지출 관리">
        <YearMonthPicker
          year={viewYear} month={viewMonth} allPeriod={viewAllPeriod}
          align="right"
          onChange={(y, m, all) => { setViewYear(y); setViewMonth(m); setViewAllPeriod(all) }}
        />
      </PageHeader>

      {/* Records */}
      <div className="bg-surface-card rounded-card shadow-card p-[13px]">
        {/* Header with search */}
        <div className="flex items-center justify-end mb-4 gap-2 flex-wrap">
          <div className="relative flex items-center">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder={viewAllPeriod ? '검색어 입력 후 검색' : '검색...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (viewAllPeriod && e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              className="pl-9 pr-9 rounded-field bg-surface-low py-[9px] text-subhead text-ink placeholder:text-ink-5 focus:outline-none focus:bg-surface-card focus:shadow-focus transition-colors w-48 border-0"
            />
            {searchQuery ? <button onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-5 hover:text-ink-3 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button> : null}
          </div>
          {viewAllPeriod ? (
            <button onClick={handleSearch}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn text-body font-bold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: tone.action }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              검색
            </button>
          ) : null}
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-surface-low mb-4">
          {/* Type filter */}
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setCategoryFilter(null); setDetailFilter(null) }}
                className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${typeFilter === t ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'}`}>
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Member filter */}
          <div className="flex gap-1">
            {memberOpts.map(m => {
              const isActive = memberFilter === m.code
              return (
                <button key={m.code} onClick={() => setMemberFilter(prev => prev === m.code ? null : m.code)}
                  className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${isActive ? 'text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'}`}
                  style={isActive ? { backgroundColor: m.color } : undefined}>
                  {m.display_name}
                </button>
              )
            })}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {availableCategories.map(cat => {
              const color = catColors[cat] ?? INCOME_COLORS[cat]
              const isActive = categoryFilter === cat
              return (
                <button key={cat} onClick={() => { setCategoryFilter(prev => prev === cat ? null : cat); setDetailFilter(null) }}
                  className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                    isActive ? 'text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
                  }`}
                  style={isActive && color ? { backgroundColor: color } : undefined}>
                  {cat}
                </button>
              )
            })}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Sort toggle buttons */}
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setSortMode(m => m === 'date_desc' ? 'date_asc' : 'date_desc')}
              className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                sortMode === 'date_desc' || sortMode === 'date_asc' ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
              }`}>
              날짜{sortMode === 'date_desc' ? ' ↓' : sortMode === 'date_asc' ? ' ↑' : ' ↕'}
            </button>
            <button
              onClick={() => setSortMode(m => m === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
              className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                sortMode === 'amount_desc' || sortMode === 'amount_asc' ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
              }`}>
              금액{sortMode === 'amount_desc' ? ' ↓' : sortMode === 'amount_asc' ? ' ↑' : ' ↕'}
            </button>
          </div>
        </div>

        {/* Category breakdown panel */}
        {categoryFilter && breakdown.length > 0 ? <CategoryBreakdown
            category={categoryFilter}
            items={breakdown}
            color={catColors[categoryFilter] ?? INCOME_COLORS[categoryFilter]}
            activeItem={detailFilter}
            onItemClick={name => setDetailFilter(prev => prev === name ? null : name)}
          /> : null}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-surface-low rounded-field animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              <SummaryCard expenseCount={expenseCount} expenseTotal={expenseTotal} incomeCount={incomeCount} incomeTotal={incomeTotal}
                onAddExpense={() => setCreateType('expense')} onAddIncome={() => setCreateType('income')} />
              {filteredRecords.map(r => (
                <RecordCard key={`${r.type}-${r.id}`} record={r} onClick={() => setEditRecord(r)} />
              ))}
            </div>
            {filteredRecords.length === 0 ? <p className="text-body text-ink-4 py-8 text-center">
                {viewAllPeriod
                  ? (committedQuery ? '검색 결과가 없습니다.' : '검색어를 입력하고 검색 버튼을 누르세요.')
                  : searchQuery ? '검색 결과가 없습니다.' : viewMonth ? `${viewMonth}월 내역이 없습니다.` : '내역이 없습니다.'}
              </p> : null}
          </>
        )}
      </div>

      {editRecord?.type === 'expense' ? <ExpenseEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} /> : null}
      {editRecord?.type === 'income' ? <IncomeEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} /> : null}
      {createType === 'expense' ? <ExpenseCreateModal onClose={() => setCreateType(null)} onSaved={handleSaved} /> : null}
      {createType === 'income' ? <IncomeCreateModal onClose={() => setCreateType(null)} onSaved={handleSaved} /> : null}
    </div>
    </FormCtx.Provider>
  )
}
