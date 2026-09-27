'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { INVESTMENT_STYLES, type Security } from '@/lib/portfolio/types'
import { useTheme } from '@/lib/ThemeContext'
import { btn, field, modal as modalStyles } from '@/lib/styles'
import Select from '@/components/ui/Select'
import DateInput from '@/components/ui/DateInput'

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
    fixed_price: security?.fixed_price == null ? '' : String(security.fixed_price),
    // 연이율은 DB에 비율(0.035)로 저장하고 폼에서는 %로 다룬다
    annual_rate: security?.annual_rate == null ? '' : String(Number(security.annual_rate) * 100),
    accrual_start: security?.accrual_start ? String(security.accrual_start).slice(0, 10) : '',
    maturity_date: security?.maturity_date ? String(security.maturity_date).slice(0, 10) : '',
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
          fixed_price: form.fixed_price.trim() === '' ? null : Number(form.fixed_price),
          annual_rate: form.annual_rate.trim() === '' ? null : Number(form.annual_rate) / 100,
          accrual_start: form.accrual_start || null,
          maturity_date: form.maturity_date || null,
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
    <div className={modalStyles.overlayTop}>
      <div className={modalStyles.container} onClick={e => e.stopPropagation()}>
        <div className={modalStyles.header}>
          <div className="flex items-center gap-2">
            {isEdit ? <span className="bg-surface-low text-ink-2 text-micro tracking-normal font-bold px-1.5 py-0.5 rounded font-mono">{security!.ticker}</span> : null}
            <h3 className="text-subhead font-medium text-ink">{isEdit ? '종목 수정' : '종목 추가'}</h3>
          </div>
          <button onClick={onClose} className={modalStyles.close}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className={modalStyles.body}>
          <div className="grid grid-cols-2 gap-2">
            {!isEdit ? <div className="col-span-2"><label className={field.labelSm}>티커 *</label>
                <input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                  className={field.input} placeholder="SCHD" /></div> : null}
            <div className="col-span-2"><label className={field.labelSm}>종목명 *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={field.input}
                placeholder="슈왑 배당 ETF" /></div>
            <div><label className={field.labelSm}>국가</label>
              <Select value={form.country_id} onChange={v => setForm(p => ({ ...p, country_id: v }))}
                options={[{ value: '', label: '선택 안함' }, ...(options.country ?? []).map(o => ({ value: o.id, label: o.label }))]} /></div>
            <div><label className={field.labelSm}>통화</label>
              <Select value={form.currency_id} onChange={v => setForm(p => ({ ...p, currency_id: v }))}
                options={[{ value: '', label: '선택 안함' }, ...(options.currency ?? []).map(o => ({ value: o.id, label: o.label }))]} /></div>
            <div><label className={field.labelSm}>자산군</label>
              <Select value={form.asset_class_id} onChange={v => setForm(p => ({ ...p, asset_class_id: v }))}
                options={[{ value: '', label: '선택 안함' }, ...(options.asset_class ?? []).map(o => ({ value: o.id, label: o.label }))]} /></div>
            <div><label className={field.labelSm}>운용 스타일</label>
              <Select value={form.style_id} onChange={v => setForm(p => ({ ...p, style_id: v }))}
                options={[{ value: '', label: '선택 안함' }, ...(options.style ?? []).filter(o => !o.is_hidden).map(o => ({ value: o.id, label: o.label }))]} /></div>
            <div><label className={field.labelSm}>투자 성향</label>
              <Select value={form.style} onChange={v => setForm(p => ({ ...p, style: v }))}
                options={[
                  { value: '', label: '선택 안함' },
                  ...INVESTMENT_STYLES.map(v => ({ value: v, label: v })),
                  // 목록 밖의 기존 값도 잃지 않게
                  ...(form.style && !(INVESTMENT_STYLES as readonly string[]).includes(form.style) ? [{ value: form.style, label: form.style }] : []),
                ]} /></div>
            <div><label className={field.labelSm}>섹터 (GICS)</label>
              <Select value={form.sector_id} onChange={v => setForm(p => ({ ...p, sector_id: v }))}
                options={[{ value: '', label: '선택 안함' }, ...(options.sector ?? []).filter(o => !o.is_hidden).map(o => ({ value: o.id, label: o.label }))]} /></div>
            <div className="col-span-2"><label className={field.labelSm}>고정단가</label>
              <input value={form.fixed_price} inputMode="decimal"
                onChange={e => setForm(p => ({ ...p, fixed_price: e.target.value.replace(/[^\d.]/g, '') }))}
                className={field.input} placeholder="비워두면 시세 조회" />
              <p className="text-micro tracking-normal text-ink-4 mt-0.5">
                티커가 실재하지 않는 종목(원화 RP·예수금 등)에 입력. 시세를 조회하지 않고 항상 이 단가로 평가한다. 단위는 종목 통화 기준.
              </p></div>
            <div><label className={field.labelSm}>연이율 (%)</label>
              <input value={form.annual_rate} inputMode="decimal"
                onChange={e => setForm(p => ({ ...p, annual_rate: e.target.value.replace(/[^\d.]/g, '') }))}
                className={field.input} placeholder="예: 3.5" /></div>
            <div><label className={field.labelSm}>이자 기산일</label>
              <DateInput value={form.accrual_start} onChange={v => setForm(p => ({ ...p, accrual_start: v }))} /></div>
            <div className="col-span-2"><label className={field.labelSm}>만기일</label>
              <DateInput value={form.maturity_date} onChange={v => setForm(p => ({ ...p, maturity_date: v }))} />
              <p className="text-micro tracking-normal text-ink-4 mt-0.5">
                연이율을 넣으면 기산일부터 경과일만큼 미수이자가 평가단가에 단리로 붙는다(만기일에 정지).
                인컴에 &apos;이자&apos;를 기록하면 그 날짜로 기산점이 옮겨가 이중 계상되지 않는다.
              </p></div>
            <div className="col-span-2"><label className={field.labelSm}>URL</label>
              <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className={field.input} placeholder="https://..." /></div>
            <div className="col-span-2"><label className={field.labelSm}>메모</label>
              <input value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} className={field.input} /></div>
            <div className="col-span-2">
              <label className={field.label}>태그</label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[24px]">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-surface-low text-ink-2 text-body px-2 py-0.5 rounded-full">
                    {t}
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter(x => x !== t))}
                      className="text-ink-4 hover:text-ink leading-none"
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
          {err ? <p className="text-body text-gain">{err}</p> : null}
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
