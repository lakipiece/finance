'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull, catBadgeStyle } from '@/lib/utils'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  initialExpenses: ExpenseItem[]
  initialYear: number
  availableYears: number[]
}

const MONTH_OPTIONS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const PAGE_SIZES = [20, 50, 100] as const

type SortKey = 'date' | 'category' | 'detail' | 'memo' | 'method' | 'amount'
type SortDir = 'asc' | 'desc'

export default function SearchClient({ initialExpenses, initialYear, availableYears }: Props) {
  const { excludeLoan } = useFilter()

  const [yearCache, setYearCache] = useState<Record<number, ExpenseItem[]>>({ [initialYear]: initialExpenses })
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef<Set<number>>(new Set([initialYear]))

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [month, setMonth] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  const fetchYear = useCallback(async (year: number) => {
    if (fetchedRef.current.has(year)) return
    fetchedRef.current.add(year)
    setLoading(true)
    try {
      const res = await fetch(`/api/year-data?year=${year}`)
      if (res.ok) {
        const data = await res.json()
        setYearCache(prev => ({ ...prev, [year]: data?.allExpenses ?? [] }))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    availableYears.forEach(y => fetchYear(y))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleYearChange(value: string) {
    if (value === 'all') {
      setSelectedYear('all')
    } else {
      const y = Number(value)
      setSelectedYear(y)
      fetchYear(y)
    }
    setPage(1)
  }

  const allExpenses = useMemo(
    () => selectedYear === 'all'
      ? Object.values(yearCache).flat()
      : yearCache[selectedYear] ?? [],
    [selectedYear, yearCache]
  )

  const activeCategories = useMemo(() =>
    excludeLoan ? CATEGORIES.filter(c => c !== '대출상환') : CATEGORIES,
    [excludeLoan]
  )

  const baseExpenses = useMemo(() =>
    excludeLoan ? allExpenses.filter(e => e.category !== '대출상환') : allExpenses,
    [allExpenses, excludeLoan]
  )

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const monthNum = month === '전체' ? null : parseInt(month)
    const filtered = baseExpenses.filter((e) => {
      if (q && !e.detail.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q) && !e.memo.toLowerCase().includes(q)) return false
      if (category !== '전체' && e.category !== category) return false
      if (monthNum !== null && e.month !== monthNum) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'date': cmp = a.date.localeCompare(b.date); break
        case 'category': cmp = a.category.localeCompare(b.category); break
        case 'detail': cmp = a.detail.localeCompare(b.detail); break
        case 'memo': cmp = a.memo.localeCompare(b.memo); break
        case 'method': cmp = a.method.localeCompare(b.method); break
        case 'amount': cmp = a.amount - b.amount; break
      }
      if (cmp !== 0) return dir * cmp
      const dateCmp = b.date.localeCompare(a.date)
      return dateCmp !== 0 ? dateCmp : b.amount - a.amount
    })
    return filtered
  }, [baseExpenses, query, category, month, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [query, category, month, selectedYear])

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = results.slice((safePage - 1) * pageSize, safePage * pageSize)

  const sortIcon = (key: SortKey) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'
  const thClass = 'text-left py-2 px-3 text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600 select-none'

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>검색</h1>
          <p className="text-xs text-slate-400 mt-0.5">전체 지출 내역 검색</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-5 py-4 mb-6">
        <div className="flex flex-wrap items-end gap-5">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
            className="flex-1 min-w-48 border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-[#1A237E] transition-colors"
          />
          <select
            value={selectedYear}
            onChange={(e) => handleYearChange(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none"
          >
            <option value="all">전체</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none"
          >
            <option>전체</option>
            {activeCategories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 focus:outline-none focus:border-[#1A237E] transition-colors appearance-none"
          >
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
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : results.length === 0 ? (
          <p className="text-center text-slate-400 py-12">검색 결과가 없습니다</p>
        ) : (
          <>
            {/* Mobile: sort buttons + card list */}
            <div className="md:hidden">
              <div className="flex gap-2 mb-3 flex-wrap">
                {(['date', 'category', 'detail', 'amount'] as const).map(key => (
                  <button
                    key={key}
                    onClick={() => handleSort(key)}
                    className={`px-2 py-1 rounded-lg text-xs transition-colors ${sortKey !== key ? 'bg-slate-100 text-slate-500' : ''}`}
                    style={sortKey === key ? { background: '#1A237E', color: '#fff' } : undefined}
                  >
                    {{ date: '날짜', category: '분류', detail: '내역', amount: '금액' }[key]}{sortIcon(key)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {slice.map((e, i) => (
                  <div key={`${e.date}-${e.detail}-${e.amount}-${i}`} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                        {e.detail && <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>}
                      </div>
                      <span className="font-semibold text-slate-800 text-sm shrink-0 ml-2">{formatWonFull(e.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{e.date}</span>
                      <span>{e.method}</span>
                    </div>
                    {e.memo && <p className="text-xs text-slate-400 mt-1 break-words">{e.memo}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={thClass} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                    <th className={thClass} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                    <th className={thClass} onClick={() => handleSort('detail')}>내역{sortIcon('detail')}</th>
                    <th className={thClass} onClick={() => handleSort('memo')}>비고{sortIcon('memo')}</th>
                    <th className={thClass} onClick={() => handleSort('method')}>결제수단{sortIcon('method')}</th>
                    <th className={`${thClass} text-right`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((e, i) => (
                    <tr key={`${e.date}-${e.detail}-${e.amount}-${i}`} className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                      <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                      </td>
                      <td className="py-2 px-3">
                        {e.detail ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{e.detail}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px]">
                        {e.memo ? <span className="block truncate" title={e.memo}>{e.memo}</span> : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">{formatWonFull(e.amount)}</td>
                    </tr>
                  ))}
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
                  <button
                    key={size}
                    onClick={() => { setPageSize(size); setPage(1) }}
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${pageSize !== size ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'font-semibold'}`}
                    style={pageSize === size ? { background: '#1A237E', color: '#fff' } : undefined}
                  >{size}</button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">처음</button>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">이전</button>
                <span className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">다음</button>
                <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed">끝</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
