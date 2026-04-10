'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LEDGER_TABS = [
  { label: '대시보드', href: '/' },
  { label: '연도비교', href: '/compare' },
  { label: '검색', href: '/search' },
  { label: '관리', href: '/admin' },
]

const PORTFOLIO_TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '스냅샷', href: '/portfolio/snapshots' },
  { label: '수익', href: '/portfolio/income' },
  { label: '계좌관리', href: '/portfolio/accounts' },
  { label: '종목관리', href: '/portfolio/securities' },
  { label: '설정', href: '/portfolio/settings' },
]

export default function TabNav() {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')
  const tabs = isPortfolio ? PORTFOLIO_TABS : LEDGER_TABS

  return (
    <nav className="flex gap-1" aria-label="탭 네비게이션">
      {tabs.map((tab) => {
        const active = tab.href === '/' || tab.href === '/portfolio'
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
