import { NextRequest, NextResponse } from 'next/server'
import { fetchYearData } from '@/lib/fetchYearData'

export async function GET(req: NextRequest) {
  const yearStr = req.nextUrl.searchParams.get('year')
  const year = yearStr ? parseInt(yearStr) : null

  if (!year || isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'year 파라미터가 올바르지 않습니다.' }, { status: 400 })
  }

  try {
    const data = await fetchYearData(year)
    const res = NextResponse.json(data)
    res.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return res
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
