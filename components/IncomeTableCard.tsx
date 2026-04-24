'use client'

import { useState, useMemo } from 'react'
import { formatWonFull, INCOME_COLORS } from '@/lib/utils'
import { tbl } from '@/lib/styles'

export interface IncomeRow {
  id: number
  income_date: string
  year: number
  month: number
  category: string
  description: string
  amount: number
  member: string | null
}

const PAGE_SIZES = [20, 50, 100] as const

export default function IncomeTableCard({
  incomes,
  loading,
}: {
  incomes: IncomeRow[] | null
  loading: boolean
}) {
  const [sortKey, setSortKey] = useState<'date' | 'category' | 'description' | 'amount'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'amount' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  const sortIcon = (key: string) => sortKey !== key ? ' ↕' : sortDir === 'asc' ? ' ↑' : ' ↓'

  const tableData = useMemo(() => {
    if (!incomes) return []
    let result = [...incomes]
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(e =>
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      )
    }
    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'date': cmp = a.income_date.localeCompare(b.income_date); break
        case 'category': cmp = a.category.localeCompare(b.category); break
        case 'description': cmp = a.description.localeCompare(b.description); break
        case 'amount': cmp = a.amount - b.amount; break
      }
      if (cmp !== 0) return dir * cmp
      return b.income_date.localeCompare(a.income_date)
    })
    return result
  }, [incomes, searchQuery, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(tableData.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = tableData.slice((safePage - 1) * pageSize, safePage * pageSize)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-base font-semibold text-slate-700">수입 내역</h3>
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
          placeholder="검색..."
          className="w-44 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-300 bg-white"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['date', 'category', 'description', 'amount'] as const).map(key => (
                <button
                  key={key}
                  onClick={() => handleSort(key)}
                  className={`px-2 py-1 rounded-lg text-xs transition-colors ${sortKey !== key ? 'bg-slate-100 text-slate-500' : ''}`}
                  style={sortKey === key ? { background: '#1A237E', color: '#fff' } : undefined}
                >
                  {{ date: '날짜', category: '분류', description: '설명', amount: '금액' }[key]}{sortIcon(key)}
                </button>
              ))}
            </div>
            {slice.map(item => {
              const color = INCOME_COLORS[item.category] ?? '#64748b'
              return (
                <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: color }}>
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-600">{item.description}</span>
                    </div>
                    <span className="font-semibold text-slate-800 text-sm">{formatWonFull(item.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{item.income_date}</span>
                    {item.member && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        item.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                      }`}>{item.member}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className={tbl.th}>#</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('date')}>날짜{sortIcon('date')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('category')}>분류{sortIcon('category')}</th>
                  <th className={`${tbl.th} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('description')}>설명{sortIcon('description')}</th>
                  <th className={tbl.th}>작성자</th>
                  <th className={`${tbl.thRight} cursor-pointer hover:text-slate-600 select-none`} onClick={() => handleSort('amount')}>금액{sortIcon('amount')}</th>
                </tr>
              </thead>
              <tbody>
                {slice.map((item, i) => {
                  const color = INCOME_COLORS[item.category] ?? '#64748b'
                  return (
                    <tr key={item.id} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                      <td className="py-2 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs whitespace-nowrap">{item.income_date}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: color }}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-600">{item.description}</td>
                      <td className="py-2 px-3">
                        {item.member ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            item.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                          }`}>{item.member}</span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">{formatWonFull(item.amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>총 {tableData.length.toLocaleString()}건</span>
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
              <button onClick={() => setPage(1)} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">처음</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">이전</button>
              <span className="px-3 py-1 text-xs text-slate-600 font-medium">{safePage} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">다음</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed">끝</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
