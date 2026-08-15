import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { FilterProvider } from '@/lib/FilterContext'
import SidebarLayout from '@/components/SidebarLayout'

export const metadata: Metadata = {
  title: 'Lakipiece Finance',
  description: 'The Precision Curator — 포트폴리오 & 가계부 관리',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Finance',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 자체 호스팅 — 한글 unicode-range 동적 서브셋, 400/500/700 */}
        <link rel="stylesheet" href="/fonts/pretendard.css" />
      </head>
      <body className="bg-surface text-ink">
        <ThemeProvider>
          <FilterProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </FilterProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
