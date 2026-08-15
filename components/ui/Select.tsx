'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SelectOption {
  value: string
  label: string
  /** 앞에 붙는 6px 점 색 (분류·계좌 등) */
  color?: string
}

interface Props {
  value: string
  options: SelectOption[]
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  /** 표 안 인라인 행에서 쓰는 조인 규격 */
  variant?: 'field' | 'cell'
}

const LIST_MAX = 260

/**
 * 드롭다운 — 네이티브 select는 OS 기본 목록이 떠서 앱 안에서 혼자 다른 표면이 된다.
 * 트리거는 채움형 필드, 목록은 다이얼로그 표면으로 통일한다.
 * 목록은 body로 띄워 모달 overflow에 잘리지 않게 하고, 아래가 좁으면 위로 뒤집는다.
 */
export default function Select({
  value, options, onChange, placeholder = '선택', disabled = false,
  className = '', variant = 'field',
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; flip: boolean } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)

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
    setActiveIdx(options.findIndex(o => o.value === value))
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, options, value])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    setActiveIdx(-1)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation(); setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation()
      setActiveIdx(i => (i <= 0 ? options.length : i) - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation()
      if (activeIdx >= 0 && options[activeIdx]) pick(options[activeIdx].value)
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation() }
      setOpen(false); setActiveIdx(-1)
    }
  }

  const triggerCls = variant === 'cell'
    ? `flex items-center justify-between gap-1 w-full rounded-cell bg-surface-card px-2 py-1.5 text-body tabular-nums transition-shadow ${open ? 'shadow-focus' : ''}`
    : `flex items-center justify-between gap-2 w-full rounded-field px-3 py-[9px] text-subhead transition-colors ${
        open ? 'bg-surface-card shadow-focus' : 'bg-surface-low'
      }`

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        onKeyDown={onKeyDown}
        className={`${triggerCls} disabled:opacity-50 disabled:cursor-not-allowed text-left`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-ink-5'}`}>
          {selected ? (
            <span className="inline-flex items-center gap-1.5 min-w-0">
              {selected.color ? (
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />
              ) : null}
              <span className="truncate">{selected.label}</span>
            </span>
          ) : placeholder}
        </span>
        <svg className={`shrink-0 text-ink-5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${
          variant === 'cell' ? 'w-2.5 h-2.5' : 'w-3 h-3'
        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={listRef}
              className="fixed z-[10030] bg-surface-card rounded-field shadow-dialog overflow-y-auto py-1"
              style={{
                top: pos.flip ? undefined : pos.top,
                bottom: pos.flip ? window.innerHeight - pos.top : undefined,
                left: pos.left,
                minWidth: pos.width,
                maxHeight: LIST_MAX,
              }}
            >
              {options.length === 0 ? (
                <p className="px-3 py-2 text-body text-ink-5">선택할 항목이 없습니다</p>
              ) : options.map((o, i) => (
                <button
                  key={o.value}
                  type="button"
                  ref={i === activeIdx ? el => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => pick(o.value)}
                  className={`w-full text-left px-3 py-1.5 text-body flex items-center gap-1.5 ${
                    o.value === value ? 'text-ink font-bold' : 'text-ink-2'
                  } ${i === activeIdx ? 'bg-surface-low' : ''}`}
                >
                  {o.color ? (
                    <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                  ) : null}
                  <span className="truncate">{o.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
