'use client'

import { useEffect, useState } from 'react'
import type { ExpenseItem } from '@/lib/types'
import { formatWonFull, CAT_BADGE } from '@/lib/utils'
import { tbl } from '@/lib/styles'

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
      {/* 모바일 카드 뷰 */}
      <div className="sm:hidden space-y-2 mb-4">
        {slice.map((e, i) => (
          <div
            key={`${e.date}-${e.detail}-${e.amount}-${i}`}
            className={`border border-slate-100 rounded-xl px-4 py-3 ${i % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                  {e.category}
                </span>
                {e.detail && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 truncate max-w-[140px]">
                    {e.detail}
                  </span>
                )}
                {e.member && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    e.member === 'L' ? 'bg-blue-50 text-blue-600' :
                    e.member === 'P' ? 'bg-pink-50 text-pink-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>{e.member}</span>
                )}
              </div>
              <span className="font-semibold text-slate-800 text-sm shrink-0 tabular-nums">
                {formatWonFull(e.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="tabular-nums">{e.date}</span>
              {e.method && <span>{e.method}</span>}
            </div>
            {e.memo && (
              <p className="text-xs text-slate-400 mt-1 truncate" title={e.memo}>{e.memo}</p>
            )}
          </div>
        ))}
      </div>

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className={tbl.th}>#</th>
              <th className={tbl.th}>날짜</th>
              <th className={tbl.th}>분류</th>
              <th className={tbl.th}>내역</th>
              <th className={tbl.th}>비고</th>
              <th className={tbl.th}>결제수단</th>
              <th className={tbl.th}>사용자</th>
              <th className={tbl.thRight}>금액</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((e, i) => (
              <tr
                key={`${e.date}-${e.detail}-${e.amount}-${i}`}
                className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}
              >
                <td className="py-2.5 px-3 text-slate-300 text-xs">{(safePage - 1) * pageSize + i + 1}</td>
                <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">{e.date}</td>
                <td className="py-2.5 px-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CAT_BADGE[e.category] ?? 'bg-slate-100 text-slate-600'}`}>
                    {e.category}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {e.detail ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">{e.detail}</span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-xs max-w-[200px]">
                  {e.memo ? (
                    <span
                      className="block truncate"
                      title={e.memo}
                    >
                      {e.memo}
                    </span>
                  ) : (
                    <span className="text-slate-200">—</span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-slate-400 text-xs">{e.method || <span className="text-slate-300">—</span>}</td>
                <td className="py-2 px-3">
                  {e.member ? (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      e.member === 'L' ? 'bg-blue-50 text-blue-600' :
                      e.member === 'P' ? 'bg-pink-50 text-pink-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>{e.member}</span>
                  ) : <span className="text-slate-300 text-xs">-</span>}
                </td>
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
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            처음
          </button>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="px-3 py-1 text-xs text-slate-600 font-medium">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={safePage === totalPages}
            className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            끝
          </button>
        </div>
      </div>
    </div>
  )
}
