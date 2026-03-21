// lib/ThemeContext.tsx
'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { Palette } from './palettes'
import { PALETTES, DEFAULT_PALETTE } from './palettes'
import { CATEGORIES } from './utils'

interface ThemeCtx {
  palette: Palette
  setPalette: (p: Palette) => void
  catColors: Record<string, string>
}

const ThemeContext = createContext<ThemeCtx>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  catColors: Object.fromEntries(CATEGORIES.map((cat, i) => [cat, DEFAULT_PALETTE.colors[i]])),
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [palette, setPaletteState] = useState<Palette>(DEFAULT_PALETTE)

  useEffect(() => {
    const saved = localStorage.getItem('dashboard-theme')
    if (saved) {
      const found = PALETTES.find((p) => p.id === saved)
      if (found) setPaletteState(found)
    }
  }, [])

  function setPalette(p: Palette) {
    setPaletteState(p)
    localStorage.setItem('dashboard-theme', p.id)
  }

  const catColors = Object.fromEntries(
    CATEGORIES.map((cat, i) => [cat, palette.colors[i]])
  )

  return (
    <ThemeContext.Provider value={{ palette, setPalette, catColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
