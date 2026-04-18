'use client'

import { createContext, useContext } from 'react'
import type { Palette } from './palettes'
import { DEFAULT_PALETTE } from './palettes'
import { CATEGORIES } from './utils'

interface ThemeCtx {
  palette: Palette
  setPalette: (p: Palette) => void
  catColors: Record<string, string>
}

const catColors = Object.fromEntries(
  CATEGORIES.map((cat, i) => [cat, DEFAULT_PALETTE.colors[i]])
)

const ctx: ThemeCtx = {
  palette: DEFAULT_PALETTE,
  setPalette: () => {},
  catColors,
}

const ThemeContext = createContext<ThemeCtx>(ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeContext.Provider value={ctx}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
