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
    return <div className={`h-8 w-20 rounded-lg ${variant === 'dark' ? 'bg-white/20' : 'bg-slate-100'} animate-pulse`} />
  }

  if (years.length === 0) return null

  const selectCls = variant === 'dark'
    ? 'bg-white/20 text-white text-sm font-semibold rounded-lg px-3 py-1.5 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer'
    : 'bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 cursor-pointer'

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
        <option key={y} value={y} className="text-slate-800 bg-white">{y}년</option>
      ))}
    </select>
  )
}

export default function YearPicker({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  return (
    <Suspense fallback={<div className={`h-8 w-20 rounded-lg ${variant === 'dark' ? 'bg-white/20' : 'bg-slate-100'} animate-pulse`} />}>
      <YearPickerInner variant={variant} />
    </Suspense>
  )
}
