import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * 라우트 레벨 세션 확인. 미들웨어가 이미 막지만, matcher 설정이 바뀌는 순간
 * 가계부·포트폴리오 데이터가 통째로 공개되지 않도록 라우트에서도 한 번 더 막는다.
 *   const denied = await requireSession(); if (denied) return denied
 */
export async function requireSession(): Promise<NextResponse | null> {
  const session = await auth()
  return session ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
