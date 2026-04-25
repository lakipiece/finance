'use client'

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, catBadgeStyle, formatWonFull } from '@/lib/utils'
import { field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'

/* ── Constants ── */
interface MemberOpt { code: string; display_name: string; color: string }
const DEFAULT_MEMBERS: MemberOpt[] = [
  { code: 'L', display_name: 'L', color: '#1565C0' },
  { code: 'P', display_name: 'P', color: '#AD1457' },
]
const DEFAULT_METHODS = ['카드', '현금', '지역화폐']
const FormCtx = createContext<{ memberOpts: MemberOpt[]; methodOpts: string[] }>({
  memberOpts: DEFAULT_MEMBERS,
  methodOpts: DEFAULT_METHODS,
})

/* ── Helpers ── */
function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtAmount(v: string) {
  const n = v.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString('ko-KR') : ''
}

function parseAmount(v: string) {
  return parseInt(v.replace(/[^0-9]/g, '')) || 0
}

/* ── Small components ── */
function PillBtn({ active, onClick, children, color }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string
}) {
  const { palette } = useTheme()
  const bg = active ? (color ?? palette.colors[0]) : undefined
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
        active ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
      }`}
      style={bg ? { backgroundColor: bg, borderColor: bg } : undefined}>
      {children}
    </button>
  )
}

function MemberToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { memberOpts } = useContext(FormCtx)
  return (
    <div className="flex gap-1">
      {memberOpts.map(m => (
        <PillBtn key={m.code} active={value === m.code} onClick={() => onChange(m.code)} color={m.color}>
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

/* ── Compact Expense Form (2-row layout) ── */
function CompactExpenseForm({ onSaved, details }: { onSaved: () => void; details: string[] }) {
  const { catColors } = useTheme()
  const { memberOpts, methodOpts } = useContext(FormCtx)
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState(() => DEFAULT_MEMBERS[0].code)
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState(() => DEFAULT_METHODS[0])
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || amt <= 0) { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo, memos: [] }),
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
      {/* Row 1: 날짜 | 지출유형 | 세부유형 | 결제수단 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]}>{c}</PillBtn>)}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-36">
          <label className={field.label}>세부유형</label>
          <DetailSearchInput value={detail} onChange={setDetail} suggestions={details} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>결제수단</label>
          <div className="flex flex-wrap gap-1.5">
            {methodOpts.map(m => <PillBtn key={m} active={method === m} onClick={() => setMethod(m)}>{m}</PillBtn>)}
          </div>
        </div>
      </div>

      {/* Row 2: 작성자 | 금액 | 비고 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={setMember} />
        </div>
        <div className="flex flex-col gap-1 w-44">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            placeholder="0" className={`${field.input} text-right`} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="메모" rows={2}
            className={`${field.input} resize-none leading-snug`} />
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

/* ── Compact Income Form (2-row layout) ── */
function CompactIncomeForm({ onSaved }: { onSaved: () => void }) {
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState<'L' | 'P'>('L')
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
      setDescription(''); setAmount(''); setMemo('')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {/* Row 1: 날짜 | 카테고리 | 설명 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>카테고리</label>
          <div className="flex flex-wrap gap-1.5">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]}>{c}</PillBtn>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-36">
          <label className={field.label}>설명</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="수입 내용" maxLength={50} className={field.input} />
        </div>
      </div>

      {/* Row 2: 작성자 | 금액 | 비고 */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={v => setMember(v as 'L' | 'P')} />
        </div>
        <div className="flex flex-col gap-1 w-44">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            placeholder="0" className={`${field.input} text-right`} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-48">
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="메모" rows={2}
            className={`${field.input} resize-none leading-snug`} />
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
  onClose: () => void; title: string; onDelete: () => void; children: React.ReactNode
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              title="삭제"
              className="p-1.5 rounded-lg text-slate-200 hover:text-rose-400 hover:bg-rose-50 transition-all"
            >
              <TrashIcon />
            </button>
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
function ExpenseEditModal({ record, onClose, onSaved, onDelete, details }: {
  record: ExpenseRecord; onClose: () => void; onSaved: () => void; onDelete: () => void; details: string[]
}) {
  const { catColors } = useTheme()
  const { methodOpts } = useContext(FormCtx)
  const [date, setDate] = useState(record.date)
  const [member, setMember] = useState(record.member)
  const [category, setCategory] = useState(record.category)
  const [detail, setDetail] = useState(record.detail)
  const [method, setMethod] = useState(record.method)
  const [amount, setAmount] = useState(fmtAmount(String(record.amount)))
  const [memo, setMemo] = useState(record.memo)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const amt = parseAmount(amount)
    if (!date || !category || amt <= 0) { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} />
          </div>
        </div>
        <div>
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CATEGORIES.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]}>{c}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>세부유형</label>
          <DetailSearchInput value={detail} onChange={setDetail} suggestions={details} />
        </div>
        <div>
          <label className={field.label}>결제수단</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {methodOpts.map(m => <PillBtn key={m} active={method === m} onClick={() => setMethod(m)}>{m}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            className={`${field.input} text-right`} />
        </div>
        <div>
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            rows={2} className={`${field.input} resize-none leading-snug`} />
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={v => setMember(v)} />
          </div>
        </div>
        <div>
          <label className={field.label}>카테고리</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]}>{c}</PillBtn>
            ))}
          </div>
        </div>
        <div>
          <label className={field.label}>설명</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            maxLength={50} className={field.input} />
        </div>
        <div>
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            className={`${field.input} text-right`} />
        </div>
        <div>
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            rows={2} className={`${field.input} resize-none leading-snug`} />
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

/* ── Record Card ── */
function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const { memberOpts } = useContext(FormCtx)
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
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(record.category)}>{record.category}</span>
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

/* ── Main Page ── */
export default function InputPage() {
  const { palette } = useTheme()
  const [tab, setTab] = useState<'expense' | 'income'>('expense')
  const [records, setRecords] = useState<AnyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editRecord, setEditRecord] = useState<AnyRecord | null>(null)
  const [details, setDetails] = useState<string[]>([])
  const [memberOpts, setMemberOpts] = useState<MemberOpt[]>(DEFAULT_MEMBERS)
  const [methodOpts, setMethodOpts] = useState<string[]>(DEFAULT_METHODS)
  const [searchQuery, setSearchQuery] = useState('')
  const formKey = useRef(0)

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number | null>(now.getMonth() + 1)
  const [editingYear, setEditingYear] = useState(false)
  const [yearInput, setYearInput] = useState(String(now.getFullYear()))

  useEffect(() => {
    fetch('/api/expenses/suggestions').then(r => r.json()).then(data => { if (!data.error) setDetails(data.details ?? []) }).catch(() => {})
    fetch('/api/options/members').then(r => r.json()).then(data => { if (Array.isArray(data) && data.length) setMemberOpts(data) }).catch(() => {})
    fetch('/api/options/methods').then(r => r.json()).then(data => { if (Array.isArray(data) && data.length) setMethodOpts(data.map((m: { name: string }) => m.name)) }).catch(() => {})
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
    formKey.current += 1
    fetch('/api/expenses/suggestions')
      .then(r => r.json())
      .then(data => { if (!data.error) setDetails(data.details ?? []) })
      .catch(() => {})
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
  const [sortMode, setSortMode] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc')

  const expenseCount = records.filter(r => r.type === 'expense').length
  const incomeCount = records.filter(r => r.type === 'income').length

  const availableCategories = useMemo(() => {
    if (typeFilter === 'expense') return CATEGORIES as readonly string[]
    if (typeFilter === 'income') return INCOME_CATEGORIES as readonly string[]
    return [...CATEGORIES, ...INCOME_CATEGORIES] as string[]
  }, [typeFilter])

  const filteredRecords = useMemo(() => {
    let list = records
    if (typeFilter !== 'all') list = list.filter(r => r.type === typeFilter)
    if (categoryFilter) list = list.filter(r => r.category === categoryFilter)
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
    return [...list].sort((a, b) => {
      if (sortMode === 'date_asc') return a.date.localeCompare(b.date) || a.id - b.id
      if (sortMode === 'date_desc') return b.date.localeCompare(a.date) || b.id - a.id
      if (sortMode === 'amount_asc') return a.amount - b.amount
      if (sortMode === 'amount_desc') return b.amount - a.amount
      return 0
    })
  }, [records, typeFilter, categoryFilter, searchQuery, sortMode])

  return (
    <FormCtx.Provider value={{ memberOpts, methodOpts }}>
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>수입 지출 관리</h1>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <div className="flex gap-1 mb-5">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
              style={tab === t ? { backgroundColor: palette.colors[0] } : undefined}>
              {t === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

        {tab === 'expense'
          ? <CompactExpenseForm key={`expense-${formKey.current}`} onSaved={handleSaved} details={details} />
          : <CompactIncomeForm key={`income-${formKey.current}`} onSaved={handleSaved} />
        }
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        {/* Header with year/month selector + search */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {editingYear ? (
              <input
                type="number"
                value={yearInput}
                onChange={e => setYearInput(e.target.value)}
                onBlur={() => {
                  const y = parseInt(yearInput)
                  if (y >= 2000 && y <= 2099) setViewYear(y)
                  else setYearInput(String(viewYear))
                  setEditingYear(false)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') { setYearInput(String(viewYear)); setEditingYear(false) }
                }}
                className="w-16 text-sm font-semibold text-slate-700 border-b border-slate-300 focus:outline-none focus:border-blue-400 text-center bg-transparent"
                autoFocus
              />
            ) : (
              <button onClick={() => { setEditingYear(true); setYearInput(String(viewYear)) }}
                className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">
                {viewYear}년
              </button>
            )}
            <select
              value={viewMonth ?? ''}
              onChange={e => setViewMonth(e.target.value === '' ? null : Number(e.target.value))}
              className="text-sm font-medium text-slate-600 border-0 border-b border-slate-200 bg-transparent focus:outline-none focus:border-blue-400 cursor-pointer py-0.5">
              <option value="">전체</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}월</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <svg className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-300 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-5 border-0 border-b border-slate-200 bg-transparent pb-1.5 pt-1 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none focus:border-[#1A237E] transition-colors w-48"
              />
            </div>
            <span className="text-xs text-slate-400">지출 {expenseCount}건 · 수입 {incomeCount}건</span>
          </div>
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-slate-50 mb-5">
          {/* Type filter */}
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setCategoryFilter(null) }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${typeFilter === t ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <span className="text-slate-200 text-xs">|</span>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {availableCategories.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(prev => prev === cat ? null : cat)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${categoryFilter === cat ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {cat}
              </button>
            ))}
          </div>
          <span className="text-slate-200 text-xs">|</span>
          {/* Sort buttons */}
          <div className="flex gap-1 ml-auto">
            {([
              { mode: 'date_desc', label: '날짜↓' },
              { mode: 'date_asc', label: '날짜↑' },
              { mode: 'amount_desc', label: '금액↓' },
              { mode: 'amount_asc', label: '금액↑' },
            ] as const).map(({ mode, label }) => (
              <button key={mode} onClick={() => setSortMode(mode)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${sortMode === mode ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : filteredRecords.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            {searchQuery ? '검색 결과가 없습니다.' : viewMonth ? `${viewMonth}월 내역이 없습니다.` : '내역이 없습니다.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredRecords.map(r => (
              <RecordCard key={`${r.type}-${r.id}`} record={r} onClick={() => setEditRecord(r)} />
            ))}
          </div>
        )}
      </div>

      {editRecord?.type === 'expense' && (
        <ExpenseEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} details={details} />
      )}
      {editRecord?.type === 'income' && (
        <IncomeEditModal record={editRecord} onClose={() => setEditRecord(null)}
          onSaved={handleSaved} onDelete={handleDelete} />
      )}
    </div>
    </FormCtx.Provider>
  )
}
