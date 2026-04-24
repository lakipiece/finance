'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'

interface MemoRow {
  label: string
  amount: string
}

interface Props {
  show: boolean
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const CATEGORIES = ['고정비', '대출상환', '변동비', '여행공연비']

export default function ExpenseCreateModal({ show, onClose, onSaved, palette }: Props) {
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState('L')
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState('')
  const [mode, setMode] = useState<'direct' | 'items'>('direct')
  const [amount, setAmount] = useState('')
  const [memos, setMemos] = useState<MemoRow[]>([{ label: '', amount: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const totalFromMemos = memos.reduce(
    (s, m) => s + (parseInt(m.amount.replace(/,/g, '')) || 0),
    0
  )

  function updateMemoLabel(idx: number, value: string) {
    setMemos(prev => prev.map((m, i) => (i === idx ? { ...m, label: value } : m)))
  }

  function updateMemoAmount(idx: number, value: string) {
    setMemos(prev => prev.map((m, i) => (i === idx ? { ...m, amount: value } : m)))
  }

  function addMemoRow() {
    setMemos(prev => [...prev, { label: '', amount: '' }])
  }

  function removeMemoRow(idx: number) {
    setMemos(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setSaving(true)
    setErr('')
    try {
      const memoList =
        mode === 'items'
          ? memos
              .filter(m => m.label.trim())
              .map(m => ({
                label: m.label.trim(),
                amount: parseInt(m.amount.replace(/,/g, '')) || null,
              }))
          : []

      const directAmount =
        mode === 'direct'
          ? parseInt(amount.replace(/,/g, ''))
          : memoList.reduce((s, m) => s + (m.amount ?? 0), 0)

      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: date,
          category,
          detail: detail || null,
          method: method || null,
          member,
          amount: directAmount,
          memos: memoList,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
      onClose()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  return createPortal(
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={modal.container} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={modal.header}>
          <h3 className="text-sm font-semibold text-slate-800">지출 입력</h3>
          <button onClick={onClose} className={btn.icon}>✕</button>
        </div>

        {/* 바디 */}
        <div className={modal.body}>
          {/* 날짜 */}
          <div>
            <label className={field.label}>날짜</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={field.input}
            />
          </div>

          {/* 작성자 */}
          <div>
            <label className={field.label}>작성자</label>
            <div className="flex gap-1.5 mt-1">
              {['L', 'P'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMember(m)}
                  className={btn.pill(member === m)}
                  style={
                    member === m
                      ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] }
                      : undefined
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* 지출유형 */}
          <div>
            <label className={field.label}>지출유형</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={`${field.select} w-full`}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* 세부유형 */}
          <div>
            <label className={field.label}>세부유형</label>
            <input
              type="text"
              value={detail}
              onChange={e => setDetail(e.target.value)}
              placeholder="예: 식비, 교통비"
              className={field.input}
            />
          </div>

          {/* 결제수단 */}
          <div>
            <label className={field.label}>결제수단</label>
            <input
              type="text"
              value={method}
              onChange={e => setMethod(e.target.value)}
              placeholder="예: 신용카드, 현금"
              className={field.input}
            />
          </div>

          {/* 금액 모드 토글 */}
          <div>
            <label className={field.label}>금액 입력 방식</label>
            <div className="flex gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setMode('direct')}
                className={btn.pill(mode === 'direct')}
                style={
                  mode === 'direct'
                    ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] }
                    : undefined
                }
              >
                직접 입력
              </button>
              <button
                type="button"
                onClick={() => setMode('items')}
                className={btn.pill(mode === 'items')}
                style={
                  mode === 'items'
                    ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] }
                    : undefined
                }
              >
                항목별 입력
              </button>
            </div>
          </div>

          {/* 직접 입력 모드 */}
          {mode === 'direct' ? (
            <div>
              <label className={field.label}>금액 (원)</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className={`${field.input} text-right`}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <label className={field.label}>항목별 금액</label>
              {memos.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.label}
                    onChange={e => updateMemoLabel(idx, e.target.value)}
                    placeholder="항목명"
                    className={`${field.input} flex-1`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={row.amount}
                    onChange={e => updateMemoAmount(idx, e.target.value)}
                    placeholder="금액"
                    className={`${field.input} w-24 text-right`}
                  />
                  {memos.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removeMemoRow(idx)}
                      className={btn.danger}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                type="button"
                onClick={addMemoRow}
                className={btn.ghost}
              >
                + 항목 추가
              </button>
              {totalFromMemos > 0 ? (
                <p className="text-xs text-slate-500 text-right">
                  합계: {totalFromMemos.toLocaleString()}원
                </p>
              ) : null}
            </div>
          )}

          {/* 에러 메시지 */}
          {err ? (
            <p className="text-xs text-rose-500">{err}</p>
          ) : null}
        </div>

        {/* 푸터 */}
        <div className={modal.footer}>
          <button onClick={onClose} className={btn.secondary}>취소</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
