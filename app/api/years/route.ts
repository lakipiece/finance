import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchAvailableYears } from '@/lib/fetchYears'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const years = await fetchAvailableYears()
  return NextResponse.json(years)
}
