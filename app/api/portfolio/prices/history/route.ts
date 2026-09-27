export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchHistoricalPrices } from '@/lib/portfolio/prices'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { startDate, endDate, tickers } = await req.json()
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate, endDate 필수' }, { status: 400 })
  }

  // tickers 미지정 시 전체 종목 수집 (기존 동작)
  try {
    const result = await fetchHistoricalPrices(startDate, endDate, Array.isArray(tickers) ? tickers : undefined)
    return NextResponse.json(result)
  } catch (e) {
    // 처리 안 된 예외는 빈 본문 500이 되어 클라이언트에서 JSON 파싱 오류로만 보였다
    console.error('[POST /portfolio/prices/history]', e)
    return NextResponse.json({ error: `저장 실패: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 })
  }
}
