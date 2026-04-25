'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, catBadgeStyle, formatWonFull } from '@/lib/utils'
import { field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'

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

function PillBtn({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  const { palette } = useTheme()
  const bg = active ? (color ?? palette.colors[0]) : undefined
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${active ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
      style={bg ? { backgroundColor: bg, borderColor: bg } : undefined}>
      {children}
    </button>
  )
}

function MemberToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {['L', 'P'].map(m => <PillBtn key={m} active={value === m} onClick={() => onChange(m)}>{m}</PillBtn>)}
    </div>
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

interface Suggestions { details: string[]; methods: string[] }

/* ── Compact Expense Form ── */
function CompactExpenseForm({ onSaved, suggestions }: { onSaved: () => void; suggestions: Suggestions }) {
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState('L')
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState('')
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
      setDetail(''); setMethod(''); setAmount(''); setMemo('')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {/* Row 1: 날짜 + 작성자 + 금액 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={setMember} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-32">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            placeholder="0"
            className={`${field.input} text-right`} />
        </div>
      </div>

      {/* Row 2: 지출유형 버튼 */}
      <div>
        <label className={field.label}>지출유형</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {CATEGORIES.map(c => (
            <PillBtn key={c} active={category === c} onClick={() => setCategory(c)}>{c}</PillBtn>
          ))}
        </div>
      </div>

      {/* Row 3: 세부유형 */}
      <div>
        <label className={field.label}>세부유형</label>
        <input type="text" value={detail} onChange={e => setDetail(e.target.value)}
          list="detail-suggestions"
          placeholder="식비, 교통비…"
          className={field.input} />
        <datalist id="detail-suggestions">
          {suggestions.details.map(d => <option key={d} value={d} />)}
        </datalist>
      </div>

      {/* Row 4: 결제수단 버튼 */}
      <div>
        <label className={field.label}>결제수단</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {suggestions.methods.length > 0
            ? suggestions.methods.map(m => (
                <PillBtn key={m} active={method === m} onClick={() => setMethod(prev => prev === m ? '' : m)}>{m}</PillBtn>
              ))
            : ['카드', '현금', '이체'].map(m => (
                <PillBtn key={m} active={method === m} onClick={() => setMethod(prev => prev === m ? '' : m)}>{m}</PillBtn>
              ))
          }
        </div>
      </div>

      {/* Row 5: 비고 */}
      <div>
        <label className={field.label}>비고</label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="메모를 입력하세요"
          rows={2}
          className={`${field.input} resize-none`} />
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

/* ── Compact Income Form ── */
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
      {/* Row 1 */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <MemberToggle value={member} onChange={v => setMember(v as 'L' | 'P')} />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-32">
          <label className={field.label}>금액 (원)</label>
          <input type="text" inputMode="numeric" value={amount}
            onChange={e => setAmount(fmtAmount(e.target.value))}
            placeholder="0"
            className={`${field.input} text-right`} />
        </div>
      </div>

      {/* Row 2: 카테고리 버튼 */}
      <div>
        <label className={field.label}>카테고리</label>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {INCOME_CATEGORIES.map(c => (
            <PillBtn key={c} active={category === c} onClick={() => setCategory(c)}
              color={INCOME_COLORS[c]}>{c}</PillBtn>
          ))}
        </div>
      </div>

      {/* Row 3: 설명 */}
      <div>
        <label className={field.label}>설명</label>
        <input type="text" value={description} onChange={e => setDescription(e.target.value)}
          placeholder="수입 내용"
          className={field.input} />
      </div>

      {/* Row 4: 비고 */}
      <div>
        <label className={field.label}>비고</label>
        <textarea value={memo} onChange={e => setMemo(e.target.value)}
          placeholder="메모를 입력하세요"
          rows={2}
          className={`${field.input} resize-none`} />
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

/* ── Edit Modal (expense) ── */
function ExpenseEditModal({ record, onClose, onSaved, onDelete, suggestions }: {
  record: ExpenseRecord; onClose: () => void; onSaved: () => void; onDelete: () => void; suggestions: Suggestions
}) {
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
    <ModalShell onClose={onClose} title="지출 수정">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              className={`${field.input} text-right`} />
          </div>
        </div>
        <div>
          <label className={field.label}>지출유형</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {CATEGORIES.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)}>{c}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>세부유형</label>
          <input type="text" value={detail} onChange={e => setDetail(e.target.value)}
            list="detail-suggestions-modal" placeholder="식비, 교통비…" className={field.input} />
          <datalist id="detail-suggestions-modal">
            {suggestions.details.map(d => <option key={d} value={d} />)}
          </datalist>
        </div>
        <div>
          <label className={field.label}>결제수단</label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {(suggestions.methods.length > 0 ? suggestions.methods : ['카드', '현금', '이체']).map(m => (
              <PillBtn key={m} active={method === m} onClick={() => setMethod(prev => prev === m ? '' : m)}>{m}</PillBtn>
            ))}
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            rows={3} className={`${field.input} resize-none`} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-between items-center pt-1">
          <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: '#1A237E' }}>
              {saving ? '저장 중…' : '수정'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Edit Modal (income) ── */
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
    <ModalShell onClose={onClose} title="수입 수정">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={v => setMember(v)} />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-32">
            <label className={field.label}>금액 (원)</label>
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              className={`${field.input} text-right`} />
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
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={field.input} />
        </div>
        <div>
          <label className={field.label}>비고</label>
          <textarea value={memo} onChange={e => setMemo(e.target.value)}
            rows={3} className={`${field.input} resize-none`} />
        </div>
        {err && <p className="text-xs text-rose-500">{err}</p>}
        <div className="flex justify-between items-center pt-1">
          <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-600 transition-colors">삭제</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors">취소</button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 transition-colors"
              style={{ backgroundColor: '#1A237E' }}>
              {saving ? '저장 중…' : '수정'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Modal Shell ── */
function ModalShell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/* ── Record Card ── */
function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const isExpense = record.type === 'expense'
  const label = isExpense ? (record.detail || record.category) : (record as IncomeRecord).description
  const color = !isExpense ? (INCOME_COLORS[record.category] ?? '#64748b') : undefined

  return (
    <button onClick={onClick}
      className="text-left w-full bg-white rounded-xl border border-slate-100 p-3 hover:border-slate-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isExpense ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
            {isExpense ? '지출' : '수입'}
          </span>
          {isExpense ? (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={catBadgeStyle(record.category)}>{record.category}</span>
          ) : (
            <span className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: color }}>{record.category}</span>
          )}
        </div>
        <span className={`text-sm font-bold shrink-0 ${isExpense ? 'text-slate-800' : 'text-blue-700'}`}>{formatWonFull(record.amount)}</span>
      </div>
      <p className="text-xs text-slate-700 font-medium truncate mb-1">{label}</p>
      {record.memo && (
        <p className="text-[10px] text-slate-400 truncate mb-1">{record.memo}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{record.date}</span>
        <div className="flex items-center gap-1.5">
          {isExpense && record.method && <span className="text-[10px] text-slate-400">{record.method}</span>}
          {record.member && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${record.member === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>{record.member}</span>
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
  const [suggestions, setSuggestions] = useState<Suggestions>({ details: [], methods: [] })
  const formKey = useRef(0)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  useEffect(() => {
    fetch('/api/expenses/suggestions').then(r => r.json()).then(data => {
      if (!data.error) setSuggestions(data)
    }).catch(() => {})
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/expenses?year=${currentYear}&month=${currentMonth}`),
      fetch(`/api/incomes?year=${currentYear}&month=${currentMonth}`),
    ])
    const [expData, incData] = await Promise.all([expRes.json(), incRes.json()])
    const expenses: ExpenseRecord[] = (expData.expenses ?? []).map((e: { id: number; expense_date: string; category: string; detail: string; method: string; member: string; amount: number; memo: string }) => ({
      type: 'expense' as const, id: e.id, date: e.expense_date, category: e.category,
      detail: e.detail ?? '', method: e.method ?? '', member: e.member ?? '', amount: e.amount, memo: e.memo ?? '',
    }))
    const incomes: IncomeRecord[] = (Array.isArray(incData) ? incData : []).map((i: { id: number; income_date: string; category: string; description: string; amount: number; member: string | null; memo: string }) => ({
      type: 'income' as const, id: i.id, date: i.income_date, category: i.category,
      description: i.description ?? '', amount: i.amount, member: i.member, memo: i.memo ?? '',
    }))
    const combined = [...expenses, ...incomes].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    setRecords(combined)
    setLoading(false)
  }, [currentYear, currentMonth])

  useEffect(() => { fetchAll() }, [fetchAll])

  function handleSaved() {
    fetchAll()
    setEditRecord(null)
    formKey.current += 1
    // refresh suggestions after save
    fetch('/api/expenses/suggestions').then(r => r.json()).then(data => { if (!data.error) setSuggestions(data) }).catch(() => {})
  }

  async function handleDelete() {
    if (!editRecord) return
    if (!confirm('삭제하시겠습니까?')) return
    const url = editRecord.type === 'expense' ? `/api/expenses/${editRecord.id}` : `/api/incomes/${editRecord.id}`
    await fetch(url, { method: 'DELETE' })
    setEditRecord(null)
    fetchAll()
  }

  const expenseCount = records.filter(r => r.type === 'expense').length
  const incomeCount = records.filter(r => r.type === 'income').length

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#1A237E' }}>수입/지출 입력</h1>
        <p className="text-xs text-slate-400 mt-0.5">{currentYear}년 {currentMonth}월</p>
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
          ? <CompactExpenseForm key={`expense-${formKey.current}`} onSaved={handleSaved} suggestions={suggestions} />
          : <CompactIncomeForm key={`income-${formKey.current}`} onSaved={handleSaved} />
        }
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">{currentMonth}월 내역</h2>
          <span className="text-xs text-slate-400">지출 {expenseCount}건 · 수입 {incomeCount}건</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-slate-50 rounded-xl animate-pulse" />)}
          </div>
        ) : records.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">이번 달 내역이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {records.map(r => (
              <RecordCard key={`${r.type}-${r.id}`} record={r} onClick={() => setEditRecord(r)} />
            ))}
          </div>
        )}
      </div>

      {/* Edit modals */}
      {editRecord?.type === 'expense' && (
        <ExpenseEditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={handleSaved}
          onDelete={handleDelete}
          suggestions={suggestions}
        />
      )}
      {editRecord?.type === 'income' && (
        <IncomeEditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={handleSaved}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
