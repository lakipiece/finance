import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import HeaderBar from '@/components/HeaderBar'

const notoSans = Noto_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: '가계부 대시보드',
  description: '가계부 지출 분석 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${notoSans.className} bg-slate-50 min-h-screen`}>
        <ThemeProvider>
          <HeaderBar />
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
