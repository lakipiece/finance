import type { Metadata } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/lib/ThemeContext'
import { FilterProvider } from '@/lib/FilterContext'
import SidebarLayout from '@/components/SidebarLayout'

const notoSans = Noto_Sans_KR({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Lakipiece Finance',
  description: 'The Precision Curator — 포트폴리오 & 가계부 관리',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={notoSans.className}>
        <ThemeProvider>
          <FilterProvider>
            <SidebarLayout>{children}</SidebarLayout>
          </FilterProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
