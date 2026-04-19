'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
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

export default function DateInput({ value, onChange, className = '', placeholder = '날짜 선택' }: Props) {
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

  const display = value ? value.replace(/-/g, '. ') : placeholder

  const calendar = open && (
    <div
      ref={calRef}
      className="fixed z-[9999] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 select-none"
      style={{ top: pos.top, left: pos.left, width: 248 }}
    >
      {/* 헤더: 연/월 + 이전/다음 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs font-semibold text-slate-600">{viewYear}년 {MONTHS[viewMonth]}</span>
        <button onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={d} className={`text-center text-[10px] font-medium pb-1.5 ${
            i === 0 ? 'text-rose-300' : i === 6 ? 'text-blue-300' : 'text-slate-300'
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
              className={`w-full aspect-square flex items-center justify-center rounded-lg text-[11px] transition-all font-medium
                ${isSelected
                  ? 'text-white'
                  : isToday
                  ? 'text-[#1A237E] font-bold'
                  : isSun
                  ? 'text-rose-400 hover:bg-rose-50'
                  : isSat
                  ? 'text-blue-400 hover:bg-blue-50'
                  : 'text-slate-500 hover:bg-slate-50'
                }`}
              style={isSelected ? { backgroundColor: '#1A237E' } : undefined}
            >
              {isToday && !isSelected && (
                <span className="relative">
                  {day}
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1A237E]" />
                </span>
              )}
              {(!isToday || isSelected) && day}
            </button>
          )
        })}
      </div>

      {/* 하단: 오늘 */}
      <div className="mt-3 pt-2.5 border-t border-slate-50 flex justify-end">
        <button
          onClick={() => { onChange(todayYMD); setOpen(false) }}
          className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors text-slate-400 hover:text-[#1A237E] hover:bg-slate-50"
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
        onClick={handleOpen}
        className={`relative inline-flex items-center gap-1.5 pb-1 border-b cursor-pointer group transition-colors ${
          open ? 'border-[#1A237E]' : 'border-slate-200 hover:border-[#1A237E]'
        } ${className}`}
      >
        <svg
          className={`w-3 h-3 shrink-0 transition-colors ${open ? 'text-[#1A237E]' : 'text-slate-300 group-hover:text-[#1A237E]'}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <span className={`text-xs tabular-nums transition-colors ${value ? 'text-slate-600' : 'text-slate-300'}`}>
          {display}
        </span>
      </div>
      {open && typeof document !== 'undefined' && createPortal(calendar, document.body)}
    </>
  )
}
