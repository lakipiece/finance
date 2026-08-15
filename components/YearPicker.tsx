'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * 연도 선택기 — YearMonthPicker와 같은 형태.
 * 네이티브 select는 OS 기본 드롭다운이 떠서 앱 안에서 혼자 다른 표면을 만든다.
 * 트리거는 배경 없는 텍스트 + 셰브론(기간 선택기 규칙), 목록은 다이얼로그 표면.
 */
function YearPickerInner({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [years, setYears] = useState<number[] | null>(null) // null = loading
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const selectedYear = parseInt(searchParams.get('year') ?? String(currentYear))

  useEffect(() => {
    fetch('/api/years')
      .then(r => r.ok ? r.json() : [])
      .then((data: { year: number }[]) => {
        setYears(Array.isArray(data) ? data.map(d => d.year).sort((a, b) => b - a) : [])
      })
      .catch(() => setYears([]))
  }, [])

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

  if (years === null) {
    return <div className={`h-8 w-20 rounded-btn ${variant === 'dark' ? 'bg-white/20' : 'bg-surface-low'} animate-pulse`} />
  }

  if (years.length === 0) return null

  function select(y: number) {
    const params = new URLSearchParams(window.location.search)
    params.set('year', String(y))
    router.push(`${window.location.pathname}?${params.toString()}`)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-[5px] px-1 py-1.5 transition-opacity hover:opacity-70 whitespace-nowrap">
        <span className={`text-subhead font-bold tabular-nums ${variant === 'dark' ? 'text-white' : 'text-ink'}`}>
          {selectedYear}년
        </span>
        <svg className={`w-2.5 h-2.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${
          variant === 'dark' ? 'text-white/60' : 'text-ink-5'
        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open ? (
        <div className="absolute top-full right-0 mt-1.5 z-30 bg-surface-card rounded-dialog shadow-dialog p-3 w-40">
          <div className="grid grid-cols-2 gap-1">
            {years.map(y => (
              <button key={y} type="button" onClick={() => select(y)}
                className={`py-1.5 rounded-btn text-body tabular-nums transition-colors ${
                  y === selectedYear
                    ? 'bg-action text-white font-bold'
                    : 'text-ink-3 hover:bg-surface-low'
                }`}>{y}년</button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function YearPicker({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  return (
    <Suspense fallback={<div className={`h-8 w-20 rounded-btn ${variant === 'dark' ? 'bg-white/20' : 'bg-surface-low'} animate-pulse`} />}>
      <YearPickerInner variant={variant} />
    </Suspense>
  )
}
