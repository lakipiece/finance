import { NextResponse } from 'next/server'
import { fetchAvailableYears } from '@/lib/fetchYears'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const years = await fetchAvailableYears()
    return NextResponse.json(years)
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
