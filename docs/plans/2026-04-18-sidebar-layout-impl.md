# Sidebar Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `HeaderBar` + `TabNav`를 제거하고 좌측 사이드바 레이아웃으로 교체한다. 페이지 컴포넌트는 무변경.

**Architecture:** `Sidebar.tsx`(콘텐츠) + `SidebarLayout.tsx`(래퍼)를 신규 생성하고, `app/layout.tsx`에서 `<HeaderBar />`를 `<SidebarLayout>`으로 교체한다. 모바일은 `useState`로 사이드바 open/close 토글.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, 인라인 SVG 아이콘 (lucide 없음)

**Branch:** `design/sidebar-layout`

---

## Task 1: `Sidebar.tsx` 생성

**Files:**
- Create: `components/Sidebar.tsx`

**Step 1: 파일 생성**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// ─── 아이콘 (인라인 SVG) ──────────────────────────────────────────────────────
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

// ─── 데이터 ───────────────────────────────────────────────────────────────────
const LEDGER_TABS = [
  { label: '대시보드', href: '/expenses',  icon: <IconGrid /> },
  { label: '월별',    href: '/monthly',   icon: <IconCalendar /> },
  { label: '연도비교', href: '/compare',   icon: <IconBarChart /> },
  { label: '검색',    href: '/search',    icon: <IconSearch /> },
  { label: '설정',    href: '/settings',  icon: <IconSettings /> },
]

const PORTFOLIO_TABS = [
  { label: '대시보드',  href: '/portfolio',                  icon: <IconGrid /> },
  { label: '스냅샷',   href: '/portfolio/snapshots',        icon: <IconCamera /> },
  { label: '배당',     href: '/portfolio/income',           icon: <IconDollar /> },
  { label: '계좌',     href: '/portfolio/accounts',         icon: <IconAccount /> },
  { label: '종목',     href: '/portfolio/securities',       icon: <IconList /> },
  { label: '옵션',     href: '/portfolio/options',          icon: <IconSliders /> },
  { label: '리밸런싱', href: '/portfolio/rebalance',        icon: <IconScale /> },
  { label: '설정',     href: '/portfolio/settings',         icon: <IconSettings /> },
]

// ─── 컴포넌트 ──────────────────────────────────────────────────────────────────
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
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-[220px]">
      {/* 로고 */}
      <div className="flex items-center px-5 pt-6 pb-5">
        <IconLogo />
      </div>

      {/* CTA 버튼 */}
      <div className="px-4 mb-5">
        <Link
          href={isPortfolio ? '/portfolio/snapshots' : '/expenses'}
          onClick={onClose}
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <IconPlus />
          {isPortfolio ? '스냅샷 추가' : '지출 추가'}
        </Link>
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
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <span className={active ? 'text-white' : 'text-slate-400'}>{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {/* 모드 전환 — 포트폴리오 먼저 */}
      <div className="px-4 pb-6 pt-4 border-t border-slate-100">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          <Link
            href="/portfolio"
            onClick={onClose}
            className={`flex-1 text-center py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isPortfolio
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            포트폴리오
          </Link>
          <Link
            href="/expenses"
            onClick={onClose}
            className={`flex-1 text-center py-1.5 text-xs font-medium rounded-lg transition-colors ${
              !isPortfolio
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            가계부
          </Link>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 빌드 확인**

```bash
cd /Users/lakipiece/dev/ledger
npx tsc --noEmit 2>&1 | head -20
```

Expected: 오류 없음 (또는 기존 오류만)

**Step 3: 커밋**

```bash
git add components/Sidebar.tsx
git commit -m "feat: Sidebar 컴포넌트 — 모드별 nav, CTA, 모드 전환"
```

---

## Task 2: `SidebarLayout.tsx` 생성

**Files:**
- Create: `components/SidebarLayout.tsx`

**Step 1: 파일 생성**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  // 라우트 변경 시 모바일 사이드바 자동 닫기
  useEffect(() => {
    setOpen(false)
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      {/* 데스크탑 사이드바 — fixed */}
      <div className="hidden md:flex fixed inset-y-0 left-0 z-40">
        <Sidebar />
      </div>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 모바일 사이드바 — 슬라이드 */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="md:pl-[220px] min-h-screen flex flex-col">
        {/* 모바일 햄버거 바 */}
        <div className="md:hidden flex items-center h-12 px-4 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={() => setOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
```

**Step 2: 빌드 확인**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: 커밋**

```bash
git add components/SidebarLayout.tsx
git commit -m "feat: SidebarLayout — 데스크탑 fixed 사이드바, 모바일 햄버거 슬라이드"
```

---

## Task 3: `app/layout.tsx` 교체

**Files:**
- Modify: `app/layout.tsx`

**Step 1: HeaderBar → SidebarLayout 교체**

`app/layout.tsx`를 다음으로 교체:

```tsx
import type { Metadata } from 'next'
import { Noto_Sans_KR, Manrope } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { FilterProvider } from '@/lib/FilterContext'
import SidebarLayout from '@/components/SidebarLayout'

const notoSans = Noto_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

const manrope = Manrope({
  weight: ['600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
})

export const metadata: Metadata = {
  title: '가계부 대시보드',
  description: '가계부 지출 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSans.className} ${manrope.variable}`}>
        <ThemeProvider>
          <FilterProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </FilterProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

> 주의: `body`에서 `bg-[#f8f9ff] min-h-screen` 제거 — `SidebarLayout`이 담당

**Step 2: 빌드 확인**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: 커밋**

```bash
git add app/layout.tsx
git commit -m "refactor: layout — HeaderBar → SidebarLayout 교체"
```

---

## Task 4: 페이지 padding 점검 및 조정

**Files:**
- Check: `app/expenses/page.tsx`, `app/portfolio/page.tsx`

**Step 1: dev 서버 실행 후 브라우저 확인**

```bash
npm run dev
# https://fin.lakipiece.com 또는 localhost:3000 접속
```

확인 항목:
- 사이드바가 좌측에 220px 고정으로 표시되는가
- 메인 콘텐츠가 사이드바와 겹치지 않는가
- 모바일(375px)에서 햄버거 버튼이 표시되는가
- 햄버거 클릭 시 사이드바 슬라이드 인/아웃 동작하는가
- 기존 페이지 레이아웃(max-w-7xl 등)이 깨지지 않는가

**Step 2: 문제 발견 시 조정**

페이지 내부 `max-w-7xl mx-auto px-4` 같은 컨테이너는 그대로 유지.
사이드바 때문에 콘텐츠가 좁아 보이면 `md:pl-[220px]`을 `md:pl-[220px]`로 이미 처리됨.

**Step 3: 최종 커밋**

```bash
git add -A
git commit -m "design: sidebar layout 완성 — Metric Slate 스타일 전환"
```

---

## 검증 체크리스트

- [ ] 데스크탑: 사이드바 220px 고정, 메인 콘텐츠 `ml-[220px]`
- [ ] 활성 탭: `bg-slate-800 text-white` 강조
- [ ] CTA 버튼: 포트폴리오 모드 "스냅샷 추가", 가계부 모드 "지출 추가"
- [ ] 모드 전환: 하단 토글, 포트폴리오 → 가계부 순서
- [ ] 모바일: 햄버거 메뉴 → 슬라이드 사이드바 + 오버레이
- [ ] 기존 페이지 컴포넌트 변경 없음
- [ ] TypeScript 오류 없음
