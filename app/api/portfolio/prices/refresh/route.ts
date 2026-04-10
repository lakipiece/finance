import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { refreshAllPrices } from '@/lib/portfolio/prices'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // cron 호출: CRON_SECRET Bearer 토큰으로 인증
  } else {
    // UI 호출: NextAuth 세션으로 인증
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await refreshAllPrices()
  return NextResponse.json(result)
}
