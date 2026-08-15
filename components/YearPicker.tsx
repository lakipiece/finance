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

  const selectCls = variant === 'dark'
    ? 'bg-white/20 text-white text-subhead font-bold rounded-field px-3 py-[9px] border-0 focus:outline-none focus:bg-white/30 cursor-pointer'
    : 'bg-surface-low text-ink text-subhead font-medium rounded-field px-3 py-[9px] border-0 focus:outline-none focus:bg-surface-card focus:shadow-focus cursor-pointer transition-colors'

  return (
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
  )
}

export default function YearPicker({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  return (
    <Suspense fallback={<div className={`h-8 w-20 rounded-btn ${variant === 'dark' ? 'bg-white/20' : 'bg-surface-low'} animate-pulse`} />}>
      <YearPickerInner variant={variant} />
    </Suspense>
  )
}
