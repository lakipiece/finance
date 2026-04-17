'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import { usePathname } from 'next/navigation'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) return <>{children}</>

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
