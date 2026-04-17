'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Dividend, Security, Account } from '@/lib/portfolio/types'
import { fmtDate } from '@/lib/portfolio/dividendUtils'
import { btn, field, modal } from '@/lib/styles'

interface AccountSecurity { account_id: string; security_id: string }

type DividendRow = Dividend & {
  security: Pick<Security, 'ticker' | 'name' | 'currency'>
  account: Pick<Account, 'name' | 'broker' | 'owner'>
}

interface Props {
  show: boolean
  onClose: () => void
  editTarget: DividendRow | null
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner'>[]
  accountSecurities: AccountSecurity[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  owners: string[]
  palette: { colors: string[] }
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtNumber(s: string) {
  const raw = s.replace(/,/g, '')
  if (raw === '' || raw === '-') return raw
  const n = parseFloat(raw)
  if (isNaN(n)) return s
  const [int, dec] = raw.split('.')
  return parseInt(int, 10).toLocaleString() + (dec !== undefined ? '.' + dec : '')
}

function parseNum(s: string) {
  return parseFloat(s.replace(/,/g, '')) || 0
}

const emptyForm = () => ({
  account_id: '', security_id: '', paid_at: todayStr(),
  currency: 'KRW', amount: '', exchange_rate: '', tax: '', memo: '',
})

// ─── 컴포넌트 ────────────────────────────────────────────────────────────────

export default function DividendFormModal({
  show, onClose, editTarget, accounts, accountSecurities, securities, owners, palette,
}: Props) {
  const router = useRouter()
  const [form, setForm] = useState(emptyForm())
  const [modalOwner, setModalOwner] = useState('')
  const [secSearch, setSecSearch] = useState('')
  const [secDropOpen, setSecDropOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const secDropRef = useRef<HTMLDivElement>(null)

  // editTarget이 바뀔 때 폼 초기화
  useEffect(() => {
    if (!show) return
    if (editTarget) {
      setModalOwner(editTarget.account.owner ?? '')
      setSecSearch('')
      setSecDropOpen(false)
      setForm({
        account_id: editTarget.account_id,
        security_id: editTarget.security_id,
        paid_at: fmtDate(editTarget.paid_at),
        currency: editTarget.currency,
        amount: Number(editTarget.amount).toLocaleString(),
        exchange_rate: editTarget.currency === 'USD' ? String(editTarget.exchange_rate) : '',
        tax: Number(editTarget.tax) > 0 ? Number(editTarget.tax).toLocaleString() : '',
        memo: editTarget.memo ?? '',
      })
    } else {
      setModalOwner('')
      setSecSearch('')
      setSecDropOpen(false)
      setForm(emptyForm())
    }
  }, [show, editTarget])

  // 드롭다운 바깥 클릭 닫기
  useEffect(() => {
    if (!secDropOpen) return
    function handleClick(e: MouseEvent) {
      if (secDropRef.current && !secDropRef.current.contains(e.target as Node)) {
        setSecDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [secDropOpen])

  const modalAccounts = useMemo(
    () => modalOwner ? accounts.filter(a => a.owner === modalOwner) : accounts,
    [accounts, modalOwner]
  )

  const modalSecurities = useMemo(() => {
    if (!form.account_id) return securities
    const ids = new Set(accountSecurities.filter(l => l.account_id === form.account_id).map(l => l.security_id))
    const filtered = securities.filter(s => ids.has(s.id))
    return filtered.length > 0 ? filtered : securities
  }, [form.account_id, securities, accountSecurities])

  const filteredModalSecurities = useMemo(() =>
    !secSearch
      ? modalSecurities.slice(0, 20)
      : modalSecurities.filter(s =>
          s.ticker.toLowerCase().includes(secSearch.toLowerCase()) ||
          s.name.toLowerCase().includes(secSearch.toLowerCase())
        ).slice(0, 20),
    [modalSecurities, secSearch]
  )

  function handleSecurityChange(security_id: string) {
    const sec = securities.find(s => s.id === security_id)
    const currency = sec?.currency === 'USD' ? 'USD' : 'KRW'
    setForm(p => ({ ...p, security_id, currency, exchange_rate: '', tax: '' }))
  }

  function handleAmountChange(raw: string) {
    const plain = raw.replace(/,/g, '')
    const n = parseFloat(plain)
    const autoTax = !isNaN(n) && n > 0 ? (n * 0.154).toFixed(2) : ''
    setForm(p => ({ ...p, amount: fmtNumber(plain), tax: autoTax ? fmtNumber(autoTax) : '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        security_id: form.security_id,
        account_id: form.account_id,
        paid_at: form.paid_at,
        currency: form.currency,
        amount: parseNum(form.amount),
        exchange_rate: form.currency === 'USD' && form.exchange_rate ? parseNum(form.exchange_rate) : 1,
        tax: form.tax ? parseNum(form.tax) : 0,
        memo: form.memo || null,
      }
      const isEdit = !!editTarget
      const url = isEdit ? `/api/portfolio/dividends/${editTarget!.id}` : '/api/portfolio/dividends'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) {
        onClose()
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className={modal.overlay}>
      <div className={modal.containerLg}>
        <div className={modal.header}>
          <h2 className="text-sm font-semibold text-slate-700">
            {editTarget ? '배당·분배금 수정' : '배당·분배금 추가'}
          </h2>
          <button onClick={onClose} className={modal.close}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form id="dividend-form" onSubmit={handleSubmit} className={modal.body}>

          {/* 사용자 선택 */}
          {owners.length > 0 && (
            <div>
              <p className={field.label}>계좌 사용자</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button"
                  onClick={() => { setModalOwner(''); setForm(p => ({ ...p, account_id: '', security_id: '' })) }}
                  className={btn.pill(modalOwner === '')}
                  style={modalOwner === '' ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
                  전체
                </button>
                {owners.map(o => (
                  <button type="button" key={o}
                    onClick={() => { setModalOwner(o); setForm(p => ({ ...p, account_id: '', security_id: '' })) }}
                    className={btn.pill(modalOwner === o)}
                    style={modalOwner === o ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 계좌 선택 */}
          <div>
            <p className={field.label}>계좌</p>
            <select required value={form.account_id}
              onChange={e => setForm(p => ({ ...p, account_id: e.target.value, security_id: '' }))}
              className={field.select}>
              <option value="">계좌 선택</option>
              {modalAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.broker} {a.name}</option>
              ))}
            </select>
          </div>

          {/* 종목 선택 */}
          <div>
            <p className={field.label}>종목</p>
            {form.security_id ? (
              <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-slate-700 flex-1 truncate">
                  {modalSecurities.find(s => s.id === form.security_id)?.ticker}
                  {' '}{modalSecurities.find(s => s.id === form.security_id)?.name}
                </span>
                <button type="button"
                  onClick={() => { setForm(p => ({ ...p, security_id: '' })); setSecSearch('') }}
                  className="text-slate-400 hover:text-slate-600 text-xs shrink-0">변경</button>
              </div>
            ) : (
              <div className="relative" ref={secDropRef}>
                <input
                  type="text"
                  placeholder="종목 검색 (티커 또는 종목명)"
                  value={secSearch}
                  onChange={e => { setSecSearch(e.target.value); setSecDropOpen(true) }}
                  onFocus={() => setSecDropOpen(true)}
                  className={field.input}
                  autoComplete="off"
                />
                {secDropOpen && filteredModalSecurities.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg mt-0.5 max-h-48 overflow-y-auto">
                    {filteredModalSecurities.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { handleSecurityChange(s.id); setSecSearch(''); setSecDropOpen(false) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{s.ticker}</span>
                        <span className="text-slate-500 truncate">{s.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 수령일 */}
          <div>
            <p className={field.label}>수령일</p>
            <input type="date" required value={form.paid_at}
              onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
              className={field.input} />
          </div>

          {/* 통화 */}
          <div>
            <p className={field.label}>통화</p>
            <div className="flex gap-1.5">
              {['KRW', 'USD'].map(c => (
                <button type="button" key={c}
                  onClick={() => setForm(p => ({ ...p, currency: c, exchange_rate: '', tax: '' }))}
                  className={btn.pill(form.currency === c)}
                  style={form.currency === c ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 금액 + 환율 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={field.label}>금액 ({form.currency})</p>
              <input type="text" inputMode="decimal" required
                placeholder="0"
                value={form.amount}
                onChange={e => handleAmountChange(e.target.value)}
                className={`${field.input} text-right`} />
            </div>
            {form.currency === 'USD' ? (
              <div>
                <p className={field.label}>환율 (₩/USD)</p>
                <input type="text" inputMode="decimal" required
                  placeholder="0"
                  value={form.exchange_rate}
                  onChange={e => setForm(p => ({ ...p, exchange_rate: fmtNumber(e.target.value.replace(/,/g, '')) }))}
                  className={`${field.input} text-right`} />
              </div>
            ) : <div />}
          </div>

          {/* USD 환산 미리보기 */}
          {form.currency === 'USD' && form.amount && form.exchange_rate && (
            <p className="text-xs text-slate-400 -mt-2">
              ≈ {Math.round(parseNum(form.amount) * parseNum(form.exchange_rate)).toLocaleString()}원
            </p>
          )}

          {/* 세금 */}
          <div>
            <p className={field.label}>세금 ({form.currency}) <span className="text-slate-300">· 15.4% 자동계산</span></p>
            <input type="text" inputMode="decimal"
              placeholder="0"
              value={form.tax}
              onChange={e => setForm(p => ({ ...p, tax: fmtNumber(e.target.value.replace(/,/g, '')) }))}
              className={`${field.input} text-right`} />
          </div>

          {/* 메모 */}
          <div>
            <p className={field.label}>메모</p>
            <textarea
              rows={3}
              placeholder="메모 (선택)"
              value={form.memo}
              onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
              className={field.textarea} />
          </div>

        </form>

        <div className={modal.footer}>
          <button type="button" onClick={onClose} className={btn.secondary}>
            취소
          </button>
          <button type="submit" form="dividend-form" disabled={saving}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : editTarget ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
