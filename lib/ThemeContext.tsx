'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { Palette } from './palettes'
import { DEFAULT_PALETTE } from './palettes'
import { CATEGORIES } from './utils'

interface ThemeCtx {
  palette: Palette
  setPalette: (p: Palette) => void
  catColors: Record<string, string>
}

const defaultCatColors = Object.fromEntries(
  CATEGORIES.map((cat, i) => [cat, DEFAULT_PALETTE.colors[i]])
)

const ThemeContext = createContext<ThemeCtx>({
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  catColors: defaultCatColors,
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [catColors, setCatColors] = useState<Record<string, string>>(defaultCatColors)

  useEffect(() => {
    fetch('/api/options/categories')
      .then(r => r.json())
      .then((data: { name: string; color: string }[]) => {
        if (Array.isArray(data) && data.length) {
          setCatColors(Object.fromEntries(data.map(c => [c.name, c.color])))
        }
      })
      .catch(() => {})
  }, [])

  return (
    <ThemeContext.Provider value={{ palette: DEFAULT_PALETTE, setPalette: () => {}, catColors }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
