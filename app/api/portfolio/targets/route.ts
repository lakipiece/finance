import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('target_allocations')
    .select('*')
    .order('level')
    .order('key')
  return NextResponse.json(data ?? [])
}

export async function PUT(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: { level: string; key: string; target_pct: number }[] = await req.json()

  const { error } = await supabase
    .from('target_allocations')
    .upsert(body, { onConflict: 'level,key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
