'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'
import { formatWonFull } from '@/lib/utils'

interface ValuationItem {
  id: string
  val_date: string
  amount: number
  note: string
}

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

function fmtAmt(n: number) {
  return formatWonFull(Math.round(n))
}

function fmtAmount(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString('ko-KR') : ''
}

function parseAmount(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0
}

export default function AssetValuationModal({ show, assetId, assetName, onClose, onSaved, palette }: Props) {
  const [valDate, setValDate] = useState(todayStr())
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [history, setHistory] = useState<ValuationItem[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!show) return
    resetForm()
    loadHistory()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, assetId])

  function resetForm() {
    setValDate(todayStr())
    setAmount('')
    setNote('')
    setError(null)
    setEditingId(null)
  }

  function loadHistory() {
    setHistLoading(true)
    fetch(`/api/assets/${assetId}/valuations`)
      .then(r => r.json())
      .then((data: ValuationItem[]) => {
        const sorted = Array.isArray(data) ? [...data].sort((a, b) => b.val_date.localeCompare(a.val_date)) : []
        setHistory(sorted)
      })
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false))
  }

  function startEdit(v: ValuationItem) {
    setEditingId(v.id)
    setValDate(v.val_date)
    setAmount(fmtAmount(String(v.amount)))
    setNote(v.note ?? '')
    setError(null)
  }

  async function handleDelete(valId: string) {
    if (!confirm('이 평가 기록을 삭제하시겠습니까?')) return
    await fetch(`/api/assets/${assetId}/valuations/${valId}`, { method: 'DELETE' })
    setHistory(prev => prev.filter(v => v.id !== valId))
    if (editingId === valId) resetForm()
    onSaved()
  }

  async function handleSubmit() {
    const parsedAmount = parseAmount(amount)
    if (!valDate || parsedAmount <= 0) {
      setError('평가일과 시세를 올바르게 입력해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = { val_date: valDate, amount: parsedAmount, note: note.trim() }
      const url = editingId
        ? `/api/assets/${assetId}/valuations/${editingId}`
        : `/api/assets/${assetId}/valuations`
      const method = editingId ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장 실패')
      resetForm()
      loadHistory()
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  const content = (
    <div className={modal.overlayTop} onClick={onClose}>
      <div className={`${modal.containerLg}`} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className={modal.header}>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">평가액 업데이트</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">{assetName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all" type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={modal.body}>
          {/* 입력 폼 — 한 줄 */}
          <div className="bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
              {editingId ? '기록 수정' : '새 평가 추가'}
            </p>
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex flex-col gap-0.5">
                <label className={field.label}>평가일</label>
                <input type="date" value={valDate} onChange={e => setValDate(e.target.value)}
                  className={`${field.input} w-32 text-xs`} />
              </div>
              <div className="flex flex-col gap-0.5 w-36">
                <label className={field.label}>시세 (원)</label>
                <input type="text" inputMode="numeric" value={amount}
                  onChange={e => setAmount(fmtAmount(e.target.value))}
                  placeholder="0" className={`${field.input} text-right text-xs`} />
              </div>
              <div className="flex flex-col gap-0.5 flex-1 min-w-28">
                <label className={field.label}>메모</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="메모" className={`${field.input} text-xs`} />
              </div>
              <div className="flex gap-1.5 pb-0.5">
                {editingId && (
                  <button type="button" onClick={resetForm} className={btn.secondary}>취소</button>
                )}
                <button type="button" onClick={handleSubmit} disabled={saving} className={btn.primary}
                  style={{ backgroundColor: palette.colors[0] }}>
                  {saving ? '…' : editingId ? '수정' : '추가'}
                </button>
              </div>
            </div>
            {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
          </div>

          {/* 기록 내역 */}
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">기록 내역</p>
            {histLoading ? (
              <div className="py-6 text-center text-xs text-slate-300">로딩 중...</div>
            ) : history.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-300">평가 기록이 없습니다</div>
            ) : (
              <div className="space-y-0.5">
                {history.map(v => (
                  <div key={v.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors ${
                      editingId === v.id ? 'bg-blue-50 border border-blue-100' : 'hover:bg-slate-50'
                    }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{v.val_date}</span>
                      <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmtAmt(v.amount)}</span>
                      {v.note && <span className="text-[11px] text-slate-400 truncate">{v.note}</span>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => startEdit(v)} title="수정"
                        className="p-1 rounded-md text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828A2 2 0 0110.414 16H8v-2.414a2 2 0 01.586-1.414z" />
                        </svg>
                      </button>
                      <button onClick={() => handleDelete(v.id)} title="삭제"
                        className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
