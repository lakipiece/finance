// components/TabNav.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '대시보드', href: '/' },
  { label: '연도비교', href: '/compare' },
  { label: '검색',     href: '/search' },
  { label: '포트폴리오', href: '/portfolio' },
  { label: '관리',     href: '/admin' },
]

export default function TabNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1" aria-label="탭 네비게이션">
      {TABS.map((tab) => {
        const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
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
