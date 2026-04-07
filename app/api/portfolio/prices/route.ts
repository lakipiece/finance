export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPrices } from '@/lib/portfolio/prices'

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('tickers') ?? ''
  const tickers = raw.split(',').map(t => t.trim()).filter(Boolean)

  if (tickers.length === 0) {
    return NextResponse.json({ error: 'tickers 파라미터가 필요합니다.' }, { status: 400 })
  }
  if (tickers.length > 50) {
    return NextResponse.json({ error: '한 번에 최대 50개까지 조회 가능합니다.' }, { status: 400 })
  }

  try {
    const prices = await getPrices(tickers)
    return NextResponse.json(prices, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: '가격 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
