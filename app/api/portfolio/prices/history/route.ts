export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { fetchHistoricalPrices } from '@/lib/portfolio/prices'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { startDate, endDate } = await req.json()
  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'startDate, endDate 필수' }, { status: 400 })
  }

  const result = await fetchHistoricalPrices(startDate, endDate)
  return NextResponse.json(result)
}
