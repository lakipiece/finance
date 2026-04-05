import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('holdings')
    .select('*, account:accounts(*), security:securities(*)')
    .order('updated_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { account_id, security_id, quantity, avg_price, total_invested, snapshot_date, snapshot_id } = body
  if (!account_id || !security_id || quantity == null) {
    return NextResponse.json({ error: 'account_id, security_id, quantity 필수' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('holdings')
    .upsert(
      {
        account_id,
        security_id,
        quantity,
        avg_price,
        total_invested,
        snapshot_date: snapshot_date ?? new Date().toISOString().slice(0, 10),
        snapshot_id: snapshot_id ?? undefined,
        source: 'manual',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'account_id,security_id' }
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
