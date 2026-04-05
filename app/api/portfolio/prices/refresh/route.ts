import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { refreshAllPrices } from '@/lib/portfolio/prices'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await refreshAllPrices()
  return NextResponse.json(result)
}
