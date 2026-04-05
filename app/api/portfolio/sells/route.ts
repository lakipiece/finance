import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('sells')
    .select('*, security:securities(ticker,name), account:accounts(name,broker)')
    .order('sold_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo } = body
  if (!security_id || !account_id || !sold_at || !quantity) {
    return NextResponse.json({ error: 'security_id, account_id, sold_at, quantity 필수' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sells')
    .insert({ security_id, account_id, sold_at, quantity, avg_cost_krw, sell_price_krw, realized_pnl_krw, memo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
