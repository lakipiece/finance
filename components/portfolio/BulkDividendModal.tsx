'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Security, Account } from '@/lib/portfolio/types'
import { btn, field, modal } from '@/lib/styles'
import DateInput from '@/components/ui/DateInput'

interface AccountSecurity { account_id: string; security_id: string }

interface RowInput {
  security_id: string
  amount: string
  tax: string
  memo: string
}

interface Props {
  show: boolean
  onClose: () => void
  accounts: Pick<Account, 'id' | 'name' | 'broker' | 'owner' | 'dividend_eligible' | 'dividend_tax_rate'>[]
  accountSecurities: AccountSecurity[]
  securities: Pick<Security, 'id' | 'ticker' | 'name' | 'currency'>[]
  owners: string[]
  palette: { colors: string[] }
}

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

interface MemberOpt { code: string; color: string }

export default function BulkDividendModal({
  show, onClose, accounts, accountSecurities, securities, owners, palette,
}: Props) {
  const router = useRouter()
  const [modalOwner, setModalOwner] = useState('')
  const [accountId, setAccountId] = useState('')
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>([])
  const [paidAt, setPaidAt] = useState(todayStr())
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW')
  const [exchangeRate, setExchangeRate] = useState('')
  const [rows, setRows] = useState<RowInput[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/options/members').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setMemberOpts(data)
    }).catch(() => {})
  }, [])

  // Reset state when modal opens
  useEffect(() => {
    if (!show) return
    setModalOwner('')
    setAccountId('')
    setPaidAt(todayStr())
    setCurrency('KRW')
    setExchangeRate('')
    setRows([])
  }, [show])

  function ownerColor(code: string): string {
    return memberOpts.find(m => m.code === code)?.color ?? '#64748b'
  }

  const modalAccounts = useMemo(() =>
    accounts
      .filter(a => a.dividend_eligible)
      .filter(a => !modalOwner || a.owner === modalOwner),
    [accounts, modalOwner]
  )

  const selectedAccount = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId])
  const taxRate = selectedAccount?.dividend_tax_rate ?? 15.4

  // Seed rows when account changes
  useEffect(() => {
    if (!accountId) { setRows([]); return }
    const linked = accountSecurities
      .filter(l => l.account_id === accountId)
      .map(l => l.security_id)
    setRows(linked.map(sid => ({ security_id: sid, amount: '', tax: '', memo: '' })))
  }, [accountId, accountSecurities])

  function updateAmount(idx: number, raw: string) {
    const plain = raw.replace(/,/g, '')
    const n = parseFloat(plain)
    const autoTax = !isNaN(n) && n > 0 ? (n * taxRate / 100).toFixed(2) : ''
    setRows(prev => prev.map((r, i) =>
      i === idx ? { ...r, amount: fmtNumber(plain), tax: autoTax ? fmtNumber(autoTax) : '' } : r
    ))
  }

  function updateRow(idx: number, key: 'tax' | 'memo', value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const toSave = rows.filter(r => parseNum(r.amount) > 0)
      if (toSave.length === 0) { onClose(); return }
      await Promise.all(toSave.map(r =>
        fetch('/api/portfolio/dividends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            security_id: r.security_id,
            account_id: accountId,
            paid_at: paidAt,
            currency,
            amount: parseNum(r.amount),
            exchange_rate: currency === 'USD' && exchangeRate ? parseNum(exchangeRate) : 1,
            tax: r.tax ? parseNum(r.tax) : 0,
            memo: r.memo || null,
          }),
        })
      ))
      onClose()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (!show) return null

  return (
    <div className={modal.overlay}>
      <div className={modal.containerLg}>
        <div className={modal.header}>
          <h2 className="text-sm font-semibold text-slate-700">배당·분배금 일괄 추가</h2>
          <button onClick={onClose} className={modal.close}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form id="bulk-dividend-form" onSubmit={handleSubmit} className={modal.body}>

          {/* 사용자 선택 */}
          {owners.length > 0 && (
            <div>
              <p className={field.label}>사용자</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button"
                  onClick={() => { setModalOwner(''); setAccountId('') }}
                  className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                  style={modalOwner === '' ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0], color: '#fff' } : { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b' }}>
                  전체
                </button>
                {owners.map(o => {
                  const color = ownerColor(o)
                  const isActive = modalOwner === o
                  return (
                    <button type="button" key={o}
                      onClick={() => { setModalOwner(o); setAccountId('') }}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={isActive
                        ? { backgroundColor: color, borderColor: color, color: '#fff' }
                        : { backgroundColor: `${color}18`, borderColor: `${color}40`, color }}>
                      {o}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* 계좌 선택 */}
          <div>
            <p className={field.label}>계좌</p>
            <select required value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className={field.select}>
              <option value="">계좌 선택</option>
              {modalAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.broker} {a.name}</option>
              ))}
            </select>
            {selectedAccount && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                기본 세율: {selectedAccount.dividend_tax_rate ?? 15.4}%
              </p>
            )}
          </div>

          {/* 수령일 */}
          <div>
            <p className={field.label}>수령일</p>
            <DateInput value={paidAt} onChange={v => setPaidAt(v)} />
          </div>

          {/* 통화 */}
          <div>
            <p className={field.label}>통화</p>
            <div className="flex gap-1.5">
              {(['KRW', 'USD'] as const).map(c => (
                <button type="button" key={c}
                  onClick={() => setCurrency(c)}
                  className={btn.pill(currency === c)}
                  style={currency === c ? { backgroundColor: palette.colors[0], borderColor: palette.colors[0] } : undefined}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* 환율 (USD 선택 시) */}
          {currency === 'USD' && (
            <div>
              <p className={field.label}>환율 (₩/USD)</p>
              <input type="text" inputMode="decimal" required
                placeholder="0"
                value={exchangeRate}
                onChange={e => setExchangeRate(fmtNumber(e.target.value.replace(/,/g, '')))}
                className={`${field.input} text-right`} />
            </div>
          )}

          {/* 종목 카드 리스트 */}
          {accountId && rows.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">연결된 종목이 없습니다</p>
          )}
          {rows.length > 0 && (
            <div className="space-y-2">
              <p className={field.label}>종목별 수령액 입력 (금액 0인 항목은 저장 안 됨)</p>
              {rows.map((row, idx) => {
                const sec = securities.find(s => s.id === row.security_id)
                if (!sec) return null
                return (
                  <div key={row.security_id} className="border border-slate-100 rounded-xl p-3">
                    <div className="mb-2">
                      <span className="block text-[10px] font-mono text-slate-500 mb-0.5">{sec.ticker}</span>
                      <span className="text-xs text-slate-700 font-medium truncate block">{sec.name}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">금액({currency})</label>
                        <input type="text" inputMode="decimal"
                          value={row.amount}
                          onChange={e => updateAmount(idx, e.target.value)}
                          placeholder="0"
                          className={`${field.input} text-right`} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">세금({currency})</label>
                        <input type="text" inputMode="decimal"
                          value={row.tax}
                          onChange={e => updateRow(idx, 'tax', fmtNumber(e.target.value.replace(/,/g, '')))}
                          placeholder="0"
                          className={`${field.input} text-right`} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">메모</label>
                        <input type="text"
                          value={row.memo}
                          onChange={e => updateRow(idx, 'memo', e.target.value)}
                          className={field.input} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </form>

        <div className={modal.footer}>
          <button type="button" onClick={onClose} className={btn.secondary}>
            취소
          </button>
          <button type="submit" form="bulk-dividend-form" disabled={saving}
            className={btn.primary}
            style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
