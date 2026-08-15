'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  /**
   * D-05 — 자리에 따라 형태가 갈린다.
   *  'field'  폼 안: 채움형 필드 (기본)
   *  'inline' 화면 상단: 배경 없는 텍스트 + 셰브론
   *  'cell'   인라인 입력 행 안: 흰 배경 · 7px · 더 조인 패딩
   */
  variant?: 'field' | 'inline' | 'cell'
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

function parseDate(v: string): Date | null {
  if (!v) return null
  const d = new Date(v + 'T00:00:00')
  return isNaN(d.getTime()) ? null : d
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DateInput({ value, onChange, className = '', placeholder = '날짜 선택', variant = 'field' }: Props) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => {
    const d = parseDate(value)
    return d ? d.getFullYear() : new Date().getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    const d = parseDate(value)
    return d ? d.getMonth() : new Date().getMonth()
  })
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const calRef = useRef<HTMLDivElement>(null)

  const selected = parseDate(value)
  const today = new Date()
  const todayYMD = toYMD(today)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (
        calRef.current && !calRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function handleOpen() {
    if (open) { setOpen(false); return }
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      const calWidth = 248
      const calHeight = 300
      let left = r.left
      if (left + calWidth > window.innerWidth - 8) left = window.innerWidth - calWidth - 8
      const spaceBelow = window.innerHeight - r.bottom
      const top = spaceBelow < calHeight + 12
        ? r.top - calHeight - 6
        : r.bottom + 6
      setPos({ top, left })
    }
    const d = parseDate(value)
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()) }
    setOpen(true)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function getDays(): (number | null)[] {
    const first = new Date(viewYear, viewMonth, 1).getDay()
    const last = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(first).fill(null)
    for (let i = 1; i <= last; i++) cells.push(i)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    onChange(toYMD(d))
    setOpen(false)
  }

  // 날짜 표기 통일 — 2026.08.12
  const display = value ? value.replace(/-/g, '.') : placeholder

  // 자판으로 yyyymmdd를 그대로 두들겨 넣는 편이 달력을 여는 것보다 빠른 경우가 많다.
  // 입력 중에는 로컬 버퍼를 쓰고, 8자리가 채워지면 그때 값으로 확정한다.
  const [text, setText] = useState(() => (value ? value.replace(/-/g, '.') : ''))
  useEffect(() => { setText(value ? value.replace(/-/g, '.') : '') }, [value])

  function formatTyping(digits: string): string {
    if (digits.length <= 4) return digits
    if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`
  }

  /** 8자리가 실제 존재하는 날짜인지까지 본다 (2026.02.31 같은 값을 막는다) */
  function toValidYMD(digits: string): string | null {
    if (digits.length !== 8) return null
    const y = Number(digits.slice(0, 4))
    const m = Number(digits.slice(4, 6))
    const d = Number(digits.slice(6, 8))
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
    return toYMD(dt)
  }

  function handleType(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 8)
    setText(formatTyping(digits))
    const ymd = toValidYMD(digits)
    if (ymd) onChange(ymd)
    else if (digits.length === 0) onChange('')
  }

  /** 미완성·유효하지 않은 입력은 되돌린다 — 반쯤 입력된 날짜를 남기지 않는다 */
  function commitText() {
    const digits = text.replace(/\D/g, '')
    if (digits.length === 0) return
    if (!toValidYMD(digits)) setText(value ? value.replace(/-/g, '.') : '')
  }

  const calendar = open && (
    <div
      ref={calRef}
      className="fixed z-[10010] bg-surface-card rounded-dialog shadow-dialog p-4 select-none"
      style={{ top: pos.top, left: pos.left, width: 248 }}
    >
      {/* 헤더: 연/월 + 이전/다음 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-btn hover:bg-surface-low text-ink-5 hover:text-ink-2 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-meta text-ink-2">{viewYear}년 {MONTHS[viewMonth]}</span>
        <button onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-btn hover:bg-surface-low text-ink-5 hover:text-ink-2 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center text-micro tracking-normal pb-1.5 ${
            i === 0 || i === 6 ? 'text-ink-4' : 'text-ink-5'
          }`}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {getDays().map((day, i) => {
          if (day === null) return <div key={i} />
          const ymd = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isSelected = ymd === value
          const isToday = ymd === todayYMD
          const dow = i % 7
          const isSun = dow === 0
          const isSat = dow === 6
          return (
            <button
              key={i}
              onClick={() => selectDay(day)}
              className={`w-full aspect-square flex items-center justify-center rounded-btn text-meta tabular-nums transition-colors
                ${isSelected
                  ? 'bg-action text-white font-bold'
                  : isToday
                  ? 'text-ink font-bold hover:bg-surface-low'
                  : isSun || isSat
                  ? 'text-ink-4 hover:bg-surface-low'
                  : 'text-ink-2 hover:bg-surface-low'
                }`}
            >
              {isToday && !isSelected ? (
                <span className="relative">
                  {day}
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-action" />
                </span>
              ) : null}
              {!isToday || isSelected ? day : null}
            </button>
          )
        })}
      </div>

      {/* 하단: 오늘 */}
      <div className="mt-3 pt-2.5 flex justify-end">
        <button
          onClick={() => { onChange(todayYMD); setOpen(false) }}
          className="text-micro tracking-normal px-2.5 py-1 rounded-btn transition-colors text-ink-4 hover:text-ink hover:bg-surface-low"
        >
          오늘
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div
        ref={triggerRef}
        onClick={variant === 'inline' ? handleOpen : undefined}
        className={
          variant === 'inline'
            // 화면 상단 — 배경 없는 텍스트 + 셰브론
            ? `inline-flex items-center gap-[5px] px-1 py-1.5 cursor-pointer select-none
               text-subhead font-bold tabular-nums transition-opacity hover:opacity-70
               ${value ? 'text-ink' : 'text-ink-5'} ${className}`
            : variant === 'cell'
            // 인라인 입력 행 안 — 흰 배경 셀
            ? `flex items-center justify-between gap-1 rounded-cell bg-surface-card px-2 py-1.5
               text-body tabular-nums transition-shadow focus-within:shadow-focus ${open ? 'shadow-focus' : ''}
               ${value ? 'text-ink' : 'text-ink-5'} ${className}`
            // 폼 안 — 채움형 필드
            : `flex items-center justify-between gap-2 rounded-field px-3 py-[9px]
               text-subhead tabular-nums transition-colors focus-within:bg-surface-card focus-within:shadow-focus
               ${open ? 'bg-surface-card shadow-focus' : 'bg-surface-low'}
               ${value ? 'text-ink' : 'text-ink-5'} ${className}`
        }
      >
        {variant === 'inline' ? (
          <span>{display}</span>
        ) : (
          <input
            type="text"
            inputMode="numeric"
            value={text}
            onChange={e => handleType(e.target.value)}
            onBlur={commitText}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-transparent border-0 p-0 tabular-nums text-inherit placeholder:text-ink-5 focus:outline-none"
          />
        )}
        {/* 달력은 셰브론으로 연다 — 필드를 누르면 타이핑이 우선이다 */}
        <button
          type="button"
          tabIndex={-1}
          onClick={e => { e.stopPropagation(); handleOpen() }}
          aria-label="달력 열기"
          className="shrink-0 text-ink-5 leading-none"
        >
          <svg
            className={`transition-transform duration-200 ${open ? 'rotate-180' : ''} ${
              variant === 'field' ? 'w-3 h-3' : 'w-2.5 h-2.5'
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(calendar, document.body)}
    </>
  )
}
