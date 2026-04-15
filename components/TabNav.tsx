'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LEDGER_TABS = [
  { label: '대시보드', short: '홈',  href: '/expenses' },
  { label: '연도비교', short: '비교', href: '/compare' },
  { label: '검색',    short: '검색', href: '/search' },
  { label: '설정',    short: '설정', href: '/settings' },
]

const PORTFOLIO_TABS = [
  { label: '대시보드', short: '홈',   href: '/portfolio' },
  { label: '스냅샷',  short: '스냅샷', href: '/portfolio/snapshots' },
  { label: '배당',    short: '배당',  href: '/portfolio/income' },
  { label: '계좌',    short: '계좌',  href: '/portfolio/accounts' },
  { label: '종목',    short: '종목',  href: '/portfolio/securities' },
  { label: '옵션',    short: '옵션',  href: '/portfolio/options' },
  { label: '리밸런싱', short: '리밸', href: '/portfolio/rebalance' },
  { label: '설정',    short: '설정',  href: '/settings' },
]

export default function TabNav() {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')
  const tabs = isPortfolio ? PORTFOLIO_TABS : LEDGER_TABS

  return (
    <nav className="flex gap-0.5 flex-nowrap overflow-x-auto scrollbar-none" aria-label="탭 네비게이션">
      {tabs.map((tab) => {
        const active = tab.href === '/expenses' || tab.href === '/portfolio'
          ? pathname === tab.href
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`px-2.5 py-1 md:px-4 md:py-1.5 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white/90 hover:bg-white/10'
            }`}
          >
            <span className="md:hidden">{tab.short}</span>
            <span className="hidden md:inline">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
