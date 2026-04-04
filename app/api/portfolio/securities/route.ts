import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase.from('securities').select('*').order('ticker')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ticker, name, asset_class, country, style, sector, currency } = body
  if (!ticker || !name) return NextResponse.json({ error: 'ticker, name 필수' }, { status: 400 })

  const { data, error } = await supabase
    .from('securities')
    .upsert(
      { ticker: ticker.toUpperCase(), name, asset_class, country, style, sector, currency: currency ?? 'USD' },
      { onConflict: 'ticker' }
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
