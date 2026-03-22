'use client'

import { useEffect, useState } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { formatWonFull, CAT_BADGE } from '@/lib/utils'

interface Props {
  expenses: ExpenseItem[]
  selectedCategory: string | null
  selectedDetail: string | null
}

const PAGE_SIZES = [20, 50, 100] as const

type SortMode = 'amount' | 'date'

export default function ExpenseTable({ expenses, selectedCategory, selectedDetail }: Props) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<20 | 50 | 100>(20)
  const [sortMode, setSortMode] = useState<SortMode>('amount')

  useEffect(() => { setPage(1) }, [selectedDetail, selectedCategory])

  const filtered = expenses.filter(e => {
    if (selectedCategory && e.category !== selectedCategory) return false
    if (selectedDetail && e.detail !== selectedDetail) return false
    return true
  }).sort((a, b) =>
    sortMode === 'amount' ? b.amount - a.amount : b.date.localeCompare(a.date)
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

  function handlePageSize(size: 20 | 50 | 100) {
    setPageSize(size)
    setPage(1)
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">#</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">날짜</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">분류</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">내역</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">비고</th>
              <th className="text-left py-2 px-3 text-xs text-slate-400 font-medium">결제수단</th>
              <th className="text-right py-2 px-3 text-xs text-slate-400 font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((e, i) => (
              <tr
                key={`${e.date}-${e.detail}-${e.amount}-${i}`}
                className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${i % 2 === 1 ? 'bg-slate-50/40' : ''}`}
              >
                <td className="py-2.5 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                    {e.category}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-slate-700">{e.detail || <span className="text-slate-300">—</span>}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[200px]">
                  {e.memo ? (
                    <span
                      className="block truncate"
                      title={e.memo.length > 20 ? e.memo : undefined}
                    >
                      {e.memo}
                    </span>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400">{e.method || <span className="text-slate-300">—</span>}</td>
                <td className="py-2.5 px-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                  {formatWonFull(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>총 {filtered.length.toLocaleString()}건</span>
          <span className="text-slate-200">|</span>
          {(['amount', 'date'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => { setSortMode(mode); setPage(1) }}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                sortMode === mode
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {mode === 'amount' ? '금액순' : '날짜순'}
            </button>
          ))}
          <span className="text-slate-200">|</span>
          <span>페이지당</span>
          {PAGE_SIZES.map(size => (
            <button
              key={size}
              onClick={() => handlePageSize(size)}
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
          <button
            onClick={() => setPage(1)}
            disabled={safePage === 1}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            처음
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="px-3 py-1 text-xs text-slate-600 font-medium">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            다음
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            끝
          </button>
        </div>
      </div>
    </div>
  )
}
