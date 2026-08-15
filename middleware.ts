import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const { pathname } = req.nextUrl

  const isExempt =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/portfolio/prices/refresh'

  if (!isLoggedIn && !isExempt) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (isLoggedIn && pathname === '/') {
    const portfolioUrl = req.nextUrl.clone()
    portfolioUrl.pathname = '/portfolio'
    return NextResponse.redirect(portfolioUrl)
  }
})

export const config = {
  matcher: [
    // 정적 자산은 인증 대상이 아니다. 자체 호스팅 폰트(css·woff2)가 빠지면
    // 로그인 화면이 시스템 폰트로 떨어진다.
    '/((?!_next/static|_next/image|favicon\\.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|woff2?|ttf|otf)$).*)',
  ],
}
