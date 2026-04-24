'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'

export interface IncomeItem {
  id: number
  income_date: string
  year: number
  month: number
  category: string
  description: string
  amount: number
  member: string | null
}

interface Props {
  show: boolean
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
  editItem?: IncomeItem | null
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function IncomeFormModal({ show, onClose, onSaved, palette, editItem }: Props) {
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState('급여')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [member, setMember] = useState<'L' | 'P'>('L')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 수정 모드: editItem 변경 시 폼 상태 업데이트
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
  }, [editItem, show])

  if (!show) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={modal.header}>
          <h2 className="text-sm font-semibold text-slate-800">
            {editItem ? '수입 수정' : '수입 입력'}
          </h2>
          <button onClick={onClose} className={modal.close} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <form onSubmit={handleSubmit} className={modal.body}>
          {/* 날짜 */}
          <div>
            <label className={field.label}>날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={field.input}
              required
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label className={field.label}>카테고리</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={`${field.select} w-full`}
            >
              <option value="급여">급여</option>
              <option value="보너스">보너스</option>
              <option value="기타">기타</option>
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
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              min={1}
              className={field.input}
              required
            />
          </div>

          {/* 작성자 토글 */}
          <div>
            <label className={field.label}>작성자</label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setMember('L')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  member === 'L'
                    ? 'text-white border-transparent'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
                style={member === 'L' ? { backgroundColor: palette.colors[0] } : undefined}
              >
                L
              </button>
              <button
                type="button"
                onClick={() => setMember('P')}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  member === 'P'
                    ? 'text-white border-transparent'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
                style={member === 'P' ? { backgroundColor: palette.colors[0] } : undefined}
              >
                P
              </button>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-rose-400">{error}</p>
          ) : null}
        </form>

        {/* 푸터 */}
        <div className={modal.footer}>
          <button type="button" onClick={onClose} className={btn.secondary}>
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={saving}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}
          >
            {saving ? '저장 중...' : (editItem ? '수정' : '저장')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
