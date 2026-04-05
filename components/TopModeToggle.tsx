'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopModeToggle() {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')

  return (
    <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
      <Link
        href="/"
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          !isPortfolio ? 'bg-white text-slate-700' : 'text-white/70 hover:text-white'
        }`}
      >
        가계부
      </Link>
      <Link
        href="/portfolio"
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
          isPortfolio ? 'bg-white text-slate-700' : 'text-white/70 hover:text-white'
        }`}
      >
        포트폴리오
      </Link>
    </div>
  )
}
