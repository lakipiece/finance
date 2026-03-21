// components/ThemePicker.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { PALETTES } from '@/lib/palettes'

export default function ThemePicker() {
  const { palette, setPalette } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-sm"
        title="테마 선택"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex gap-0.5">
          {palette.colors.map((c) => (
            <span key={c} className="w-3 h-3 rounded-full inline-block" style={{ background: c }} />
          ))}
        </span>
        <span className="hidden sm:inline text-xs text-white/70">{palette.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50">
          <p className="text-xs text-slate-400 font-medium px-1 mb-2">테마 선택</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTES.map((p) => (
              <button
                key={p.id}
                onClick={() => { setPalette(p); setOpen(false) }}
                className={`flex items-center gap-2 p-2 rounded-xl text-left transition-colors hover:bg-slate-50 ${
                  palette.id === p.id ? 'ring-2 ring-blue-400 bg-slate-50' : ''
                }`}
              >
                <span className="flex gap-0.5 flex-shrink-0">
                  {p.colors.map((c) => (
                    <span key={c} className="w-3.5 h-3.5 rounded-sm inline-block" style={{ background: c }} />
                  ))}
                </span>
                <span className="text-xs text-slate-700 font-medium truncate">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
