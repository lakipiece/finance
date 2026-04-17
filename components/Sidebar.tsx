'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function IconGrid() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  )
}
function IconCalendar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconBarChart() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  )
}
function IconSearch() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}
function IconSettings() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
function IconCamera() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconDollar() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
function IconAccount() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  )
}
function IconList() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}
function IconSliders() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  )
}
function IconScale() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M3 9l9-7 9 7M3 15l9 7 9-7" />
    </svg>
  )
}
function IconPlus() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function IconLogo() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="#1e293b" />
      <path d="M8 20V8h2v10h8v2H8z" fill="white" />
      <circle cx="20" cy="10" r="2.5" fill="#64748b" />
    </svg>
  )
}

const LEDGER_TABS = [
  { label: '대시보드', href: '/expenses',  icon: <IconGrid /> },
  { label: '월별',    href: '/monthly',   icon: <IconCalendar /> },
  { label: '연도비교', href: '/compare',   icon: <IconBarChart /> },
  { label: '검색',    href: '/search',    icon: <IconSearch /> },
  { label: '설정',    href: '/settings',  icon: <IconSettings /> },
]

const PORTFOLIO_TABS = [
  { label: '대시보드',  href: '/portfolio',             icon: <IconGrid /> },
  { label: '스냅샷',   href: '/portfolio/snapshots',   icon: <IconCamera /> },
  { label: '배당',     href: '/portfolio/income',      icon: <IconDollar /> },
  { label: '계좌',     href: '/portfolio/accounts',    icon: <IconAccount /> },
  { label: '종목',     href: '/portfolio/securities',  icon: <IconList /> },
  { label: '옵션',     href: '/portfolio/options',     icon: <IconSliders /> },
  { label: '리밸런싱', href: '/portfolio/rebalance',   icon: <IconScale /> },
  { label: '설정',     href: '/portfolio/settings',    icon: <IconSettings /> },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const isPortfolio = pathname.startsWith('/portfolio')
  const tabs = isPortfolio ? PORTFOLIO_TABS : LEDGER_TABS

  const isActive = (href: string) =>
    href === '/expenses' || href === '/portfolio'
      ? pathname === href
      : pathname.startsWith(href)

  return (
    <div className="flex flex-col h-full w-[220px]" style={{ background: '#1a2332' }}>
      {/* 로고 */}
      <div className="flex items-center px-5 pt-6 pb-6">
        <IconLogo />
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {tabs.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
              style={active ? { background: 'rgba(255,255,255,0.12)' } : undefined}
            >
              <span className={active ? 'text-white' : 'text-slate-500'}>{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* 모드 전환 — 포트폴리오 먼저 */}
      <div className="px-4 pb-6 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <Link
            href="/portfolio"
            onClick={onClose}
            className={`flex-1 text-center py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isPortfolio
                ? 'text-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={isPortfolio ? { background: 'rgba(255,255,255,0.92)' } : undefined}
          >
            포트폴리오
          </Link>
          <Link
            href="/expenses"
            onClick={onClose}
            className={`flex-1 text-center py-1.5 text-xs font-medium rounded-lg transition-colors ${
              !isPortfolio
                ? 'text-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            style={!isPortfolio ? { background: 'rgba(255,255,255,0.92)' } : undefined}
          >
            가계부
          </Link>
        </div>
      </div>
    </div>
  )
}
