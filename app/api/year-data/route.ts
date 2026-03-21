import { NextRequest, NextResponse } from 'next/server'
import { fetchYearData } from '@/lib/fetchYearData'

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null

  if (!year || isNaN(year)) {
    return NextResponse.json({ error: 'year 파라미터가 필요합니다.' }, { status: 400 })
  }

  const data = await fetchYearData(year)
  return NextResponse.json(data)
}
