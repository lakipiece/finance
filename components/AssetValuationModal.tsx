'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'

interface Props {
  show: boolean
  assetId: string
  assetName: string
  onClose: () => void
  onSaved: () => void
  palette: { colors: string[] }
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function AssetValuationModal({ show, assetId, assetName, onClose, onSaved, palette }: Props) {
  const [valDate, setValDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (show) {
      setValDate(todayStr())
      setAmount('')
      setNote('')
      setError(null)
    }
  }, [show, assetId])

  if (!show) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedAmount = Number(amount)
    if (!valDate || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('평가일과 추정 시세를 올바르게 입력해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { val_date: valDate, amount: parsedAmount, note: note.trim() }
      const res = await fetch(`/api/assets/${assetId}/valuations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? '저장 실패')
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
          <div>
            <h2 className="text-sm font-semibold text-slate-800">평가액 업데이트</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{assetName}</p>
          </div>
          <button onClick={onClose} className={modal.close} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <form onSubmit={handleSubmit} className={modal.body}>
          {/* 평가일 */}
          <div>
            <label className={field.label}>평가일</label>
            <input
              type="date"
              value={valDate}
              onChange={e => setValDate(e.target.value)}
              className={field.input}
              required
            />
          </div>

          {/* 추정 시세 */}
          <div>
            <label className={field.label}>추정 시세 (원)</label>
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

          {/* 메모 */}
          <div>
            <label className={field.label}>메모</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="평가 관련 메모"
              className={field.input}
            />
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
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
