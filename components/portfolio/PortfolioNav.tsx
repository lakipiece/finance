'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: '대시보드', href: '/portfolio' },
  { label: '포지션 관리', href: '/portfolio/holdings' },
  { label: '리밸런싱', href: '/portfolio/rebalance' },
  { label: 'Import', href: '/portfolio/import' },
]

export default function PortfolioNav() {
  const pathname = usePathname()
  return (
    <div className="border-b border-slate-100 bg-white">
      <nav className="max-w-7xl mx-auto px-4 flex gap-1 py-2">
        {TABS.map(t => {
          const active = t.href === '/portfolio'
            ? pathname === '/portfolio'
            : pathname.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-700'
              }`}>
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
