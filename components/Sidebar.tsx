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
function IconTrendingUp() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
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
function IconBuilding() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function IconLogo() {
  return (
    <svg className="w-7 h-7" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="#1e293b"/>
      <rect x="6" y="6" width="3" height="20" rx="1.5" fill="white"/>
      <rect x="6" y="6" width="15" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="13" width="10" height="3" rx="1.5" fill="white"/>
      <rect x="6" y="22" width="5" height="4" rx="1.5" fill="#00695C"/>
      <line x1="12" y1="26" x2="25" y2="7" stroke="#C2185B" strokeWidth="2.5" strokeLinecap="round"/>
      <polyline points="19,7 25,7 25,13" stroke="#C2185B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  )
}

const LEDGER_TABS = [
  { label: '가계부',   href: '/expenses',  icon: <IconGrid /> },
  { label: '수입',     href: '/income',    icon: <IconTrendingUp /> },
  { label: '연도비교', href: '/compare',   icon: <IconBarChart /> },
  { label: '검색',     href: '/search',    icon: <IconSearch /> },
]

const PORTFOLIO_TABS = [
  { label: '포트폴리오', href: '/portfolio',             icon: <IconGrid /> },
  { label: '스냅샷',    href: '/portfolio/snapshots',   icon: <IconCamera /> },
  { label: '배당',      href: '/portfolio/income',      icon: <IconDollar /> },
  { label: '계좌',      href: '/portfolio/accounts',    icon: <IconAccount /> },
  { label: '종목',      href: '/portfolio/securities',  icon: <IconList /> },
  { label: '옵션',      href: '/portfolio/options',     icon: <IconSliders /> },
  { label: '리밸런싱',  href: '/portfolio/rebalance',   icon: <IconScale /> },
]

const COMMON_TABS = [
  { label: '자산', href: '/assets',    icon: <IconBuilding /> },
  { label: '설정', href: '/settings',  icon: <IconSettings /> },
]

interface NavLinkProps {
  href: string
  icon: React.ReactNode
  label: string
  pathname: string
  onClose?: () => void
}

function NavLink({ href, icon, label, pathname, onClose }: NavLinkProps) {
  const active = href === '/expenses' || href === '/portfolio'
    ? pathname === href
    : pathname.startsWith(href)
  return (
    <Link
      href={href}
      onClick={onClose}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'text-[#1A237E]'
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
      style={active ? { background: 'rgba(26,35,126,0.07)' } : undefined}
    >
      {active ? (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: '#00695C' }} />
      ) : null}
      <span className={active ? 'text-[#1A237E]' : 'text-slate-400'}>{icon}</span>
      {label}
    </Link>
  )
}

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full w-[220px] border-r border-slate-100 bg-white">
      {/* 로고 + 브랜드 타이틀 */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
        <IconLogo />
        <div className="leading-none">
          <p className="text-[13px] font-bold tracking-widest text-slate-700 uppercase leading-tight">Lakipiece</p>
          <p className="text-[13px] font-bold tracking-widest uppercase leading-tight" style={{ color: '#1A237E' }}>Finance</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5">
        {/* 가계부 그룹 */}
        {LEDGER_TABS.map(tab => (
          <NavLink key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} pathname={pathname} onClose={onClose} />
        ))}

        <div className="mx-3 my-2 border-t border-slate-100" />

        {/* 포트폴리오 그룹 */}
        {PORTFOLIO_TABS.map(tab => (
          <NavLink key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} pathname={pathname} onClose={onClose} />
        ))}

        <div className="mx-3 my-2 border-t border-slate-100" />

        {/* 공통 메뉴 */}
        {COMMON_TABS.map(tab => (
          <NavLink key={tab.href} href={tab.href} icon={tab.icon} label={tab.label} pathname={pathname} onClose={onClose} />
        ))}
      </nav>
    </div>
  )
}
