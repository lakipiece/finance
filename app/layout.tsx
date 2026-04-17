import type { Metadata } from 'next'
import { Noto_Sans_KR, Manrope } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { FilterProvider } from '@/lib/FilterContext'
import HeaderBar from '@/components/HeaderBar'

const notoSans = Noto_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

// Manrope: 대형 KPI 숫자, 페이지 제목 — "고급 편집 기술" 헤드라인용
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
      <body className={`${notoSans.className} ${manrope.variable} bg-[#f8f9ff] min-h-screen`}>
        <ThemeProvider>
          <FilterProvider>
            <HeaderBar />
            <main>{children}</main>
          </FilterProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
