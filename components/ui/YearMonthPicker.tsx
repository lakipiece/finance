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
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 w-56`}>
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button type="button" onClick={() => setTempYear(y => y - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
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
                className="w-16 text-center text-sm font-bold text-slate-700 border-b border-slate-300 focus:outline-none focus:border-[#1A237E] bg-transparent"
                autoFocus
              />
            ) : (
              <button type="button" onClick={() => { setEditingYear(true); setYearInput(String(tempYear)) }}
                className="text-sm font-bold text-slate-700 hover:text-[#1A237E] transition-colors px-2 py-0.5 rounded hover:bg-slate-50">
                {tempYear}년
              </button>
            )}
            <button type="button" onClick={() => setTempYear(y => y + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
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
                className={`col-span-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !allPeriod && year === tempYear && month === null
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}>{tempYear}년 전체</button>
            ) : null}
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <button key={m} type="button" onClick={() => selectMonth(m)}
                className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  (mode === 'single' || !allPeriod) && year === tempYear && month === m
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}>{m}월</button>
            ))}
          </div>
          {/* All period (보조) — filter mode only */}
          {mode === 'filter' ? (
            <button type="button"
              onClick={() => { (props as Extract<Props, { mode?: 'filter' }>).onChange(tempYear, null, true); setOpen(false) }}
              className={`w-full mt-2 pt-2 border-t border-slate-100 py-1.5 rounded-b-lg text-[11px] transition-colors ${
                allPeriod
                  ? 'text-[#1A237E] font-semibold'
                  : 'text-slate-400 hover:text-slate-700'
              }`}>전체 기간 보기</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
