'use client'

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, formatWonFull } from '@/lib/utils'
import DateInput from '@/components/ui/DateInput'
import { field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'

/* ── Constants ── */
interface MemberOpt { code: string; display_name: string; color: string }
interface MethodOpt { name: string; color: string }
const DEFAULT_MEMBERS: MemberOpt[] = [
  { code: 'L', display_name: 'L', color: '#1565C0' },
  { code: 'P', display_name: 'P', color: '#AD1457' },
]
const DEFAULT_METHODS: MethodOpt[] = [
  { name: '카드', color: '#94a3b8' },
  { name: '현금', color: '#94a3b8' },
]
const FormCtx = createContext<{
  memberOpts: MemberOpt[]
  methodOpts: MethodOpt[]
  detailsByCategory: Record<string, string[]>
}>({
  memberOpts: DEFAULT_MEMBERS,
  methodOpts: DEFAULT_METHODS,
  detailsByCategory: {},
})

/* ── Helpers ── */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtAmount(v: string) {
  const isNegative = v.trimStart().startsWith('-')
  const n = v.replace(/[^0-9]/g, '')
  if (!n) return isNegative ? '-' : ''
  return (isNegative ? '-' : '') + Number(n).toLocaleString('ko-KR')
}

function parseAmount(v: string) {
  const isNegative = v.trimStart().startsWith('-')
  const digits = parseInt(v.replace(/[^0-9]/g, '')) || 0
  return isNegative ? -digits : digits
}

function isFormula(v: string) {
  return v.trimStart().startsWith('=')
}

function evalFormula(expr: string): number | null {
  const clean = expr.replace(/^=/, '').replace(/,/g, '').trim()
  if (!clean) return null
  if (!/^[\d\s+\-*/().]+$/.test(clean)) return null
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${clean})`)()
    return typeof result === 'number' && isFinite(result) && result > 0 ? Math.round(result) : null
  } catch { return null }
}

/* ── Auto-resize textarea ── */
function AutoResizeMemo({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea ref={ref} value={value} rows={1}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`${className} resize-none overflow-hidden`}
      style={{ minHeight: '2rem' }} />
  )
}

/* ── Small components ── */
function PillBtn({ active, onClick, children, color, size = 'md' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string; size?: 'sm' | 'md'
}) {
  const { palette } = useTheme()
  const bg = active ? (color ?? palette.colors[0]) : undefined
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 rounded-md text-[11px]' : 'px-3 py-1 rounded-lg text-xs'
  return (
    <button type="button" onClick={onClick}
      className={`${sizeClass} font-medium border transition-all whitespace-nowrap ${
        active ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
      style={bg ? { backgroundColor: bg, borderColor: bg } : undefined}>
      {children}
    </button>
  )
}

function MemberToggle({ value, onChange, size = 'md' }: {
  value: string; onChange: (v: string) => void; size?: 'sm' | 'md'
}) {
  const { memberOpts } = useContext(FormCtx)
  return (
    <div className="flex gap-1">
      {memberOpts.map(m => (
        <PillBtn key={m.code} active={value === m.code} onClick={() => onChange(m.code)} color={m.color} size={size}>
          {m.display_name}
        </PillBtn>
      ))}
    </div>
  )
}

function DetailSearchInput({ value, onChange, suggestions, placeholder }: {
  value: string; onChange: (v: string) => void; suggestions: string[]; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim()
    if (!q) return suggestions.slice(0, 30)
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 30)
  }, [suggestions, value])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <input type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? '세부유형 검색…'}
        maxLength={30}
        autoComplete="off"
        className={field.input} />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-lg mt-0.5 max-h-44 overflow-y-auto">
          {filtered.map(s => (
            <button key={s} type="button"
              onClick={() => { onChange(s); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-700 truncate">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

/* ── Icons ── */
function IncomeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
    </svg>
  )
}

function ExpenseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
    </svg>
  )
}

/* ── Types ── */
interface ExpenseRecord {
  type: 'expense'
  id: number; date: string; category: string; detail: string
  method: string; member: string; amount: number; memo: string
}
interface IncomeRecord {
  type: 'income'
  id: number; date: string; category: string; description: string
  amount: number; member: string | null; memo: string
}
type AnyRecord = ExpenseRecord | IncomeRecord

/* ── (unused - kept for reference) ── */
function _CompactExpenseForm_unused({ onSaved, initialDate, initialMember, onDateChange, onMemberChange }: {
  onSaved: () => void
  initialDate: string
  initialMember: string
  onDateChange: (d: string) => void
  onMemberChange: (m: string) => void
}) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const { memberOpts, methodOpts, detailsByCategory } = useContext(FormCtx)
  const visibleCategories = CATEGORIES.filter(c => !(excludeLoan && c === '대출상환'))
  const [date, setDate] = useState(initialDate)
  const [member, setMember] = useState(initialMember)
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState(() => DEFAULT_METHODS[0].name)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function handleDateChange(d: string) { setDate(d); onDateChange(d) }
  function handleMemberChange(m: string) { setMember(m); onMemberChange(m) }
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setAmount(isFormula(v) ? v : fmtAmount(v))
  }
  function resolveAmount() {
    if (isFormula(amount)) {
      const r = evalFormula(amount)
      if (r !== null) setAmount(r.toLocaleString('ko-KR'))
    }
  }
  const formulaResult = isFormula(amount) ? evalFormula(amount) : null

  async function handleSave() {
    resolveAmount()
    const raw = isFormula(amount) ? (evalFormula(amount) ?? 0) : parseAmount(amount)
    if (!date || !category || amount.trim() === '') { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: raw, memo, memos: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setDetail(''); setAmount(''); setMemo('')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 items-start">
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={handleMemberChange} size="sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <DateInput value={date} onChange={handleDateChange} className="w-full" />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1">
            {visibleCategories.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]} size="sm">{c}</PillBtn>)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>세부유형</label>
          <DetailSearchInput value={detail} onChange={setDetail} suggestions={detailsByCategory[category] ?? []} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>결제수단</label>
          <div className="flex flex-wrap gap-1">
            {methodOpts.map(m => <PillBtn key={m.name} active={method === m.name} onClick={() => setMethod(m.name)} color={m.color} size="sm">{m.name}</PillBtn>)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={handleAmountChange}
            onBlur={resolveAmount}
            onKeyDown={e => { if (e.key === 'Enter') resolveAmount() }}
            placeholder="0 또는 =수식" className={`${field.input} text-right`} />
          {isFormula(amount) && (
            <span className={`text-[10px] text-right tabular-nums ${formulaResult !== null ? 'text-blue-500' : 'text-rose-400'}`}>
              {formulaResult !== null ? `= ${formulaResult.toLocaleString('ko-KR')}원` : '수식 오류'}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
      </div>

      {err && <p className="text-xs text-rose-500">{err}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: '#1A237E' }}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

/* ── (unused - kept for reference) ── */
function _CompactIncomeForm_unused({ onSaved, initialDate, initialMember, onDateChange, onMemberChange }: {
  onSaved: () => void
  initialDate: string
  initialMember: string
  onDateChange: (d: string) => void
  onMemberChange: (m: string) => void
}) {
  const [date, setDate] = useState(initialDate)
  const [member, setMember] = useState(initialMember)
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function handleDateChange(d: string) { setDate(d); onDateChange(d) }
  function handleMemberChange(m: string) { setMember(m); onMemberChange(m) }
  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setAmount(isFormula(v) ? v : fmtAmount(v))
  }
  function resolveAmount() {
    if (isFormula(amount)) {
      const r = evalFormula(amount)
      if (r !== null) setAmount(r.toLocaleString('ko-KR'))
    }
  }
  const formulaResult = isFormula(amount) ? evalFormula(amount) : null

  async function handleSave() {
    resolveAmount()
    const raw = isFormula(amount) ? (evalFormula(amount) ?? 0) : parseAmount(amount)
    if (!date || !category || !description || raw <= 0) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: raw, member, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setDescription(''); setAmount(''); setMemo('')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 items-start">
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={handleMemberChange} size="sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <DateInput value={date} onChange={handleDateChange} className="w-full" />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className={field.label}>카테고리</label>
          <div className="flex flex-wrap gap-1">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]} size="sm">{c}</PillBtn>
            ))}
          </div>
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <label className={field.label}>설명</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="수입 내용" maxLength={50} className={field.input} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={handleAmountChange}
            onBlur={resolveAmount}
            onKeyDown={e => { if (e.key === 'Enter') resolveAmount() }}
            placeholder="0 또는 =수식" className={`${field.input} text-right`} />
          {isFormula(amount) && (
            <span className={`text-[10px] text-right tabular-nums ${formulaResult !== null ? 'text-blue-500' : 'text-rose-400'}`}>
              {formulaResult !== null ? `= ${formulaResult.toLocaleString('ko-KR')}원` : '수식 오류'}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
      </div>

      {err && <p className="text-xs text-rose-500">{err}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors disabled:opacity-60"
          style={{ backgroundColor: '#1A237E' }}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}

/* ── Modal Shell ── */
function ModalShell({ onClose, title, onDelete, children }: {
  onClose: () => void; title: string; onDelete?: () => void; children: React.ReactNode
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button onClick={onDelete} title="삭제" className="p-1.5 rounded-lg text-slate-200 hover:text-rose-400 hover:bg-rose-50 transition-all">
                <TrashIcon />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ── Expense Edit Modal ── */
function ExpenseEditModal({ record, onClose, onSaved, onDelete }: {
  record: ExpenseRecord; onClose: () => void; onSaved: () => void; onDelete: () => void
}) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const { methodOpts, detailsByCategory } = useContext(FormCtx)
  const visibleCategories = CATEGORIES.filter(c => !(excludeLoan && c === '대출상환'))
  const [date, setDate] = useState(record.date)
  const [member, setMember] = useState(record.member)
  const [category, setCategory] = useState(record.category)
  const [detail, setDetail] = useState(record.detail)
  const [method, setMethod] = useState(record.method)
  const [amount, setAmount] = useState(fmtAmount(String(record.amount)))
  const [memo, setMemo] = useState(record.memo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function resolveExpenseEditAmount() {
    if (isFormula(amount)) {
      const r = evalFormula(amount)
      if (r !== null) setAmount(r.toLocaleString('ko-KR'))
    }
  }
  const expenseEditFormulaResult = isFormula(amount) ? evalFormula(amount) : null

  async function handleSave() {
    resolveExpenseEditAmount()
    const amt = isFormula(amount) ? (evalFormula(amount) ?? 0) : parseAmount(amount)
    if (!date || !category || amount.trim() === '') { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/expenses/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo, memos: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="지출 수정" onDelete={onDelete}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} size="sm" />
          </div>
        </div>
        <div>
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {visibleCategories.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]} size="sm">{c}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>세부유형</label>
          <DetailSearchInput value={detail} onChange={setDetail} suggestions={detailsByCategory[category] ?? []} />
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className={field.label}>결제수단</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {methodOpts.map(m => <PillBtn key={m.name} active={method === m.name} onClick={() => setMethod(m.name)} color={m.color} size="sm">{m.name}</PillBtn>)}
            </div>
          </div>
          <div className="w-36">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="text" value={amount}
              onChange={e => { const v = e.target.value; setAmount(isFormula(v) ? v : fmtAmount(v)) }}
              onBlur={resolveExpenseEditAmount}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); resolveExpenseEditAmount() } }}
              placeholder="0 또는 =수식"
              className={`${field.input} text-right`} />
            {isFormula(amount) && expenseEditFormulaResult !== null && (
              <span className="text-[10px] text-right tabular-nums block text-blue-500 mt-0.5">
                = {expenseEditFormulaResult.toLocaleString('ko-KR')}원
              </span>
            )}
            {isFormula(amount) && expenseEditFormulaResult === null && (
              <span className="text-[10px] text-right block text-rose-400 mt-0.5">수식 오류</span>
            )}
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모"
            className={field.input} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            {saving ? '저장 중…' : '수정'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Income Edit Modal ── */
function IncomeEditModal({ record, onClose, onSaved, onDelete }: {
  record: IncomeRecord; onClose: () => void; onSaved: () => void; onDelete: () => void
}) {
  const [date, setDate] = useState(record.date)
  const [member, setMember] = useState(record.member ?? 'L')
  const [category, setCategory] = useState(record.category)
  const [description, setDescription] = useState(record.description)
  const [amount, setAmount] = useState(fmtAmount(String(record.amount)))
  const [memo, setMemo] = useState(record.memo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || !description || amt <= 0) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch(`/api/incomes/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: amt, member, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="수입 수정" onDelete={onDelete}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={v => setMember(v)} size="sm" />
          </div>
        </div>
        <div>
          <label className={field.label}>카테고리</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]} size="sm">{c}</PillBtn>
            ))}
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className={field.label}>설명</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              maxLength={50} className={field.input} />
          </div>
          <div className="w-36">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              className={`${field.input} text-right`} />
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모"
            className={field.input} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            {saving ? '저장 중…' : '수정'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Expense Create Modal ── */
function ExpenseCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const { memberOpts, methodOpts, detailsByCategory } = useContext(FormCtx)
  const visibleCategories = CATEGORIES.filter(c => !(excludeLoan && c === '대출상환'))
  const [date, setDate] = useState(todayStr())
  const [member, setMember] = useState(memberOpts[0]?.code ?? DEFAULT_MEMBERS[0].code)
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState(methodOpts[0]?.name ?? DEFAULT_METHODS[0].name)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function resolveCreateAmount() {
    if (isFormula(amount)) {
      const r = evalFormula(amount)
      if (r !== null) setAmount(r.toLocaleString('ko-KR'))
    }
  }
  const createFormulaResult = isFormula(amount) ? evalFormula(amount) : null

  async function handleSave() {
    resolveCreateAmount()
    const amt = isFormula(amount) ? (evalFormula(amount) ?? 0) : parseAmount(amount)
    if (!date || !category || amount.trim() === '') { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo, memos: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="지출 입력">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} size="sm" />
          </div>
        </div>
        <div>
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {visibleCategories.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]} size="sm">{c}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>세부유형</label>
          <DetailSearchInput value={detail} onChange={setDetail} suggestions={detailsByCategory[category] ?? []} />
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className={field.label}>결제수단</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {methodOpts.map(m => <PillBtn key={m.name} active={method === m.name} onClick={() => setMethod(m.name)} color={m.color} size="sm">{m.name}</PillBtn>)}
            </div>
          </div>
          <div className="w-36">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="text" value={amount}
              onChange={e => { const v = e.target.value; setAmount(isFormula(v) ? v : fmtAmount(v)) }}
              onBlur={resolveCreateAmount}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); resolveCreateAmount() } }}
              placeholder="0 또는 =수식"
              className={`${field.input} text-right`} />
            {isFormula(amount) && createFormulaResult !== null && (
              <span className="text-[10px] text-right tabular-nums block text-blue-500 mt-0.5">
                = {createFormulaResult.toLocaleString('ko-KR')}원
              </span>
            )}
            {isFormula(amount) && createFormulaResult === null && (
              <span className="text-[10px] text-right block text-rose-400 mt-0.5">수식 오류</span>
            )}
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Income Create Modal ── */
function IncomeCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { memberOpts } = useContext(FormCtx)
  const [date, setDate] = useState(todayStr())
  const [member, setMember] = useState(memberOpts[0]?.code ?? DEFAULT_MEMBERS[0].code)
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || !description || amt <= 0) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: amt, member, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="수입 입력">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <DateInput value={date} onChange={setDate} className="w-36" />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} size="sm" />
          </div>
        </div>
        <div>
          <label className={field.label}>카테고리</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]} size="sm">{c}</PillBtn>
            ))}
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className={field.label}>설명</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="수입 내용" maxLength={50} className={field.input} />
          </div>
          <div className="w-36">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              className={`${field.input} text-right`} />
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#1A237E' }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Category Breakdown Panel ── */
function CategoryBreakdown({ category, items, color, activeItem, onItemClick }: {
  category: string
  items: { name: string; amount: number; pct: number }[]
  color?: string
  activeItem: string | null
  onItemClick: (name: string) => void
}) {
  const maxPct = items[0]?.pct ?? 1
  return (
    <div className="mb-4 px-4 py-3 bg-slate-50 rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[11px] font-semibold text-slate-500">{category} 항목별 집계</p>
        {activeItem && (
          <button onClick={() => onItemClick(activeItem)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-white border border-slate-200 text-slate-500 hover:text-slate-700 transition-colors">
            {activeItem}
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-1.5">
        {items.map((item, idx) => {
          const isActive = activeItem === item.name
          return (
            <button key={item.name} onClick={() => onItemClick(item.name)}
              className={`flex items-center gap-2 min-w-0 w-full text-left rounded-lg px-1.5 py-1 transition-colors ${
                isActive ? 'bg-slate-100' : 'hover:bg-slate-100/60'
              }`}>
              <span className="text-[10px] text-slate-300 w-3.5 shrink-0 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className={`text-[11px] truncate ${isActive ? 'font-semibold' : 'text-slate-600'}`}
                    style={isActive ? { color } : undefined}>{item.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{Math.round(item.pct * 100)}%</span>
                </div>
                <div className="h-0.5 bg-slate-200 rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(item.pct / maxPct) * 100}%`, backgroundColor: color ?? '#94a3b8', opacity: isActive ? 1 : 0.45 }} />
                </div>
              </div>
              <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${isActive ? '' : 'text-slate-700'}`}
                style={isActive ? { color } : undefined}>
                {item.amount.toLocaleString('ko-KR')}원
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Year/Month Picker ── */
function YearMonthPicker({ year, month, onChange }: {
  year: number; month: number | null
  onChange: (year: number, month: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [tempYear, setTempYear] = useState(year)
  const [yearInput, setYearInput] = useState(String(year))
  const [editingYear, setEditingYear] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setTempYear(year); setYearInput(String(year)) }, [year])

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function commitYearInput() {
    const parsed = parseInt(yearInput, 10)
    if (!isNaN(parsed) && parsed >= 2000 && parsed <= 2100) {
      setTempYear(parsed)
    } else {
      setYearInput(String(tempYear))
    }
    setEditingYear(false)
  }

  const label = month ? `${year}년 ${month}월` : `${year}년 전체`

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-56">
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => setTempYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {editingYear ? (
              <input
                type="text"
                inputMode="numeric"
                value={yearInput}
                onChange={e => setYearInput(e.target.value)}
                onBlur={commitYearInput}
                onKeyDown={e => { if (e.key === 'Enter') commitYearInput(); if (e.key === 'Escape') { setYearInput(String(tempYear)); setEditingYear(false) } }}
                className="w-16 text-center text-sm font-bold text-slate-700 border-b border-slate-300 focus:outline-none focus:border-[#1A237E] bg-transparent"
                autoFocus
              />
            ) : (
              <button onClick={() => { setEditingYear(true); setYearInput(String(tempYear)) }}
                className="text-sm font-bold text-slate-700 hover:text-[#1A237E] transition-colors px-2 py-0.5 rounded hover:bg-slate-50">
                {tempYear}년
              </button>
            )}
            <button onClick={() => setTempYear(y => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            <button onClick={() => { onChange(tempYear, null); setOpen(false) }}
              className={`col-span-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                year === tempYear && month === null
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}>전체</button>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button key={m} onClick={() => { onChange(tempYear, m); setOpen(false) }}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  year === tempYear && month === m
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}>{m}월</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Record Card ── */
function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const { memberOpts } = useContext(FormCtx)
  const { catColors } = useTheme()
  const isExpense = record.type === 'expense'
  const label = isExpense ? (record.detail || record.category) : (record as IncomeRecord).description
  const incomeColor = !isExpense ? (INCOME_COLORS[record.category] ?? '#5A6476') : undefined
  const memberColor = record.member ? (memberOpts.find(m => m.code === record.member)?.color ?? '#64748b') : undefined

  return (
    <button onClick={onClick}
      className={`text-left w-full bg-white rounded-xl border p-3 hover:shadow-sm transition-all ${
        isExpense
          ? 'border-slate-100 hover:border-slate-300'
          : 'border-l-4 border-slate-100 hover:border-slate-200'
      }`}
      style={!isExpense ? { borderLeftColor: incomeColor } : undefined}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 수입/지출 아이콘 */}
          <span className={`flex items-center justify-center w-5 h-5 rounded-full ${
            isExpense ? 'bg-slate-100 text-slate-400' : 'text-white'
          }`} style={!isExpense ? { backgroundColor: incomeColor } : undefined}>
            {isExpense ? <ExpenseIcon /> : <IncomeIcon />}
          </span>
          {isExpense ? (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: catColors[record.category] ?? '#94a3b8' }}>{record.category}</span>
          ) : (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: incomeColor }}>{record.category}</span>
          )}
        </div>
        <span className={`text-sm font-bold shrink-0 ${isExpense ? 'text-slate-800' : ''}`}
          style={!isExpense ? { color: incomeColor } : undefined}>
          {formatWonFull(record.amount)}
        </span>
      </div>
      <p className="text-xs text-slate-700 font-medium truncate mb-1">{label}</p>
      {record.memo && (
        <p className="text-[10px] text-slate-400 truncate mb-1">{record.memo}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{record.date}</span>
        <div className="flex items-center gap-1.5">
          {isExpense && record.method && <span className="text-[10px] text-slate-400">{record.method}</span>}
          {record.member && memberColor && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${memberColor}22`, color: memberColor }}>{record.member}</span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ── Summary Card ── */
const EXPENSE_COLOR = '#1A237E'
const INCOME_COLOR = '#390069'

function SummaryCard({ expenseCount, expenseTotal, incomeCount, incomeTotal, onAddExpense, onAddIncome }: {
  expenseCount: number; expenseTotal: number; incomeCount: number; incomeTotal: number
  onAddExpense: () => void; onAddIncome: () => void
}) {
  return (
    <div className="rounded-xl overflow-hidden flex"
      style={{ background: `linear-gradient(to right, ${EXPENSE_COLOR}, ${INCOME_COLOR})` }}>
      {/* 지출 절반 */}
      <button onClick={onAddExpense}
        className="flex-1 p-3 text-left transition-opacity hover:opacity-90 group"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
            </svg>
            지출
          </span>
          <svg className="w-3.5 h-3.5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-xs text-white/60 mb-0.5 text-right">{expenseCount}건</p>
        <p className="text-sm font-bold text-white tabular-nums leading-tight text-right">
          {expenseTotal.toLocaleString('ko-KR')}원
        </p>
      </button>
      {/* 중앙 구분선 */}
      <div className="w-px bg-white/20 my-3" />
      {/* 수입 절반 */}
      <button onClick={onAddIncome}
        className="flex-1 p-3 text-left transition-opacity hover:opacity-90 group"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-white/20 text-white">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
            </svg>
            수입
          </span>
          <svg className="w-3.5 h-3.5 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-xs text-white/60 mb-0.5 text-right">{incomeCount}건</p>
        <p className="text-sm font-bold text-white tabular-nums leading-tight text-right">
          {incomeTotal.toLocaleString('ko-KR')}원
        </p>
      </button>
    </div>
  )
}

/* ── Main Page ── */
export default function InputPage() {
  const { palette, catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const [createType, setCreateType] = useState<'expense' | 'income' | null>(null)
  const [records, setRecords] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState<AnyRecord | null>(null)
  const [detailsByCategory, setDetailsByCategory] = useState<Record<string, string[]>>({})
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>(DEFAULT_MEMBERS)
  const [methodOpts, setMethodOpts] = useState<MethodOpt[]>(DEFAULT_METHODS)
  const [searchQuery, setSearchQuery] = useState('')

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number | null>(now.getMonth() + 1)

  useEffect(() => {
    fetch('/api/options/details').then(r => r.json()).then((data: { name: string; category: string }[]) => {
      if (Array.isArray(data)) {
        const grouped: Record<string, string[]> = {}
        for (const d of data) { const cat = d.category || '미분류'; (grouped[cat] ??= []).push(d.name) }
        setDetailsByCategory(grouped)
      }
    }).catch(() => {})
    fetch('/api/options/members').then(r => r.json()).then(data => { if (Array.isArray(data) && data.length) setMemberOpts(data) }).catch(() => {})
    fetch('/api/options/methods').then(r => r.json()).then((data: MethodOpt[]) => { if (Array.isArray(data) && data.length) setMethodOpts(data.map(m => ({ name: m.name, color: m.color ?? '#94a3b8' }))) }).catch(() => {})
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/expenses?year=${viewYear}${viewMonth !== null ? `&month=${viewMonth}` : ''}`),
      fetch(`/api/incomes?year=${viewYear}${viewMonth !== null ? `&month=${viewMonth}` : ''}`),
    ])
    const [expData, incData] = await Promise.all([expRes.json(), incRes.json()])
    const expenses: ExpenseRecord[] = (expData.expenses ?? []).map((e: {
      id: number; expense_date: string; category: string; detail: string
      method: string; member: string; amount: number; memo: string
    }) => ({
      type: 'expense' as const, id: e.id, date: e.expense_date, category: e.category,
      detail: e.detail ?? '', method: e.method ?? '', member: e.member ?? '', amount: e.amount, memo: e.memo ?? '',
    }))
    const incomes: IncomeRecord[] = (Array.isArray(incData) ? incData : []).map((i: {
      id: number; income_date: string; category: string; description: string
      amount: number; member: string | null; memo: string
    }) => ({
      type: 'income' as const, id: i.id, date: i.income_date, category: i.category,
      description: i.description ?? '', amount: i.amount, member: i.member, memo: i.memo ?? '',
    }))
    const combined = [...expenses, ...incomes].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    setRecords(combined)
    setLoading(false)
  }, [viewYear, viewMonth])

  useEffect(() => { fetchAll() }, [fetchAll])

  function handleSaved() {
    fetchAll()
    setEditRecord(null)
    setCreateType(null)
  }

  async function handleDelete() {
    if (!editRecord) return
    if (!confirm('삭제하시겠습니까?')) return
    const url = editRecord.type === 'expense' ? `/api/expenses/${editRecord.id}` : `/api/incomes/${editRecord.id}`
    await fetch(url, { method: 'DELETE' })
    setEditRecord(null)
    fetchAll()
  }

  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [detailFilter, setDetailFilter] = useState<string | null>(null)
  const [memberFilter, setMemberFilter] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')

  const visibleExpenseCategories = useMemo(
    () => CATEGORIES.filter(c => !(excludeLoan && c === '대출상환')),
    [excludeLoan]
  )

  const availableCategories = useMemo(() => {
    if (typeFilter === 'expense') return visibleExpenseCategories
    if (typeFilter === 'income') return INCOME_CATEGORIES as readonly string[]
    return [...visibleExpenseCategories, ...INCOME_CATEGORIES] as string[]
  }, [typeFilter, visibleExpenseCategories])

  // Base list before detailFilter (used for breakdown computation)
  const baseFilteredList = useMemo(() => {
    let list = records
    if (excludeLoan) list = list.filter(r => !(r.type === 'expense' && r.category === '대출상환'))
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter)
    if (categoryFilter) list = list.filter(r => r.category === categoryFilter)
    if (memberFilter) list = list.filter(r => r.member === memberFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(r => {
        const label = r.type === 'expense' ? ((r as ExpenseRecord).detail || r.category) : (r as IncomeRecord).description
        return label.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          (r.memo ?? '').toLowerCase().includes(q) ||
          (r.member ?? '').toLowerCase().includes(q) ||
          r.date.includes(q) ||
          (r.type === 'expense' && (r as ExpenseRecord).method.toLowerCase().includes(q))
      })
    }
    return list
  }, [records, excludeLoan, typeFilter, categoryFilter, memberFilter, searchQuery])

  const filteredRecords = useMemo(() => {
    let list = baseFilteredList
    if (detailFilter) {
      list = list.filter(r => {
        const key = r.type === 'expense'
          ? ((r as ExpenseRecord).detail || '(미분류)')
          : (r as IncomeRecord).description || '(미분류)'
        return key === detailFilter
      })
    }
    return [...list].sort((a, b) => {
      if (sortMode === 'date_asc') return a.date.localeCompare(b.date) || a.id - b.id
      if (sortMode === 'date_desc') return b.date.localeCompare(a.date) || b.id - a.id
      if (sortMode === 'amount_asc') return a.amount - b.amount
      if (sortMode === 'amount_desc') return b.amount - a.amount
      return 0
    })
  }, [baseFilteredList, detailFilter, sortMode])

  const expenseCount = filteredRecords.filter(r => r.type === 'expense').length
  const incomeCount = filteredRecords.filter(r => r.type === 'income').length
  const expenseTotal = filteredRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const incomeTotal = filteredRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0)

  const breakdown = useMemo(() => {
    if (!categoryFilter) return []
    const total = baseFilteredList.reduce((s, r) => s + r.amount, 0)
    if (total === 0) return []
    const groups: Record<string, number> = {}
    for (const r of baseFilteredList) {
      const key = r.type === 'expense'
        ? ((r as ExpenseRecord).detail || '(미분류)')
        : (r as IncomeRecord).description || '(미분류)'
      groups[key] = (groups[key] ?? 0) + r.amount
    }
    return Object.entries(groups)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({ name, amount, pct: amount / total }))
  }, [baseFilteredList, categoryFilter])

  return (
    <FormCtx.Provider value={{ memberOpts, methodOpts, detailsByCategory }}>
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>수입 지출 관리</h1>
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        {/* Header with year/month selector + search */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <YearMonthPicker
            year={viewYear} month={viewMonth}
            onChange={(y, m) => { setViewYear(y); setViewMonth(m) }}
          />
          <div className="relative flex items-center">
            <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-5 pr-5 border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-[#1A237E] transition-colors w-48"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-50 mb-4">
          {/* Type filter */}
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setCategoryFilter(null); setDetailFilter(null) }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${typeFilter === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <span className="text-slate-200 text-xs">|</span>
          {/* Member filter */}
          <div className="flex gap-1">
            {memberOpts.map(m => {
              const isActive = memberFilter === m.code
              return (
                <button key={m.code} onClick={() => setMemberFilter(prev => prev === m.code ? null : m.code)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${isActive ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  style={isActive ? { backgroundColor: m.color } : undefined}>
                  {m.display_name}
                </button>
              )
            })}
          </div>
          <span className="text-slate-200 text-xs">|</span>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {availableCategories.map(cat => {
              const color = catColors[cat] ?? INCOME_COLORS[cat]
              const isActive = categoryFilter === cat
              return (
                <button key={cat} onClick={() => { setCategoryFilter(prev => prev === cat ? null : cat); setDetailFilter(null) }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    isActive ? 'text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  style={isActive && color ? { backgroundColor: color } : undefined}>
                  {cat}
                </button>
              )
            })}
          </div>
          <span className="text-slate-200 text-xs">|</span>
          {/* Sort toggle buttons */}
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setSortMode(m => m === 'date_desc' ? 'date_asc' : 'date_desc')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                sortMode === 'date_desc' || sortMode === 'date_asc' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              날짜{sortMode === 'date_desc' ? ' ↓' : sortMode === 'date_asc' ? ' ↑' : ' ↕'}
            </button>
            <button
              onClick={() => setSortMode(m => m === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                sortMode === 'amount_desc' || sortMode === 'amount_asc' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              금액{sortMode === 'amount_desc' ? ' ↓' : sortMode === 'amount_asc' ? ' ↑' : ' ↕'}
            </button>
          </div>
        </div>

        {/* Category breakdown panel */}
        {categoryFilter && breakdown.length > 0 && (
          <CategoryBreakdown
            category={categoryFilter}
            items={breakdown}
            color={catColors[categoryFilter] ?? INCOME_COLORS[categoryFilter]}
            activeItem={detailFilter}
            onItemClick={name => setDetailFilter(prev => prev === name ? null : name)}
          />
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              <SummaryCard expenseCount={expenseCount} expenseTotal={expenseTotal} incomeCount={incomeCount} incomeTotal={incomeTotal}
                onAddExpense={() => setCreateType('expense')} onAddIncome={() => setCreateType('income')} />
              {filteredRecords.map(r => (
                <RecordCard key={`${r.type}-${r.id}`} record={r} onClick={() => setEditRecord(r)} />
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <p className="text-xs text-slate-400 py-8 text-center">
                {searchQuery ? '검색 결과가 없습니다.' : viewMonth ? `${viewMonth}월 내역이 없습니다.` : '내역이 없습니다.'}
              </p>
            )}
          </>
        )}
      </div>

      {editRecord?.type === 'expense' && (
        <ExpenseEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} />
      )}
      {editRecord?.type === 'income' && (
        <IncomeEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} />
      )}
      {createType === 'expense' && (
        <ExpenseCreateModal onClose={() => setCreateType(null)} onSaved={handleSaved} />
      )}
      {createType === 'income' && (
        <IncomeCreateModal onClose={() => setCreateType(null)} onSaved={handleSaved} />
      )}
    </div>
    </FormCtx.Provider>
  )
}
