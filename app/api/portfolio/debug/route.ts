import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data: holdings, error: hErr } = await supabase
    .from('holdings')
    .select('id, quantity, account_id, security_id')
    .gt('quantity', 0)

  const { data: holdingsJoined, error: jErr } = await supabase
    .from('holdings')
    .select('id, quantity, account:accounts(id, name), security:securities(id, ticker)')
    .gt('quantity', 0)

  return NextResponse.json({
    holdingsCount: holdings?.length ?? 0,
    holdingsError: hErr?.message ?? null,
    joinedCount: holdingsJoined?.length ?? 0,
    joinedError: jErr?.message ?? null,
    sample: holdingsJoined?.slice(0, 2) ?? [],
  })
}
