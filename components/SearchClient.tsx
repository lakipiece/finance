'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull, CAT_BADGE } from '@/lib/utils'
import { useFilter } from '@/lib/FilterContext'

interface Props {
  allExpenses: ExpenseItem[]
}

const MONTH_OPTIONS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const PAGE_SIZES = [20, 50, 100] as const

type SortKey = 'date' | 'category' | 'detail' | 'memo' | 'method' | 'amount'
type SortDir = 'asc' | 'desc'

export default function SearchClient({ allExpenses }: Props) {
  const { excludeLoan } = useFilter()
  const baseExpenses = useMemo(() =>
    excludeLoan ? allExpenses.filter(e => e.category !== '대출상환') : allExpenses,
    [allExpenses, excludeLoan]
  )
  const activeCategories = useMemo(() =>
    excludeLoan ? CATEGORIES.filter(c => c !== '대출상환') : CATEGORIES,
    [excludeLoan]
  )
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [month, setMonth] = useState('전체')
  const [year, setYear] = useState('전체')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  const availableYears = useMemo(() => {
    const years = [...new Set(baseExpenses.map(e => e.year))].sort()
    return years
  }, [baseExpenses])

  const initializedRef = useRef(false)

  useEffect(() => {
    if (!initializedRef.current && availableYears.length > 0) {
      initializedRef.current = true
      setYear(String(availableYears[availableYears.length - 1]))
    }
  }, [availableYears])

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
    const yearNum = year === '전체' ? null : Number(year)
    const filtered = baseExpenses.filter((e) => {
      if (q && !e.detail.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q) && !e.memo.toLowerCase().includes(q)) return false
      if (category !== '전체' && e.category !== category) return false
      if (monthNum !== null && e.month !== monthNum) return false
      if (yearNum !== null && e.year !== yearNum) return false
      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    filtered.sort((a, b) => {
      switch (sortKey) {
        case 'date': return dir * a.date.localeCompare(b.date)
        case 'category': return dir * a.category.localeCompare(b.category)
        case 'detail': return dir * a.detail.localeCompare(b.detail)
        case 'memo': return dir * a.memo.localeCompare(b.memo)
        case 'method': return dir * a.method.localeCompare(b.method)
        case 'amount': return dir * (a.amount - b.amount)
        default: return 0
      }
    })
    return filtered
  }, [allExpenses, query, category, month, year, sortKey, sortDir])

  useEffect(() => { setPage(1) }, [query, category, month, year])

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = results.slice((safePage - 1) * pageSize, safePage * pageSize)

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  const thClass = 'text-left py-2 px-3 text-xs text-slate-400 font-medium cursor-pointer hover:text-slate-600 select-none'

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 / 비고 검색..."
            className="flex-1 min-w-48 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="전체">전체 연도</option>
            {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option>전체</option>
            {activeCategories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {MONTH_OPTIONS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <p className="text-sm text-slate-400 mb-4">검색 결과 {results.length.toLocaleString()}건</p>
        {results.length === 0 ? (
          <p className="text-center text-slate-400 py-12">검색 결과가 없습니다</p>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                          {e.category}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        {e.detail ? (
                          <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">{e.detail}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs max-w-[200px]">
                        {e.memo ? (
                          <span className="block truncate" title={e.memo}>{e.memo}</span>
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">
                        {formatWonFull(e.amount)}
                      </td>
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
                    className={`px-2 py-0.5 rounded text-xs transition-colors ${
                      pageSize === size
                        ? 'bg-slate-700 text-white font-semibold'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {size}
                  </button>
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
