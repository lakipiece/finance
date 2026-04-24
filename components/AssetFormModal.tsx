'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { btn, field, modal } from '@/lib/styles'

export interface AssetItem {
  id: string
  name: string
  asset_type: string
  description: string
  acquired_at: string | null
  acquisition_price: number | null
  acquisition_note: string
  current_value: number | null
  last_val_date: string | null
}

interface Props {
  show: boolean
  onClose: () => void
  onSaved: (item: AssetItem) => void
  palette: { colors: string[] }
  editItem?: AssetItem | null
}

export default function AssetFormModal({ show, onClose, onSaved, palette, editItem }: Props) {
  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState('부동산')
  const [description, setDescription] = useState('')
  const [acquiredAt, setAcquiredAt] = useState('')
  const [acquisitionPrice, setAcquisitionPrice] = useState('')
  const [acquisitionNote, setAcquisitionNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editItem) {
      setName(editItem.name)
      setAssetType(editItem.asset_type)
      setDescription(editItem.description)
      setAcquiredAt(editItem.acquired_at ?? '')
      setAcquisitionPrice(editItem.acquisition_price != null ? String(editItem.acquisition_price) : '')
      setAcquisitionNote(editItem.acquisition_note)
    } else {
      setName('')
      setAssetType('부동산')
      setDescription('')
      setAcquiredAt('')
      setAcquisitionPrice('')
      setAcquisitionNote('')
    }
    setError(null)
  }, [editItem, show])

  if (!show) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('자산명을 입력해주세요.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const body = {
        name: name.trim(),
        asset_type: assetType,
        description: description.trim(),
        acquired_at: acquiredAt || null,
        acquisition_price: acquisitionPrice ? Number(acquisitionPrice) : null,
        acquisition_note: acquisitionNote.trim(),
      }
      const url = editItem ? `/api/assets/${editItem.id}` : '/api/assets'
      const method = editItem ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? '저장 실패')
      }
      const saved: AssetItem = await res.json()
      onSaved(saved)
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
            {editItem ? '자산 수정' : '자산 추가'}
          </h2>
          <button onClick={onClose} className={modal.close} type="button">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <form onSubmit={handleSubmit} className={modal.body}>
          {/* 자산명 */}
          <div>
            <label className={field.label}>자산명</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="자산명을 입력하세요"
              className={field.input}
              required
            />
          </div>

          {/* 유형 */}
          <div>
            <label className={field.label}>유형</label>
            <select
              value={assetType}
              onChange={e => setAssetType(e.target.value)}
              className={`${field.select} w-full`}
            >
              <option value="부동산">부동산</option>
              <option value="연금">연금</option>
              <option value="차량">차량</option>
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
              placeholder="설명을 입력하세요"
              className={field.input}
            />
          </div>

          {/* 취득일 */}
          <div>
            <label className={field.label}>취득일</label>
            <input
              type="date"
              value={acquiredAt}
              onChange={e => setAcquiredAt(e.target.value)}
              className={field.input}
            />
          </div>

          {/* 취득가액 */}
          <div>
            <label className={field.label}>취득가액 (원)</label>
            <input
              type="number"
              value={acquisitionPrice}
              onChange={e => setAcquisitionPrice(e.target.value)}
              placeholder="0"
              min={0}
              className={field.input}
            />
          </div>

          {/* 취득메모 */}
          <div>
            <label className={field.label}>취득메모</label>
            <input
              type="text"
              value={acquisitionNote}
              onChange={e => setAcquisitionNote(e.target.value)}
              placeholder="취득 관련 메모"
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
            {saving ? '저장 중...' : (editItem ? '수정' : '저장')}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
