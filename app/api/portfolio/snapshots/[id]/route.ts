import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { data: holdings } = await supabase
    .from('holdings')
    .select('*, security:securities(*), account:accounts(*)')
    .eq('snapshot_id', params.id)
    .gt('quantity', 0)
    .order('account_id')
  return NextResponse.json(holdings ?? [])
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error: holdingsError } = await supabase.from('holdings').delete().eq('snapshot_id', params.id)
  if (holdingsError) return NextResponse.json({ error: holdingsError.message }, { status: 500 })

  const { error: snapshotError } = await supabase.from('snapshots').delete().eq('id', params.id)
  if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
