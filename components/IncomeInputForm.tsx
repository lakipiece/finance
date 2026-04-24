'use client'

import { useState, useEffect } from 'react'
import { btn, field } from '@/lib/styles'
import { INCOME_CATEGORIES } from '@/lib/utils'
import { useTheme } from '@/lib/ThemeContext'

export interface IncomeItemForEdit {
  id: number
  income_date: string
  category: string
  description: string
  amount: number
  member: string
}

interface Props {
  editItem?: IncomeItemForEdit | null
  onSaved: () => void
  onCancelEdit?: () => void
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function IncomeInputForm({ editItem, onSaved, onCancelEdit }: Props) {
  const { palette } = useTheme()
  const [date, setDate] = useState(todayStr)
  const [category, setCategory] = useState<string>('급여')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [member, setMember] = useState<'L' | 'P'>('L')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editItem) {
      setDate(editItem.income_date)
      setCategory(editItem.category)
      setDescription(editItem.description)
      setAmount(String(editItem.amount))
      setMember((editItem.member === 'P' ? 'P' : 'L') as 'L' | 'P')
    } else {
      setDate(todayStr())
      setCategory('급여')
      setDescription('')
      setAmount('')
      setMember('L')
    }
    setError(null)
  }, [editItem])

  async function handleSave() {
    const parsedAmount = Number(amount.replace(/,/g, ''))
    if (!date || !category || !description || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('모든 필드를 올바르게 입력해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { income_date: date, category, description, amount: parsedAmount, member }
      const url = editItem ? `/api/incomes/${editItem.id}` : '/api/incomes'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '저장 실패')
      }
      onSaved()
      if (!editItem) {
        setDate(todayStr())
        setDescription('')
        setAmount('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
      <h2 className="text-sm font-semibold text-slate-800">
        {editItem ? '수입 수정' : '수입 입력'}
      </h2>

      {/* 날짜 */}
      <div>
        <label className={field.label}>날짜</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field.input} required />
      </div>

      {/* 카테고리 */}
      <div>
        <label className={field.label}>카테고리</label>
        <select value={category} onChange={e => setCategory(e.target.value)} className={`${field.select} w-full`}>
          {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* 설명 */}
      <div>
        <label className={field.label}>설명</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="수입 내용을 입력하세요"
          className={field.input}
          required
        />
      </div>

      {/* 금액 */}
      <div>
        <label className={field.label}>금액 (원)</label>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0"
          className={`${field.input} text-right`}
          required
        />
      </div>

      {/* 작성자 */}
      <div>
        <label className={field.label}>작성자</label>
        <div className="flex gap-2 mt-1">
          {(['L', 'P'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMember(m)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                member === m ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400'
              }`}
              style={member === m ? { backgroundColor: palette.colors[0] } : undefined}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs text-rose-400">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        {editItem && onCancelEdit ? (
          <button type="button" onClick={onCancelEdit} className={btn.secondary}>취소</button>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className={btn.primary}
          style={{ backgroundColor: palette.colors[0] }}
        >
          {saving ? '저장 중...' : (editItem ? '수정' : '저장')}
        </button>
      </div>
    </div>
  )
}
