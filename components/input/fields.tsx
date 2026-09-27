'use client'

// 입력 필드 — 메모·버튼·사용자 토글·자동완성 (app/input/page.tsx에서 분리)
import { useState, useEffect, useRef, useMemo, useContext } from 'react'
import { createPortal } from 'react-dom'
import { field } from '@/lib/styles'
import { FormCtx } from './shared'

export function AutoResizeMemo({ value, onChange, placeholder, className }: {
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
export function PillBtn({ active, onClick, children, color, size = 'md' }: {
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

export function MemberToggle({ value, onChange, size = 'md' }: {
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

export function DetailSearchInput({ value, onChange, suggestions, placeholder }: {
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
export function SuggestInput({ value, onChange, fetcher, placeholder, className, multiline = true, maxLength }: {
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
export async function fetchExpenseMemos(q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/expenses/memos?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    return data.memos ?? []
  } catch { return [] }
}
export async function fetchIncomeSuggestions(field: 'description' | 'memo', q: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/incomes/suggestions?field=${field}&q=${encodeURIComponent(q)}`)
    const data = await res.json()
    return data.items ?? []
  } catch { return [] }
}

export function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

/* ── Icons ── */
export function IncomeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
    </svg>
  )
}

export function ExpenseIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7l-7 7-7-7" />
    </svg>
  )
}

/* ── Types ── */
