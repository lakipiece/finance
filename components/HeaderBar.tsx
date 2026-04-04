'use client'

import TabNav from './TabNav'
import YearPicker from './YearPicker'
import { useTheme } from '@/lib/ThemeContext'

export default function HeaderBar() {
  const { palette } = useTheme()
  return (
    <header
      className="text-white py-4 px-4 md:px-6 shadow-lg"
      style={{ background: palette.headerGradient }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-white/60 text-[10px] md:text-xs font-medium tracking-widest mb-0.5">HOUSEHOLD LEDGER</p>
            <h1 className="text-lg md:text-2xl font-bold">가계부 대시보드</h1>
          </div>
          <YearPicker />
        </div>
        <TabNav />
      </div>
    </header>
  )
}
