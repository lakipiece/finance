'use client'

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS, formatWonFull, formatDate } from '@/lib/utils'
import CategoryBadge from '@/components/ui/CategoryBadge'
import { useKeepOpen } from '@/lib/useKeepOpen'
import { useEntryFormKeys } from '@/lib/useEntryFormKeys'
import KeepOpenToggle from '@/components/ui/KeepOpenToggle'
import DateInput from '@/components/ui/DateInput'
import YearMonthPicker from '@/components/ui/YearMonthPicker'
import PageHeader from '@/components/ui/PageHeader'
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
  { name: '카드', color: '#a8b3c4' },
  { name: '현금', color: '#a8b3c4' },
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
/**
 * 분류 pill — 드롭다운이 아니라 상시 노출.
 * 선택 상태는 잉크 배경(#131b2e)으로만 표현하고, 카테고리색은 점에 남긴다.
 * 색을 배경으로 쓰면 선택 여부와 카테고리 종류가 같은 채널을 두고 다투게 된다.
 */
function PillBtn({ active, onClick, children, color, size = 'md' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string; size?: 'sm' | 'md'
}) {
  // 입력 화면은 밀도 압축의 예외 구역이다. 11px 글자에 padding만 주면
  // 높이가 19px까지 내려가 손가락으로 맞히기 어렵다 — 최소 터치 높이를 준다.
  const sizeClass = size === 'sm'
    ? 'px-3 py-1.5 min-h-[36px] sm:min-h-[28px] text-meta gap-1'
    : 'px-[11px] py-2 min-h-[40px] sm:min-h-[32px] text-body gap-[5px]'
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center justify-center leading-none rounded-full transition-colors whitespace-nowrap ${sizeClass} ${
        active ? 'bg-action text-white font-bold' : 'bg-surface-low text-ink-2 font-medium hover:opacity-80'
      }`}>
      {color ? (
        <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      ) : null}
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
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  // 목록은 body로 나가 있으므로 바깥 클릭 판정에서 따로 제외해야 한다.
  // 안 그러면 항목을 누르는 mousedown이 "바깥 클릭"으로 잡혀 click 전에 닫힌다.
  const listRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const LIST_MAX = 232
  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim()
    if (!q) return suggestions.slice(0, 30)
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 30)
  }, [suggestions, value])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // 모달 안에서 잘리지 않도록 body로 띄우고, 아래 공간이 모자라면 위로 뒤집는다
  useEffect(() => {
    if (!open) return
    function measure() {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const below = window.innerHeight - r.bottom
      setPos({
        top: below < LIST_MAX + 12 ? r.top - 4 : r.bottom + 4,
        left: r.left,
        width: r.width,
        flip: below < LIST_MAX + 12,
      })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  // 포커스가 인풋과 목록을 모두 벗어나면 닫는다 (Tab으로 다음 필드로 갈 때 포함).
  // 항목 클릭은 mousedown에서 preventDefault로 포커스를 잡아두므로 여기 걸리지 않는다.
  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const next = e.relatedTarget as Node | null
    if (next && listRef.current?.contains(next)) return
    setOpen(false)
    setActiveIdx(-1)
  }

  // 목록이 열려 있는 동안 ↑↓로 항목을 옮기고 ⏎로 확정한다.
  // 이때 ⏎가 폼 저장으로 새지 않도록 이벤트를 여기서 끊는다.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const listOpen = open && filtered.length > 0
    if (!listOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i <= 0 ? filtered.length : i) - 1)
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault(); e.stopPropagation()
      onChange(filtered[activeIdx]); setOpen(false); setActiveIdx(-1)
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation()
      setOpen(false); setActiveIdx(-1)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <input type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setActiveIdx(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? '세부유형 검색…'}
        maxLength={30}
        autoComplete="off"
        className={field.input} />
      {open && filtered.length > 0 && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listRef}
              className="fixed z-[10020] bg-surface-card rounded-field shadow-dialog overflow-y-auto py-1"
              style={{
                top: pos.flip ? undefined : pos.top,
                bottom: pos.flip ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: pos.width,
                maxHeight: LIST_MAX,
              }}
            >
              {filtered.map((s, i) => (
                <button key={s} type="button"
                  ref={i === activeIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => { onChange(s); setOpen(false); setActiveIdx(-1) }}
                  className={`w-full text-left px-3 py-1.5 text-body text-ink truncate ${
                    i === activeIdx ? 'bg-surface-low' : ''
                  }`}>
                  {s}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/* 자동완성 입력: 2글자 이상 입력 후 '?' 를 치면 최근 항목 목록(역순)을 보여줌.
   '?' 는 트리거 문자로 소비되어 값에는 남지 않음. fetcher 는 최근순 정렬된 문자열 배열 반환. */
function SuggestInput({ value, onChange, fetcher, placeholder, className, multiline = true, maxLength }: {
  value: string
  onChange: (v: string) => void
  fetcher: (q: string) => Promise<string[]>
  placeholder?: string
  className?: string
  multiline?: boolean
  maxLength?: number
}) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  // 모달 안에서는 overflow에 잘리므로 목록을 body로 띄운다.
  // 아래 공간이 모자라면 위로 뒤집는다.
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  const LIST_MAX = 232

  function measure() {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    setPos({
      top: below < LIST_MAX + 12 ? r.top - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      flip: below < LIST_MAX + 12,
    })
  }

  useEffect(() => {
    if (!open) return
    measure()
    const onScroll = () => measure()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  useEffect(() => {
    if (!multiline) return
    const el = taRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value, multiline])

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  async function triggerSearch(q: string) {
    try {
      const items = await fetcher(q.trim())
      setSuggestions(items)
      setOpen(items.length > 0)
    } catch { setSuggestions([]); setOpen(false) }
  }

  function handleChange(raw: string) {
    // 2글자 이상 입력 후 '?' 입력 시에만 목록 표시 ('?' 는 제거)
    if (raw.endsWith('?')) {
      const q = raw.slice(0, -1)
      if (q.trim().length >= 2) {
        onChange(q)
        triggerSearch(q)
        setActiveIdx(-1)
        return
      }
    }
    onChange(raw)
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleBlur(e: React.FocusEvent<HTMLElement>) {
    const next = e.relatedTarget as Node | null
    if (next && listRef.current?.contains(next)) return
    setOpen(false)
    setActiveIdx(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const listOpen = open && suggestions.length > 0
    if (!listOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i <= 0 ? suggestions.length : i) - 1)
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault(); e.stopPropagation()
      onChange(suggestions[activeIdx]); setOpen(false); setActiveIdx(-1)
    } else if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation()
      setOpen(false); setActiveIdx(-1)
    }
  }

  return (
    <div className="relative" ref={ref}>
      {multiline ? (
        <textarea ref={taRef} value={value} rows={1}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`${className} resize-none overflow-hidden`}
          style={{ minHeight: '2rem' }} />
      ) : (
        <input type="text" value={value}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className={className} />
      )}
      {open && suggestions.length > 0 && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listRef}
              className="fixed z-[10020] bg-surface-card rounded-field shadow-dialog overflow-y-auto py-1"
              style={{
                top: pos.flip ? undefined : pos.top,
                bottom: pos.flip ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                width: pos.width,
                maxHeight: LIST_MAX,
              }}
            >
              {suggestions.map((s, i) => (
                <button key={s} type="button"
                  ref={i === activeIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => { onChange(s); setOpen(false); setActiveIdx(-1) }}
                  className={`w-full text-left px-3 py-1.5 text-body text-ink ${
                    i === activeIdx ? 'bg-surface-low' : ''
                  }`}>
                  {s}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/* 자동완성 fetcher */
async function fetchExpenseMemos(q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/expenses/memos?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    return data.memos ?? []
  } catch { return [] }
}
async function fetchIncomeSuggestions(field: 'description' | 'memo', q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/incomes/suggestions?field=${field}&q=${encodeURIComponent(q)}`)
    const data = await res.json()
    return data.items ?? []
  } catch { return [] }
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

/* ── Modal Shell ── */
function ModalShell({ onClose, title, onDelete, children }: {
  onClose: () => void; title: string; onDelete?: () => void; children: React.ReactNode
}) {
  return createPortal(
    // 바깥이 스크롤 컨테이너, 안쪽 래퍼가 중앙 정렬을 맡는다.
    // flex 중앙 정렬 위에서 바로 스크롤을 걸면 내용이 뷰포트보다 클 때 위쪽이 잘린다.
    <div className="modal-scrim fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-surface-card rounded-dialog shadow-dialog w-full max-w-md flex flex-col max-h-[calc(100dvh-2rem)] overflow-hidden">
        {/* 헤더 — 15px 18px, 구분선 없음 */}
        <div className="flex items-center justify-between px-[18px] py-[15px] shrink-0">
          <h3 className="text-heading text-ink">{title}</h3>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button onClick={onDelete} title="삭제" className="p-1.5 rounded-btn text-ink-5 hover:text-danger hover:bg-danger/10 transition-all">
                <TrashIcon />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-btn text-ink-5 hover:text-ink-2 hover:bg-surface-low transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        {/* 본문 — 0 18px 16px, 여기만 스크롤한다 */}
        <div className="px-[18px] pb-4 overflow-y-auto flex-1 min-h-0">{children}</div>
        </div>
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
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '수정 실패')
      onSaved()
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  return (
    <ModalShell onClose={onClose} title="지출 수정" onDelete={onDelete}>
      <div className="grid gap-[14px]">
        <div className="flex flex-wrap gap-[14px] items-end">
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
        <div>
          <label className={field.label}>결제수단</label>
          <div className="flex flex-wrap gap-1 mt-1">
            {methodOpts.map(m => <PillBtn key={m.name} active={method === m.name} onClick={() => setMethod(m.name)} color={m.color} size="sm">{m.name}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
        {/* 금액 — 입력 모달과 같은 자리(마지막)·같은 규격 */}
        <div>
          <label className={field.label}>금액 (원)</label>
          <div className="flex items-baseline gap-1.5 rounded-field bg-surface-low px-3 py-[9px] focus-within:bg-surface-card focus-within:shadow-focus transition-colors">
            <input type="text" inputMode="text" value={amount}
              onChange={e => { const v = e.target.value; setAmount(isFormula(v) ? v : fmtAmount(v)) }}
              onBlur={resolveExpenseEditAmount}
              placeholder="0 또는 =수식"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-[20px] font-bold tracking-[-0.015em] tabular-nums text-ink placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
          {isFormula(amount) && expenseEditFormulaResult !== null && (
            <span className="text-micro tracking-normal text-right tabular-nums block text-ink-3 mt-0.5">
              = {expenseEditFormulaResult.toLocaleString('ko-KR')}원
            </span>
          )}
          {isFormula(amount) && expenseEditFormulaResult === null && (
            <span className="text-micro tracking-normal text-right block text-danger mt-0.5">수식 오류</span>
          )}
        </div>
        {err ? <p className="text-body text-danger">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-[15px] py-2 rounded-btn text-body font-medium text-ink-2 bg-surface-high hover:opacity-90 transition-opacity">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-[17px] py-2 rounded-btn text-body font-bold text-white bg-action disabled:opacity-60 transition-opacity hover:opacity-90">
            {saving ? '저장 중…' : <>수정 <span className="font-normal opacity-60">⏎</span></>}
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
      <div className="grid gap-[14px]">
        <div className="flex flex-wrap gap-[14px] items-end">
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
        <div>
          <label className={field.label}>설명</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            maxLength={50} className={field.input} />
        </div>
        <div>
          <label className={field.label}>비고</label>
          <AutoResizeMemo value={memo} onChange={setMemo} placeholder="메모" className={field.input} />
        </div>
        {/* 금액 — 입력 모달과 같은 자리(마지막)·같은 규격 */}
        <div>
          <label className={field.label}>금액 (원)</label>
          <div className="flex items-baseline gap-1.5 rounded-field bg-surface-low px-3 py-[9px] focus-within:bg-surface-card focus-within:shadow-focus transition-colors">
            <input type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              placeholder="0"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-[20px] font-bold tracking-[-0.015em] tabular-nums text-income placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
        </div>
        {err ? <p className="text-body text-danger">{err}</p> : null}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-[15px] py-2 rounded-btn text-body font-medium text-ink-2 bg-surface-high hover:opacity-90 transition-opacity">취소</button>
          <button onClick={handleSave} disabled={saving}
            className="px-[17px] py-2 rounded-btn text-body font-bold text-white bg-action disabled:opacity-60 transition-opacity hover:opacity-90">
            {saving ? '저장 중…' : <>수정 <span className="font-normal opacity-60">⏎</span></>}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Expense Create Modal ── */
function ExpenseCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (keepOpen: boolean) => void }) {
  const { catColors } = useTheme()
  const { excludeLoan } = useFilter()
  const { memberOpts, methodOpts, detailsByCategory } = useContext(FormCtx)
  const visibleCategories = CATEGORIES.filter(c => !(excludeLoan && c === '대출상환'))
  const [date, setDate] = useState(() => sessionStorage.getItem('exp-date') ?? todayStr())
  const [member, setMember] = useState(() => sessionStorage.getItem('exp-member') ?? memberOpts[0]?.code ?? DEFAULT_MEMBERS[0].code)
  const [category, setCategory] = useState('변동비')
  const [detail, setDetail] = useState('')
  const [method, setMethod] = useState(methodOpts[0]?.name ?? DEFAULT_METHODS[0].name)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [keepOpen, setKeepOpen] = useKeepOpen()

  // Tab 순서: 금액 → 분류 → 내역 → 날짜 → 결제수단 → 저장
  const amountRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const methodRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)

  // 날짜는 오늘이 기본값이라 대개 손대지 않는다. 실제로 매번 채우는 세부유형에 커서를 둔다.
  useEffect(() => { detailRef.current?.focus() }, [])

  function handleDateChange(v: string) { setDate(v); sessionStorage.setItem('exp-date', v) }
  function handleMemberChange(v: string) { setMember(v); sessionStorage.setItem('exp-member', v) }

  function resolveCreateAmount() {
    if (isFormula(amount)) {
      const r = evalFormula(amount)
      if (r !== null) setAmount(r.toLocaleString('ko-KR'))
    }
  }
  const createFormulaResult = isFormula(amount) ? evalFormula(amount) : null

  // 저장 버튼은 비활성화하지 않는다 — 비활성 버튼은 이유를 알려주지 못한다.
  // 클릭 시점에 오류를 표시한다.
  async function handleSave(continueEntry = keepOpen) {
    resolveCreateAmount()
    const amt = isFormula(amount) ? (evalFormula(amount) ?? 0) : parseAmount(amount)
    if (!date || !category || amount.trim() === '') { setErr('날짜, 유형, 금액을 확인해주세요.'); return }
    if (amt < 1) { setErr('금액은 1원 이상이어야 합니다.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/expenses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expense_date: date, category, detail: detail || null, method: method || null, member, amount: amt, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved(continueEntry)
      if (continueEntry) {
        // 금액만 비우고 커서를 되돌린다. 나머지는 다음 건에서도 대개 같은 값이다.
        setAmount('')
        amountRef.current?.focus()
      }
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  const isDirty = amount.trim() !== '' || detail.trim() !== '' || memo.trim() !== ''
  function handleCancel() {
    if (isDirty && !window.confirm('입력한 내용을 버리고 닫을까요?')) return
    onClose()
  }

  useEntryFormKeys({
    onSave: () => handleSave(),
    onSaveAndContinue: () => handleSave(true),
    onCancel: handleCancel,
    onPickCategory: i => { if (visibleCategories[i]) setCategory(visibleCategories[i]) },
    tabOrder: [dateRef, categoryRef, detailRef, methodRef, amountRef, saveRef],
    disabled: saving,
  })

  return (
    <ModalShell onClose={handleCancel} title="지출 입력">
      <div className="grid gap-[14px]">
        <div className="flex flex-wrap gap-[14px] items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <div ref={dateRef} tabIndex={-1} className="outline-none">
              <DateInput value={date} onChange={handleDateChange} className="w-36" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={handleMemberChange} size="sm" />
          </div>
        </div>
        {/* 분류 — 드롭다운이 아니라 4개 상시 노출. 1–4로도 고른다 */}
        <div>
          <label className={field.label}>지출유형</label>
          <div ref={categoryRef} tabIndex={-1} className="flex flex-wrap gap-1 mt-1 outline-none">
            {visibleCategories.map(c => <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={catColors[c]} size="sm">{c}</PillBtn>)}
          </div>
        </div>
        <div>
          <label className={field.label}>세부유형</label>
          <div ref={detailRef} tabIndex={-1} className="outline-none">
            <DetailSearchInput value={detail} onChange={setDetail} suggestions={detailsByCategory[category] ?? []} />
          </div>
        </div>
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <label className={field.label}>결제수단</label>
            <div ref={methodRef} tabIndex={-1} className="flex flex-wrap gap-1 mt-1 outline-none">
              {methodOpts.map(m => <PillBtn key={m.name} active={method === m.name} onClick={() => setMethod(m.name)} color={m.color} size="sm">{m.name}</PillBtn>)}
            </div>
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <SuggestInput value={memo} onChange={setMemo} fetcher={fetchExpenseMemos} placeholder="메모 (2글자+? 로 검색)" className={field.input} />
        </div>
        {/* 금액 — 마지막. 앞 필드가 다 정해진 뒤에 확정한다 */}
        <div>
          <label className={field.label}>금액 (원)</label>
          <div className="flex items-baseline gap-1.5 rounded-field bg-surface-low px-3 py-[9px] focus-within:bg-surface-card focus-within:shadow-focus transition-colors">
            <input ref={amountRef} type="text" inputMode="text" value={amount}
              onChange={e => { const v = e.target.value; setAmount(isFormula(v) ? v : fmtAmount(v)) }}
              onBlur={resolveCreateAmount}
              placeholder="0 또는 =수식"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-[20px] font-bold tracking-[-0.015em] tabular-nums text-ink placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
          {isFormula(amount) && createFormulaResult !== null && (
            <span className="text-micro tracking-normal text-right tabular-nums block text-ink-3 mt-0.5">
              = {createFormulaResult.toLocaleString('ko-KR')}원
            </span>
          )}
          {isFormula(amount) && createFormulaResult === null && (
            <span className="text-micro tracking-normal text-right block text-danger mt-0.5">수식 오류</span>
          )}
        </div>
        {err ? <p className="text-body text-danger">{err}</p> : null}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <KeepOpenToggle checked={keepOpen} onChange={setKeepOpen} />
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-[15px] py-2 rounded-btn text-body font-medium text-ink-2 bg-surface-high hover:opacity-90 transition-opacity">취소</button>
            <button ref={saveRef} onClick={() => handleSave()} disabled={saving}
              className="px-[17px] py-2 rounded-btn text-body font-bold text-white bg-action disabled:opacity-60 transition-opacity hover:opacity-90">
              {saving ? '저장 중…' : <>저장 <span className="font-normal opacity-60">⏎</span></>}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

/* ── Income Create Modal ── */
function IncomeCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (keepOpen: boolean) => void }) {
  const { memberOpts } = useContext(FormCtx)
  const [date, setDate] = useState(todayStr())
  const [member, setMember] = useState(memberOpts[0]?.code ?? DEFAULT_MEMBERS[0].code)
  const [category, setCategory] = useState<string>(INCOME_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [keepOpen, setKeepOpen] = useKeepOpen()

  const amountRef = useRef<HTMLInputElement>(null)
  const categoryRef = useRef<HTMLDivElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const dateRef = useRef<HTMLDivElement>(null)
  const saveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { descRef.current?.focus() }, [])

  async function handleSave(continueEntry = keepOpen) {
    const amt = parseAmount(amount)
    if (!date || !category || !description || amt < 1) { setErr('모든 필드를 입력해주세요.'); return }
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/incomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income_date: date, category, description, amount: amt, member, memo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      onSaved(continueEntry)
      if (continueEntry) {
        setAmount('')
        amountRef.current?.focus()
      }
    } catch (e) { setErr(e instanceof Error ? e.message : '오류') }
    finally { setSaving(false) }
  }

  const isDirty = amount.trim() !== '' || description.trim() !== '' || memo.trim() !== ''
  function handleCancel() {
    if (isDirty && !window.confirm('입력한 내용을 버리고 닫을까요?')) return
    onClose()
  }

  useEntryFormKeys({
    onSave: () => handleSave(),
    onSaveAndContinue: () => handleSave(true),
    onCancel: handleCancel,
    onPickCategory: i => { if (INCOME_CATEGORIES[i]) setCategory(INCOME_CATEGORIES[i]) },
    tabOrder: [dateRef, categoryRef, descRef, amountRef, saveRef],
    disabled: saving,
  })

  return (
    <ModalShell onClose={handleCancel} title="수입 입력">
      <div className="grid gap-[14px]">
        <div className="flex flex-wrap gap-[14px] items-end">
          <div className="flex flex-col gap-1">
            <label className={field.label}>날짜</label>
            <div ref={dateRef} tabIndex={-1} className="outline-none">
              <DateInput value={date} onChange={setDate} className="w-36" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={field.label}>작성자</label>
            <MemberToggle value={member} onChange={setMember} size="sm" />
          </div>
        </div>
        <div>
          <label className={field.label}>카테고리</label>
          <div ref={categoryRef} tabIndex={-1} className="flex flex-wrap gap-1 mt-1 outline-none">
            {INCOME_CATEGORIES.map(c => (
              <PillBtn key={c} active={category === c} onClick={() => setCategory(c)} color={INCOME_COLORS[c]} size="sm">{c}</PillBtn>
            ))}
          </div>
        </div>
        <div>
          <label className={field.label}>설명</label>
          <div ref={descRef} tabIndex={-1} className="outline-none">
            <SuggestInput value={description} onChange={setDescription}
              fetcher={q => fetchIncomeSuggestions('description', q)}
              placeholder="수입 내용 (2글자+? 로 검색)" maxLength={50} multiline={false} className={field.input} />
          </div>
        </div>
        <div>
          <label className={field.label}>비고</label>
          <SuggestInput value={memo} onChange={setMemo}
            fetcher={q => fetchIncomeSuggestions('memo', q)}
            placeholder="메모 (2글자+? 로 검색)" className={field.input} />
        </div>
        {/* 금액 — 단독 확대 */}
        <div>
          <label className={field.label}>금액 (원)</label>
          <div className="flex items-baseline gap-1.5 rounded-field bg-surface-low px-3 py-[9px] focus-within:bg-surface-card focus-within:shadow-focus transition-colors">
            <input ref={amountRef} type="text" inputMode="numeric" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              placeholder="0"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-[20px] font-bold tracking-[-0.015em] tabular-nums text-income placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
        </div>
        {err ? <p className="text-body text-danger">{err}</p> : null}
        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <KeepOpenToggle checked={keepOpen} onChange={setKeepOpen} />
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-[15px] py-2 rounded-btn text-body font-medium text-ink-2 bg-surface-high hover:opacity-90 transition-opacity">취소</button>
            <button ref={saveRef} onClick={() => handleSave()} disabled={saving}
              className="px-[17px] py-2 rounded-btn text-body font-bold text-white bg-action disabled:opacity-60 transition-opacity hover:opacity-90">
              {saving ? '저장 중…' : <>저장 <span className="font-normal opacity-60">⏎</span></>}
            </button>
          </div>
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
    <div className="mb-6 px-4 py-3 bg-surface-low rounded-field">
      {/* 필터 칩이 붙어도 높이가 변하지 않도록 자리를 미리 잡아 둔다 —
          안 그러면 필터를 걸 때마다 아래 내용이 몇 px씩 밀린다 */}
      <div className="flex items-center gap-2 mb-3 min-h-[22px]">
        <p className="text-meta font-medium text-ink-3">{category} 항목별 집계</p>
        {activeItem && (
          <button onClick={() => onItemClick(activeItem)}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-micro tracking-normal font-medium bg-surface-card text-ink-3 hover:text-ink transition-colors">
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
              className={`flex items-center gap-2 min-w-0 w-full text-left rounded-btn px-1.5 py-1 transition-colors ${
                isActive ? 'bg-surface-card shadow-card' : 'hover:bg-surface-card/60'
              }`}>
              <span className="text-micro tracking-normal text-ink-5 w-3.5 shrink-0 text-right">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className={`text-meta truncate ${isActive ? 'font-medium' : 'text-ink-2'}`}
                    style={isActive ? { color } : undefined}>{item.name}</span>
                  <span className="text-micro tracking-normal text-ink-4 shrink-0">{Math.round(item.pct * 100)}%</span>
                </div>
                <div className="h-0.5 bg-surface-high rounded-full">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${(item.pct / maxPct) * 100}%`, backgroundColor: color ?? '#a8b3c4', opacity: isActive ? 1 : 0.45 }} />
                </div>
              </div>
              <span className={`text-meta font-medium shrink-0 tabular-nums ${isActive ? '' : 'text-ink'}`}
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


/* ── Record Card ── */
function RecordCard({ record, onClick }: { record: AnyRecord; onClick: () => void }) {
  const { memberOpts } = useContext(FormCtx)
  const { catColors } = useTheme()
  const isExpense = record.type === 'expense'
  const label = isExpense ? (record.detail || record.category) : (record as IncomeRecord).description
  const incomeColor = !isExpense ? (INCOME_COLORS[record.category] ?? '#5A6476') : undefined
  const memberColor = record.member ? (memberOpts.find(m => m.code === record.member)?.color ?? '#5b6a80') : undefined

  return (
    <button onClick={onClick}
      className="text-left w-full bg-surface-card rounded-card p-3 shadow-card transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 수입/지출 아이콘 */}
          <span className={`flex items-center justify-center w-5 h-5 rounded-full ${
            isExpense ? 'bg-surface-low text-ink-4' : 'text-white'
          }`} style={!isExpense ? { backgroundColor: incomeColor } : undefined}>
            {isExpense ? <ExpenseIcon /> : <IncomeIcon />}
          </span>
          <CategoryBadge category={record.category} size="sm"
            color={isExpense ? (catColors[record.category] ?? '#a8b3c4') : incomeColor} />
        </div>
        <span className={`text-subhead font-bold shrink-0 ${isExpense ? 'text-ink' : ''}`}
          style={!isExpense ? { color: incomeColor } : undefined}>
          {formatWonFull(record.amount)}
        </span>
      </div>
      <p className="text-body text-ink font-medium truncate mb-1">{label}</p>
      {record.memo && (
        <p className="text-micro tracking-normal text-ink-4 truncate mb-1">{record.memo}</p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-micro tracking-normal text-ink-4 tabular-nums">{formatDate(record.date)}</span>
        <div className="flex items-center gap-1.5">
          {isExpense && record.method && <span className="text-micro tracking-normal text-ink-4">{record.method}</span>}
          {record.member && memberColor && (
            <span className="text-micro tracking-normal font-bold px-1.5 py-0.5 rounded"
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
    // 건수·금액 자릿수에 따라 줄 수가 달라져 카드가 늘었다 줄었다 했다.
    // 내용과 무관하게 높이를 고정한다.
    <div className="rounded-field overflow-hidden flex h-[108px]"
      style={{ background: `linear-gradient(to right, ${EXPENSE_COLOR}, ${INCOME_COLOR})` }}>
      {/* 지출 절반 */}
      <button onClick={onAddExpense}
        className="flex-1 min-w-0 p-3 text-left transition-opacity hover:opacity-90 group flex flex-col justify-between"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-body font-bold bg-white/20 text-white">
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
        <p className="text-body text-white/60 mb-0.5 text-right">{expenseCount}건</p>
        <p className="text-subhead font-bold text-white tabular-nums leading-tight text-right whitespace-nowrap overflow-hidden text-ellipsis">
          {expenseTotal.toLocaleString('ko-KR')}원
        </p>
      </button>
      {/* 중앙 구분선 */}
      <div className="w-px bg-white/20 my-3" />
      {/* 수입 절반 */}
      <button onClick={onAddIncome}
        className="flex-1 min-w-0 p-3 text-left transition-opacity hover:opacity-90 group flex flex-col justify-between"
        style={{ background: 'transparent' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-body font-bold bg-white/20 text-white">
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
        <p className="text-body text-white/60 mb-0.5 text-right">{incomeCount}건</p>
        <p className="text-subhead font-bold text-white tabular-nums leading-tight text-right whitespace-nowrap overflow-hidden text-ellipsis">
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
  // 전체기간 모드에서 실제로 서버 조회에 사용된 검색어 (버튼 클릭 시점에 확정)
  const [committedQuery, setCommittedQuery] = useState('')

  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState<number | null>(now.getMonth() + 1)
  const [viewAllPeriod, setViewAllPeriod] = useState(false)

  useEffect(() => {
    fetch('/api/options/details').then(r => r.json()).then((data: { name: string; category: string }[]) => {
      if (Array.isArray(data)) {
        const grouped: Record<string, string[]> = {}
        for (const d of data) { const cat = d.category || '미분류'; (grouped[cat] ??= []).push(d.name) }
        setDetailsByCategory(grouped)
      }
    }).catch(() => {})
    fetch('/api/options/members').then(r => r.json()).then(data => { if (Array.isArray(data) && data.length) setMemberOpts(data) }).catch(() => {})
    fetch('/api/options/methods').then(r => r.json()).then((data: MethodOpt[]) => { if (Array.isArray(data) && data.length) setMethodOpts(data.map(m => ({ name: m.name, color: m.color ?? '#a8b3c4' }))) }).catch(() => {})
  }, [])

  const fetchData = useCallback(async (query: string) => {
    setLoading(true)
    const qs = viewAllPeriod
      ? `all=1&q=${encodeURIComponent(query.trim())}`
      : `year=${viewYear}${viewMonth !== null ? `&month=${viewMonth}` : ''}`
    const [expRes, incRes] = await Promise.all([
      fetch(`/api/expenses?${qs}`),
      fetch(`/api/incomes?${qs}`),
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
  }, [viewYear, viewMonth, viewAllPeriod])

  // 월/년 모드: 기간 변경 시 자동 조회. 전체기간 모드: 자동 조회 없이 검색 버튼 대기.
  useEffect(() => {
    if (viewAllPeriod) {
      setRecords([])
      setCommittedQuery('')
      setSearchQuery('')
      setLoading(false)
      return
    }
    fetchData('')
  }, [fetchData, viewAllPeriod])

  function handleSearch() {
    const q = searchQuery.trim()
    setCommittedQuery(q)
    if (!q) { setRecords([]); return }
    fetchData(q)
  }

  function clearSearch() {
    setSearchQuery('')
    if (viewAllPeriod) { setCommittedQuery(''); setRecords([]) }
  }

  // 전체기간이면 마지막 검색어로, 아니면 현재 기간으로 재조회
  function refetch() {
    if (viewAllPeriod) {
      const q = committedQuery.trim()
      if (q) fetchData(q)
    } else {
      fetchData('')
    }
  }

  // keepOpen이면 목록만 갱신하고 모달은 열어 둔다 (연속 입력)
  function handleSaved(keepOpen = false) {
    refetch()
    if (keepOpen) return
    setEditRecord(null)
    setCreateType(null)
  }

  async function handleDelete() {
    if (!editRecord) return
    if (!confirm('삭제하시겠습니까?')) return
    const url = editRecord.type === 'expense' ? `/api/expenses/${editRecord.id}` : `/api/incomes/${editRecord.id}`
    await fetch(url, { method: 'DELETE' })
    setEditRecord(null)
    refetch()
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
    // 전체기간 모드는 서버에서 이미 검색어로 필터링됨 → 클라 텍스트 필터 생략
    if (!viewAllPeriod && searchQuery.trim()) {
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
  }, [records, excludeLoan, typeFilter, categoryFilter, memberFilter, searchQuery, viewAllPeriod])

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
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <PageHeader title="수입 지출 관리">
        <YearMonthPicker
          year={viewYear} month={viewMonth} allPeriod={viewAllPeriod}
          align="right"
          onChange={(y, m, all) => { setViewYear(y); setViewMonth(m); setViewAllPeriod(all) }}
        />
      </PageHeader>

      {/* Records */}
      <div className="bg-surface-card rounded-card shadow-card p-[13px]">
        {/* Header with search */}
        <div className="flex items-center justify-end mb-4 gap-2 flex-wrap">
          <div className="relative flex items-center">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder={viewAllPeriod ? '검색어 입력 후 검색' : '검색...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (viewAllPeriod && e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              className="pl-9 pr-9 rounded-field bg-surface-low py-[9px] text-subhead text-ink placeholder:text-ink-5 focus:outline-none focus:bg-surface-card focus:shadow-focus transition-colors w-48 border-0"
            />
            {searchQuery && (
              <button onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-5 hover:text-ink-3 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {viewAllPeriod ? (
            <button onClick={handleSearch}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-btn text-body font-bold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#131b2e' }}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              검색
            </button>
          ) : null}
        </div>

        {/* Filter + Sort row */}
        <div className="flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-surface-low mb-4">
          {/* Type filter */}
          <div className="flex gap-1">
            {(['all', 'expense', 'income'] as const).map(t => (
              <button key={t} onClick={() => { setTypeFilter(t); setCategoryFilter(null); setDetailFilter(null) }}
                className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${typeFilter === t ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'}`}>
                {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Member filter */}
          <div className="flex gap-1">
            {memberOpts.map(m => {
              const isActive = memberFilter === m.code
              return (
                <button key={m.code} onClick={() => setMemberFilter(prev => prev === m.code ? null : m.code)}
                  className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${isActive ? 'text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'}`}
                  style={isActive ? { backgroundColor: m.color } : undefined}>
                  {m.display_name}
                </button>
              )
            })}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Category filter */}
          <div className="flex gap-1 flex-wrap">
            {availableCategories.map(cat => {
              const color = catColors[cat] ?? INCOME_COLORS[cat]
              const isActive = categoryFilter === cat
              return (
                <button key={cat} onClick={() => { setCategoryFilter(prev => prev === cat ? null : cat); setDetailFilter(null) }}
                  className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                    isActive ? 'text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
                  }`}
                  style={isActive && color ? { backgroundColor: color } : undefined}>
                  {cat}
                </button>
              )
            })}
          </div>
          <span className="text-ink-5 text-body">|</span>
          {/* Sort toggle buttons */}
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => setSortMode(m => m === 'date_desc' ? 'date_asc' : 'date_desc')}
              className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                sortMode === 'date_desc' || sortMode === 'date_asc' ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
              }`}>
              날짜{sortMode === 'date_desc' ? ' ↓' : sortMode === 'date_asc' ? ' ↑' : ' ↕'}
            </button>
            <button
              onClick={() => setSortMode(m => m === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
              className={`px-2.5 py-1 rounded-full text-meta font-medium transition-colors ${
                sortMode === 'amount_desc' || sortMode === 'amount_asc' ? 'bg-action text-white' : 'bg-surface-low text-ink-3 hover:bg-surface-high'
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-24 bg-surface-low rounded-field animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              <SummaryCard expenseCount={expenseCount} expenseTotal={expenseTotal} incomeCount={incomeCount} incomeTotal={incomeTotal}
                onAddExpense={() => setCreateType('expense')} onAddIncome={() => setCreateType('income')} />
              {filteredRecords.map(r => (
                <RecordCard key={`${r.type}-${r.id}`} record={r} onClick={() => setEditRecord(r)} />
              ))}
            </div>
            {filteredRecords.length === 0 && (
              <p className="text-body text-ink-4 py-8 text-center">
                {viewAllPeriod
                  ? (committedQuery ? '검색 결과가 없습니다.' : '검색어를 입력하고 검색 버튼을 누르세요.')
                  : searchQuery ? '검색 결과가 없습니다.' : viewMonth ? `${viewMonth}월 내역이 없습니다.` : '내역이 없습니다.'}
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
