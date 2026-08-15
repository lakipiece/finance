'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  years: number[]
  onChange: (y: number) => void
  disabled?: boolean
  align?: 'left' | 'right'
}

/**
 * 연도 선택기 — YearMonthPicker와 같은 형태.
 * 네이티브 select는 OS 기본 드롭다운을 띄워 앱 안에서 혼자 다른 표면이 된다.
 * 트리거는 배경 없는 텍스트 + 셰브론(기간 선택기 규칙), 목록은 다이얼로그 표면.
 */
export default function YearSelect({ value, years, onChange, disabled = false, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button type="button" disabled={disabled} onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-[5px] px-1 py-1.5 transition-opacity hover:opacity-70 disabled:opacity-50 whitespace-nowrap">
        <span className="text-subhead font-bold text-ink tabular-nums">{value}년</span>
        <svg className={`w-2.5 h-2.5 text-ink-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 z-30 bg-surface-card rounded-dialog shadow-dialog p-3 w-40 max-h-64 overflow-y-auto`}>
          <div className="grid grid-cols-2 gap-1">
            {years.map(y => (
              <button key={y} type="button" onClick={() => { onChange(y); setOpen(false) }}
                className={`py-1.5 rounded-btn text-body tabular-nums transition-colors ${
                  y === value ? 'bg-action text-white font-bold' : 'text-ink-3 hover:bg-surface-low'
                }`}>{y}년</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
