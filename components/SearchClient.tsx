'use client'

import { useState, useMemo } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { CATEGORIES, formatWonFull, CAT_BADGE } from '@/lib/utils'

interface Props {
  allExpenses: ExpenseItem[]
}

const MONTH_OPTIONS = ['전체', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

export default function SearchClient({ allExpenses }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [month, setMonth] = useState('전체')
  const [year, setYear] = useState('전체')

  const availableYears = useMemo(() => {
    const years = [...new Set(allExpenses.map(e => e.year))].sort()
    return years
  }, [allExpenses])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const monthNum = month === '전체' ? null : MONTH_OPTIONS.indexOf(month)
    const yearNum = year === '전체' ? null : Number(year)
    return allExpenses.filter((e) => {
      if (q && !e.detail.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q)) return false
      if (category !== '전체' && e.category !== category) return false
      if (monthNum !== null && e.month !== monthNum) return false
      if (yearNum !== null && e.year !== yearNum) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
  }, [allExpenses, query, category, month, year])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="내역 / 분류 / 결제수단 검색..."
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
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
                  <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
                </tr>
              </thead>
              <tbody>
                {results.map((e, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                        {e.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-700">{e.detail || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 px-3 text-slate-400">{e.method || <span className="text-slate-300">—</span>}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatWonFull(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
