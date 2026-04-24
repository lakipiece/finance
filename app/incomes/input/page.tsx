'use client'

import { useState, useEffect, useCallback } from 'react'
import IncomeInputForm, { type IncomeItemForEdit } from '@/components/IncomeInputForm'
import { INCOME_COLORS, formatWonFull } from '@/lib/utils'
import { tbl, btn } from '@/lib/styles'
import { useRouter } from 'next/navigation'

interface IncomeRow {
  id: number
  income_date: string
  year: number
  month: number
  category: string
  description: string
  amount: number
  member: string | null
}

export default function IncomeInputPage() {
  const router = useRouter()

  const [editItem, setEditItem] = useState<IncomeItemForEdit | null>(null)
  const [incomes, setIncomes] = useState<IncomeRow[]>([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const fetchIncomes = useCallback(() => {
    setLoading(true)
    fetch(`/api/incomes?year=${currentYear}&month=${currentMonth}`)
      .then(r => r.json())
      .then(data => setIncomes(Array.isArray(data) ? data : (data.incomes ?? [])))
      .finally(() => setLoading(false))
  }, [currentYear, currentMonth])

  useEffect(() => {
    fetchIncomes()
  }, [fetchIncomes])

  function handleSaved() {
    fetchIncomes()
    if (editItem) {
      setEditItem(null)
    }
  }

  function handleEdit(item: IncomeRow) {
    setEditItem({
      id: item.id,
      income_date: item.income_date,
      category: item.category,
      description: item.description,
      amount: item.amount,
      member: item.member ?? 'L',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/incomes/${id}`, { method: 'DELETE' })
    fetchIncomes()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>수입 입력</h1>
        <p className="text-xs text-slate-400 mt-0.5">{currentYear}년 {currentMonth}월</p>
      </div>

      <IncomeInputForm
        editItem={editItem}
        onSaved={handleSaved}
        onCancelEdit={() => setEditItem(null)}
      />

      {/* 이번 달 수입 내역 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">{currentMonth}월 수입 내역</h2>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
          </div>
        ) : incomes.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">이번 달 수입 내역이 없습니다.</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {incomes.map(item => {
                const color = INCOME_COLORS[item.category] ?? '#64748b'
                return (
                  <div key={item.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: color }}
                        >
                          {item.category}
                        </span>
                        <span className="text-xs text-slate-600">{item.description}</span>
                      </div>
                      <span className="font-semibold text-slate-800 text-sm">{formatWonFull(item.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{item.income_date}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(item)} className="text-blue-400 hover:text-blue-600">수정</button>
                        <button onClick={() => handleDelete(item.id)} className="text-rose-400 hover:text-rose-600">삭제</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={tbl.th}>날짜</th>
                    <th className={tbl.th}>카테고리</th>
                    <th className={tbl.th}>설명</th>
                    <th className={tbl.th}>작성자</th>
                    <th className={tbl.thRight}>금액</th>
                    <th className={tbl.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {incomes.map((item, i) => {
                    const color = INCOME_COLORS[item.category] ?? '#64748b'
                    return (
                      <tr key={item.id} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                        <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">{item.income_date}</td>
                        <td className="py-2 px-3">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                            style={{ backgroundColor: color }}
                          >
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
                        <td className="py-2 px-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => handleEdit(item)} className={btn.ghost} style={{ padding: '2px 8px', fontSize: 11 }}>수정</button>
                            <button onClick={() => handleDelete(item.id)} className="px-2 py-0.5 rounded text-[11px] text-rose-400 hover:bg-rose-50 transition-colors">삭제</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
