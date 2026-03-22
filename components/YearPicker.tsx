'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function YearPickerInner() {
  const [years, setYears] = useState<number[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentYear = new Date().getFullYear()
  const selectedYear = parseInt(searchParams.get('year') ?? String(currentYear))

  useEffect(() => {
    fetch('/api/years')
      .then(r => r.ok ? r.json() : null)
      .then((data: { year: number }[] | null) => {
        if (Array.isArray(data)) {
          setYears(data.map(d => d.year).sort((a, b) => b - a))
        }
      })
      .catch(() => {})
  }, [])

  if (years.length === 0) return null

  return (
    <select
      value={selectedYear}
      onChange={(e) => router.push(`/?year=${e.target.value}`)}
      className="bg-white/20 text-white text-sm font-semibold rounded-lg px-3 py-1.5 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
    >
      {years.map(y => (
        <option key={y} value={y} className="text-slate-800 bg-white">{y}년</option>
      ))}
    </select>
  )
}

export default function YearPicker() {
  return (
    <Suspense fallback={null}>
      <YearPickerInner />
    </Suspense>
  )
}
