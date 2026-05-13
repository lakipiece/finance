'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { Security } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import { btn, field, modal as modalStyles } from '@/lib/styles'

export type OptionItem = {
  id: string
  type: string
  label: string
  value: string
  color_hex: string | null
  sort_order: number
  is_hidden?: boolean
}

export default function SecurityFormModal({ security, onSave, onClose, options }: {
  security: Security | null
  onSave: (s: Security) => void
  onClose: () => void
  options: Record<string, OptionItem[]>
}) {
  const { palette } = useTheme()
  const isEdit = security !== null
  const [form, setForm] = useState({
    ticker:        security?.ticker ?? '',
    name:          security?.name ?? '',
    asset_class_id: security?.asset_class_id ?? (options.asset_class?.find(o => o.value === '주식')?.id ?? ''),
    country_id:    security?.country_id     ?? (options.country?.find(o => o.value === '미국')?.id ?? ''),
    style:         security?.style ?? '',
    style_id:      security?.style_id       ?? '',
    sector_id:     security?.sector_id      ?? '',
    currency_id:   security?.currency_id    ?? (options.currency?.find(o => o.value === 'USD')?.id ?? ''),
    url:  security?.url ?? '',
    memo: security?.memo ?? '',
  })
  const [tags, setTags] = useState<string[]>(security?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/portfolio/securities', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: security!.id } : {}),
          ticker: form.ticker.toUpperCase(),
          name: form.name,
          asset_class_id: form.asset_class_id || null,
          country_id:     form.country_id     || null,
          style:          form.style          || null,
          style_id:       form.style_id       || null,
          sector_id:      form.sector_id      || null,
          currency_id:    form.currency_id    || null,
          url:  form.url  || null,
          memo: form.memo || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (isEdit) {
        await fetch(`/api/portfolio/securities/${data.id}/tags`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      }
      for (const tag of tags) {
        await fetch(`/api/portfolio/securities/${data.id}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        })
      }
      onSave({ ...data, tags })
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  const secModal = (
    <div className={modalStyles.overlayTop} onClick={onClose}>
      <div className={modalStyles.container} onClick={e => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className="flex items-center gap-2">
            {isEdit && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono">{security!.ticker}</span>}
            <h3 className="text-sm font-semibold text-slate-800">{isEdit ? '종목 수정' : '종목 추가'}</h3>
          </div>
          <button onClick={onClose} className={modalStyles.close}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modalStyles.body}>
          <div className="grid grid-cols-2 gap-2">
            {!isEdit && (
              <div className="col-span-2"><label className={field.labelSm}>티커 *</label>
                <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                  className={field.input} placeholder="SCHD" /></div>
            )}
            <div className="col-span-2"><label className={field.labelSm}>종목명 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={field.input}
                placeholder="슈왑 배당 ETF" /></div>
            <div><label className={field.labelSm}>국가</label>
              <select value={form.country_id} onChange={e => setForm(p => ({ ...p, country_id: e.target.value }))} className={field.input}>
                <option value="">선택 안함</option>
                {(options.country ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div><label className={field.labelSm}>통화</label>
              <select value={form.currency_id} onChange={e => setForm(p => ({ ...p, currency_id: e.target.value }))} className={field.input}>
                <option value="">선택 안함</option>
                {(options.currency ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div><label className={field.labelSm}>자산군</label>
              <select value={form.asset_class_id} onChange={e => setForm(p => ({ ...p, asset_class_id: e.target.value }))} className={field.input}>
                <option value="">선택 안함</option>
                {(options.asset_class ?? []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div><label className={field.labelSm}>운용 스타일</label>
              <select value={form.style_id} onChange={e => setForm(p => ({ ...p, style_id: e.target.value }))} className={field.input}>
                <option value="">선택 안함</option>
                {(options.style ?? []).filter(o => !o.is_hidden).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div><label className={field.labelSm}>섹터 (GICS)</label>
              <select value={form.sector_id} onChange={e => setForm(p => ({ ...p, sector_id: e.target.value }))} className={field.input}>
                <option value="">선택 안함</option>
                {(options.sector ?? []).filter(o => !o.is_hidden).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select></div>
            <div className="col-span-2"><label className={field.labelSm}>URL</label>
              <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className={field.input} placeholder="https://..." /></div>
            <div className="col-span-2"><label className={field.labelSm}>메모</label>
              <input value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} className={field.input} /></div>
            <div className="col-span-2">
              <label className={field.label}>태그</label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter(x => x !== t))}
                      className="text-slate-400 hover:text-slate-700 leading-none"
                    >×</button>
                  </span>
                ))}
              </div>
              <input
                className={field.input}
                placeholder="태그 입력 후 Enter (예: 월배당, 핵심보유)"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    const t = tagInput.trim().replace(/,$/, '')
                    if (t && t.length <= 50 && !tags.includes(t)) setTags([...tags, t])
                    setTagInput('')
                  }
                }}
              />
            </div>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className={modalStyles.footer}>
          <button onClick={onClose} className={btn.secondary}>취소</button>
          <button onClick={handleSave} disabled={saving || (!isEdit && !form.ticker) || !form.name}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : isEdit ? '저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
  if (typeof document === 'undefined') return null
  return createPortal(secModal, document.body)
}
