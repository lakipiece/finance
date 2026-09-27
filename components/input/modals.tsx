'use client'

// 수입·지출 생성/수정 모달 (app/input/page.tsx에서 분리)
import { useState, useEffect, useRef, useContext } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, INCOME_CATEGORIES, INCOME_COLORS } from '@/lib/utils'
import { useKeepOpen } from '@/lib/useKeepOpen'
import { useEntryFormKeys } from '@/lib/useEntryFormKeys'
import KeepOpenToggle from '@/components/ui/KeepOpenToggle'
import DateInput from '@/components/ui/DateInput'
import { field } from '@/lib/styles'
import { useTheme } from '@/lib/ThemeContext'
import { useFilter } from '@/lib/FilterContext'
import { DEFAULT_MEMBERS, DEFAULT_METHODS, FormCtx, evalFormula, fmtAmount, isFormula, parseAmount, todayStr } from './shared'
import { AutoResizeMemo, DetailSearchInput, MemberToggle, PillBtn, SuggestInput, TrashIcon, fetchExpenseMemos, fetchIncomeSuggestions } from './fields'

export interface ExpenseRecord {
  type: 'expense'
  id: number; date: string; category: string; detail: string
  method: string; member: string; amount: number; memo: string
}
export interface IncomeRecord {
  type: 'income'
  id: number; date: string; category: string; description: string
  amount: number; member: string | null; memo: string
}
export type AnyRecord = ExpenseRecord | IncomeRecord

/* ── Modal Shell ── */
export function ModalShell({ onClose, title, onDelete, children }: {
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
            {onDelete ? <button onClick={onDelete} title="삭제" className="p-1.5 rounded-btn text-ink-5 hover:text-danger hover:bg-danger/10 transition-all">
                <TrashIcon />
              </button> : null}
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
export function ExpenseEditModal({ record, onClose, onSaved, onDelete }: {
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
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-title font-bold tracking-[-0.015em] tabular-nums text-ink placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
          {isFormula(amount) && expenseEditFormulaResult !== null ? <span className="text-micro tracking-normal text-right tabular-nums block text-ink-3 mt-0.5">
              = {expenseEditFormulaResult.toLocaleString('ko-KR')}원
            </span> : null}
          {isFormula(amount) && expenseEditFormulaResult === null ? <span className="text-micro tracking-normal text-right block text-danger mt-0.5">수식 오류</span> : null}
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
export function IncomeEditModal({ record, onClose, onSaved, onDelete }: {
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
    if (!date || !category || !description || amount.trim() === '') { setErr('모든 필드를 입력해주세요.'); return }
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
            <input type="text" inputMode="text" value={amount}
              onChange={e => setAmount(fmtAmount(e.target.value))}
              placeholder="0"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-title font-bold tracking-[-0.015em] tabular-nums text-income placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
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
export function ExpenseCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (keepOpen: boolean) => void }) {
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
        // 금액과 비고는 건마다 달라지므로 비운다.
        // 분류·결제수단·작성자는 연속 입력에서 대개 같은 값이라 남긴다.
        setAmount('')
        setMemo('')
        // 커서는 첫 필드인 날짜로. 다음 건을 처음부터 다시 훑어 넣게 된다.
        const dateEl = dateRef.current?.querySelector('input')
        dateEl?.focus()
        dateEl?.select()   // 바로 yyyymmdd를 덮어쓸 수 있게
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
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-title font-bold tracking-[-0.015em] tabular-nums text-ink placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
            <span className="text-meta sm:text-subhead font-bold text-ink-3 shrink-0">원</span>
          </div>
          {isFormula(amount) && createFormulaResult !== null ? <span className="text-micro tracking-normal text-right tabular-nums block text-ink-3 mt-0.5">
              = {createFormulaResult.toLocaleString('ko-KR')}원
            </span> : null}
          {isFormula(amount) && createFormulaResult === null ? <span className="text-micro tracking-normal text-right block text-danger mt-0.5">수식 오류</span> : null}
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
export function IncomeCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (keepOpen: boolean) => void }) {
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
    if (!date || !category || !description || amount.trim() === '') { setErr('모든 필드를 입력해주세요.'); return }
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
        setMemo('')
        const dateEl = dateRef.current?.querySelector('input')
        dateEl?.focus()
        dateEl?.select()   // 바로 yyyymmdd를 덮어쓸 수 있게
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
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-right text-heading sm:text-title font-bold tracking-[-0.015em] tabular-nums text-income placeholder:text-ink-5/50 placeholder:font-normal focus:outline-none" />
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
