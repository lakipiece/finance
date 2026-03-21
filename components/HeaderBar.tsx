'use client'

import TabNav from './TabNav'
import ThemePicker from './ThemePicker'
import { useTheme } from '@/lib/ThemeContext'

export default function HeaderBar() {
  const { palette } = useTheme()
  return (
    <header
      className="text-white py-5 px-6 shadow-lg"
      style={{ background: palette.headerGradient }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/60 text-xs font-medium tracking-widest mb-0.5">HOUSEHOLD BUDGET</p>
            <h1 className="text-2xl font-bold">가계부 대시보드</h1>
          </div>
          <ThemePicker />
        </div>
        <TabNav />
      </div>
    </header>
  )
}
