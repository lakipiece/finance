'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function YearPickerInner({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const [years, setYears] = useState<number[] | null>(null) // null = loading
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

  if (years === null) {
    return <div className={`h-8 w-20 rounded-btn ${variant === 'dark' ? 'bg-white/20' : 'bg-surface-low'} animate-pulse`} />
  }

  if (years.length === 0) return null

  // 기간 선택기 — 배경 없는 텍스트 + 셰브론. 배경 있는 보조 버튼은 실제 액션 전용이다.
  const selectCls = variant === 'dark'
    ? 'appearance-none bg-transparent border-0 text-white text-subhead font-bold tabular-nums pl-1 pr-5 py-1.5 cursor-pointer focus:outline-none'
    : 'appearance-none bg-transparent border-0 text-ink text-subhead font-bold tabular-nums pl-1 pr-5 py-1.5 cursor-pointer focus:outline-none'

  return (
    <div className="relative inline-flex items-center">
    <select
      value={selectedYear}
      onChange={(e) => {
        const params = new URLSearchParams(window.location.search)
        params.set('year', e.target.value)
        router.push(`${window.location.pathname}?${params.toString()}`)
      }}
      className={selectCls}
    >
      {years.map(y => (
        <option key={y} value={y} className="text-ink bg-surface-card">{y}년</option>
      ))}
    </select>
      <svg className={`absolute right-0 w-2.5 h-2.5 pointer-events-none ${variant === 'dark' ? 'text-white/60' : 'text-ink-5'}`}
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
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
