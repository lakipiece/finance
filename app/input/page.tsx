'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, catBadgeStyle, formatWonFull } from '@/lib/utils'
import { btn, field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'
import ExpenseInputForm, { type ExpenseItemForEdit } from '@/components/ExpenseInputForm'
import IncomeInputForm, { type IncomeItemForEdit } from '@/components/IncomeInputForm'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface MemoRow { label: string; amount: string }

interface ExpenseRecord {
  type: 'expense'
  id: number
  date: string        // expense_date
  category: string
  detail: string
  method: string
  member: string
  amount: number
  memo: string
}
interface IncomeRecord {
  type: 'income'
  id: number
  date: string        // income_date
  category: string
  description: string
  amount: number
  member: string | null
}
type AnyRecord = ExpenseRecord | IncomeRecord

function memberBadge(m: string | null) {
  if (!m) return null
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
      m === 'L' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
    }`}>{m}</span>
  )
}

/* ── Edit Modal ── */
function EditModal({
  record,
  onClose,
  onSaved,
  onDelete,
}: {
  record: AnyRecord
  onClose: () => void
  onSaved: () => void
  onDelete: () => void
}) {
  const expenseEdit: ExpenseItemForEdit | null =
    record.type === 'expense'
      ? { id: record.id, expense_date: record.date, category: record.category, detail: record.detail, method: record.method, member: record.member, amount: record.amount, memo: record.memo }
      : null
  const incomeEdit: IncomeItemForEdit | null =
    record.type === 'income'
      ? { id: record.id, income_date: record.date, category: record.category, description: record.description, amount: record.amount, member: record.member ?? 'L' }
      : null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {record.type === 'expense' ? (
            <ExpenseInputForm editItem={expenseEdit} onSaved={onSaved} onCancelEdit={onClose} />
          ) : (
            <IncomeInputForm editItem={incomeEdit} onSaved={onSaved} onCancelEdit={onClose} />
          )}
          <button
            onClick={onDelete}
            className="mt-3 w-full py-2 text-xs font-medium text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            삭제
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Compact Expense Form ── */
function CompactExpenseForm({ onSaved }: { onSaved: () => void }) {
  const { palette } = useTheme()
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState('L')
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState('')
  const [amount, setAmount] = useState('')
  const [showItems, setShowItems] = useState(false)
  const [memos, setMemos] = useState<MemoRow[]>([{ label: '', amount: '' }])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const totalFromMemos = memos.reduce((s, m) => s + (parseInt(m.amount.replace(/,/g, '')) || 0), 0)

  async function handleSave() {
    setSaving(true); setErr('')
    try {
      const memoList = showItems
        ? memos.filter(m => m.label.trim()).map(m => ({ label: m.label.trim(), amount: parseInt(m.amount.replace(/,/g, '')) || null }))
        : []
      const finalAmount = showItems
        ? memoList.reduce((s, m) => s + (m.amount ?? 0), 0)
        : parseInt(amount.replace(/,/g, ''))
      if (!date || !category || isNaN(finalAmount) || finalAmount <= 0) { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: finalAmount, memos: memoList }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setDetail(''); setMethod(''); setAmount(''); setMemos([{ label: '', amount: '' }]); setShowItems(false)
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      {/* Main fields row */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <div className="flex gap-1">
            {['L', 'P'].map(m => (
              <button key={m} type="button" onClick={() => setMember(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${member === m ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                style={member === m ? { backgroundColor: palette.colors[0] } : undefined}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>유형</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={`${field.select} w-28`}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-28">
          <label className={field.label}>세부유형</label>
          <input type="text" value={detail} onChange={e => setDetail(e.target.value)} placeholder="식비, 교통비…" className={field.input} />
        </div>
        <div className="flex flex-col gap-1 w-28">
          <label className={field.label}>결제수단</label>
          <input type="text" value={method} onChange={e => setMethod(e.target.value)} placeholder="신용카드…" className={field.input} />
        </div>
        {!showItems && (
          <div className="flex flex-col gap-1 w-32">
            <label className={field.label}>금액</label>
            <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={`${field.input} text-right`} />
          </div>
        )}
        <div className="flex gap-1.5 items-end pb-0.5">
          <button type="button" onClick={() => setShowItems(v => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showItems ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
            style={showItems ? { backgroundColor: palette.colors[0] } : undefined}>항목별</button>
          <button type="button" onClick={handleSave} disabled={saving}
            className={`${btn.primary} whitespace-nowrap`} style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {/* Items mode */}
      {showItems && (
        <div className="pl-1 space-y-2">
          {memos.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input type="text" value={row.label} onChange={e => setMemos(prev => prev.map((m, i) => i === idx ? { ...m, label: e.target.value } : m))}
                placeholder="항목명" className={`${field.input} flex-1`} />
              <input type="text" inputMode="numeric" value={row.amount} onChange={e => setMemos(prev => prev.map((m, i) => i === idx ? { ...m, amount: e.target.value } : m))}
                placeholder="금액" className={`${field.input} w-28 text-right`} />
              {memos.length > 1 && <button type="button" onClick={() => setMemos(prev => prev.filter((_, i) => i !== idx))} className={btn.danger}>✕</button>}
            </div>
          ))}
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMemos(prev => [...prev, { label: '', amount: '' }])} className={btn.ghost}>+ 항목 추가</button>
            {totalFromMemos > 0 && <span className="text-xs text-slate-500">합계: {totalFromMemos.toLocaleString()}원</span>}
          </div>
        </div>
      )}

      {err && <p className="text-xs text-rose-500">{err}</p>}
    </div>
  )
}

/* ── Compact Income Form ── */
function CompactIncomeForm({ onSaved }: { onSaved: () => void }) {
  const { palette } = useTheme()
  const [date, setDate] = useState(todayStr)
  const [member, setMember] = useState<'L' | 'P'>('L')
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    const parsedAmount = Number(amount.replace(/,/g, ''))
    if (!date || !category || !description || isNaN(parsedAmount) || parsedAmount <= 0) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: parsedAmount, member }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setDescription(''); setAmount('')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label className={field.label}>날짜</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`${field.input} w-36`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>작성자</label>
          <div className="flex gap-1">
            {(['L', 'P'] as const).map(m => (
              <button key={m} type="button" onClick={() => setMember(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${member === m ? 'text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                style={member === m ? { backgroundColor: palette.colors[0] } : undefined}>{m}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className={field.label}>카테고리</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={`${field.select} w-24`}>
            {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-28">
          <label className={field.label}>설명</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="수입 내용" className={field.input} />
        </div>
        <div className="flex flex-col gap-1 w-32">
          <label className={field.label}>금액</label>
          <input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className={`${field.input} text-right`} />
        </div>
        <div className="pb-0.5">
          <button type="button" onClick={handleSave} disabled={saving}
            className={`${btn.primary} whitespace-nowrap`} style={{ backgroundColor: palette.colors[0] }}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
      {err && <p className="text-xs text-rose-500">{err}</p>}
    </div>
  )
}

/* ── Record Card ── */
function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const isExpense = record.type === 'expense'
  const label = isExpense ? record.detail || record.category : (record as IncomeRecord).description
  const sub = isExpense ? record.method : ''
  const color = isExpense ? undefined : (INCOME_COLORS[record.category] ?? '#64748b')

  return (
    <button
      onClick={onClick}
      className="text-left w-full bg-white rounded-xl border border-slate-100 p-3 hover:border-slate-300 hover:shadow-sm transition-all"
    >
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
      <p className="text-xs text-slate-700 mb-1.5 truncate font-medium">{label}</p>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{record.date}</span>
        <div className="flex items-center gap-1.5">
          {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
          {memberBadge(record.member)}
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
  const formKey = useRef(0)

  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/expenses?year=${currentYear}&month=${currentMonth}`),
      fetch(`/api/incomes?year=${currentYear}&month=${currentMonth}`),
    ])
    const [expData, incData] = await Promise.all([expRes.json(), incRes.json()])
    const expenses: ExpenseRecord[] = (expData.expenses ?? []).map((e: { id: number; expense_date: string; category: string; detail: string; method: string; member: string; amount: number; memo: string }) => ({
      type: 'expense' as const, id: e.id, date: e.expense_date, category: e.category, detail: e.detail, method: e.method, member: e.member, amount: e.amount, memo: e.memo,
    }))
    const incomes: IncomeRecord[] = (Array.isArray(incData) ? incData : []).map((i: { id: number; income_date: string; category: string; description: string; amount: number; member: string | null }) => ({
      type: 'income' as const, id: i.id, date: i.income_date, category: i.category, description: i.description, amount: i.amount, member: i.member,
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
        {/* Tab toggle */}
        <div className="flex gap-1 mb-4">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t ? 'text-white' : 'bg-slate-100 text-slate-500'}`}
              style={tab === t ? { backgroundColor: palette.colors[0] } : undefined}
            >
              {t === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

        {tab === 'expense'
          ? <CompactExpenseForm key={`expense-${formKey.current}`} onSaved={handleSaved} />
          : <CompactIncomeForm key={`income-${formKey.current}`} onSaved={handleSaved} />
        }
      </div>

      {/* Records */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">{currentMonth}월 내역</h2>
          <span className="text-xs text-slate-400">
            지출 {expenseCount}건 · 수입 {incomeCount}건
          </span>
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
              <RecordCard
                key={`${r.type}-${r.id}`}
                record={r}
                onClick={() => setEditRecord(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editRecord && (
        <EditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={handleSaved}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
