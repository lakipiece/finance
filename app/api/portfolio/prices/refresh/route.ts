import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { refreshAllPrices } from '@/lib/portfolio/prices'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await refreshAllPrices()
  return NextResponse.json(result)
}
