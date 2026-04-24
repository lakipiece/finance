'use client'

import { useState, useEffect, useCallback } from 'react'
import ExpenseInputForm, { type ExpenseItemForEdit } from '@/components/ExpenseInputForm'
import { catBadgeStyle, formatWonFull } from '@/lib/utils'
import { tbl, btn } from '@/lib/styles'
import { useSearchParams, useRouter } from 'next/navigation'

interface IncomeItem {
  id: number
  expense_date: string
  year: number
  month: number
  category: string
  detail: string
  method: string
  member: string
  amount: number
  memo: string
}

export default function ExpenseInputPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const editId = searchParams.get('edit')

  const [editItem, setEditItem] = useState<ExpenseItemForEdit | null>(null)
  const [expenses, setExpenses] = useState<IncomeItem[]>([])
  const [loading, setLoading] = useState(true)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const fetchExpenses = useCallback(() => {
    setLoading(true)
    fetch(`/api/expenses?year=${currentYear}&month=${currentMonth}`)
      .then(r => r.json())
      .then(data => setExpenses(data.expenses ?? []))
      .finally(() => setLoading(false))
  }, [currentYear, currentMonth])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  // 수정 모드: URL에 edit 파라미터가 있으면 해당 항목 로드
  useEffect(() => {
    if (!editId) { setEditItem(null); return }
    fetch(`/api/expenses/${editId}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setEditItem(data)
      })
      .catch(() => {})
  }, [editId])

  function handleSaved() {
    fetchExpenses()
    if (editItem) {
      router.replace('/expenses/input')
      setEditItem(null)
    }
  }

  function handleEdit(e: IncomeItem) {
    setEditItem({
      id: e.id,
      expense_date: e.expense_date,
      category: e.category,
      detail: e.detail,
      method: e.method,
      member: e.member,
      amount: e.amount,
      memo: e.memo,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: number) {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchExpenses()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>지출 입력</h1>
        <p className="text-xs text-slate-400 mt-0.5">{currentYear}년 {currentMonth}월</p>
      </div>

      <ExpenseInputForm
        editItem={editItem}
        onSaved={handleSaved}
        onCancelEdit={() => { setEditItem(null); router.replace('/expenses/input') }}
      />

      {/* 이번 달 내역 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">{currentMonth}월 지출 내역</h2>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-50 rounded-lg animate-pulse" />)}
          </div>
        ) : expenses.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">이번 달 지출 내역이 없습니다.</p>
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {expenses.map(e => (
                <div key={e.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                      {e.detail && <span className="text-xs text-slate-600">{e.detail}</span>}
                    </div>
                    <span className="font-semibold text-slate-800 text-sm">{formatWonFull(e.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{e.expense_date}</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(e)} className="text-blue-400 hover:text-blue-600">수정</button>
                      <button onClick={() => handleDelete(e.id)} className="text-rose-400 hover:text-rose-600">삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className={tbl.th}>날짜</th>
                    <th className={tbl.th}>분류</th>
                    <th className={tbl.th}>내역</th>
                    <th className={tbl.th}>사용자</th>
                    <th className={tbl.th}>결제수단</th>
                    <th className={tbl.thRight}>금액</th>
                    <th className={tbl.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 1 ? tbl.rowOdd : tbl.rowEven}>
                      <td className="py-2 px-3 text-xs text-slate-400 whitespace-nowrap">{e.expense_date}</td>
                      <td className="py-2 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(e.category)}>{e.category}</span>
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-600">{e.detail || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-3">
                        {e.member ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            e.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                          }`}>{e.member}</span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="py-2 px-3 text-xs text-slate-400">{e.method || <span className="text-slate-300">—</span>}</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-800 text-xs whitespace-nowrap">{formatWonFull(e.amount)}</td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => handleEdit(e)} className={btn.ghost} style={{ padding: '2px 8px', fontSize: 11 }}>수정</button>
                          <button onClick={() => handleDelete(e.id)} className="px-2 py-0.5 rounded text-[11px] text-rose-400 hover:bg-rose-50 transition-colors">삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
