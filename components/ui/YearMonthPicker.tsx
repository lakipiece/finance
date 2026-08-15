'use client'

import { useEffect, useRef, useState } from 'react'

interface BaseProps {
  year: number
  month: number | null
  align?: 'left' | 'right'
}

type Props =
  | (BaseProps & {
      mode?: 'filter'
      allPeriod: boolean
      onChange: (year: number, month: number | null, allPeriod: boolean) => void
    })
  | (BaseProps & {
      mode: 'single'
      onChange: (year: number, month: number) => void
    })

export default function YearMonthPicker(props: Props) {
  const mode = props.mode ?? 'filter'
  const { year, month, align = 'left' } = props
  const allPeriod = mode === 'filter' ? (props as Extract<Props, { mode?: 'filter' }>).allPeriod : false

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

  const label = mode === 'filter' && allPeriod
    ? '전체 기간'
    : month
    ? `${year}년 ${month}월`
    : `${year}년 전체`

  function selectMonth(m: number) {
    if (mode === 'single') {
      (props as Extract<Props, { mode: 'single' }>).onChange(tempYear, m)
    } else {
      (props as Extract<Props, { mode?: 'filter' }>).onChange(tempYear, m, false)
    }
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      {/* 기간 선택기 — 배경 없는 텍스트 + 셰브론.
          배경 있는 보조 버튼(#e0e4ec)은 실제 액션 전용이므로 여기 쓰지 않는다. */}
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-[5px] px-1 py-1.5 transition-opacity hover:opacity-70 whitespace-nowrap">
        <span className="text-subhead font-bold text-ink tabular-nums">{label}</span>
        <svg className={`w-2.5 h-2.5 text-ink-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-30 bg-white rounded-dialog shadow-dialog p-3 w-56`}>
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button type="button" onClick={() => setTempYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-btn hover:bg-surface-low text-ink-4 transition-colors">
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
                className="w-16 text-center text-subhead font-bold text-ink tabular-nums rounded-cell bg-surface-low py-0.5 focus:outline-none focus:bg-surface-card focus:shadow-focus border-0 placeholder:text-ink-5 transition-colors"
                autoFocus
              />
            ) : (
              <button type="button" onClick={() => { setEditingYear(true); setYearInput(String(tempYear)) }}
                className="text-subhead font-bold text-ink tabular-nums px-2 py-0.5 rounded-cell hover:bg-surface-low transition-colors">
                {tempYear}년
              </button>
            )}
            <button type="button" onClick={() => setTempYear(y => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-btn hover:bg-surface-low text-ink-4 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-1">
            {mode === 'filter' ? (
              <button type="button"
                onClick={() => { (props as Extract<Props, { mode?: 'filter' }>).onChange(tempYear, null, false); setOpen(false) }}
                className={`col-span-4 py-1.5 rounded-btn text-body transition-colors ${
                  !allPeriod && year === tempYear && month === null
                    ? 'bg-action text-white font-bold'
                    : 'text-ink-3 hover:bg-surface-low'
                }`}>{tempYear}년 전체</button>
            ) : null}
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button key={m} type="button" onClick={() => selectMonth(m)}
                className={`py-1.5 rounded-btn text-body tabular-nums transition-colors ${
                  (mode === 'single' || !allPeriod) && year === tempYear && month === m
                    ? 'bg-action text-white font-bold'
                    : 'text-ink-3 hover:bg-surface-low'
                }`}>{m}월</button>
            ))}
          </div>
          {/* All period (보조) — filter mode only */}
          {mode === 'filter' ? (
            <button type="button"
              onClick={() => { (props as Extract<Props, { mode?: 'filter' }>).onChange(tempYear, null, true); setOpen(false) }}
              className={`w-full mt-2 pt-2 py-1.5 rounded-b-btn text-meta transition-colors ${
                allPeriod
                  ? 'text-ink font-bold'
                  : 'text-ink-4 hover:text-ink-2'
              }`}>전체 기간 보기</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
