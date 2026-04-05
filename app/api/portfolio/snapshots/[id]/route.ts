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

  await supabase.from('holdings').delete().eq('snapshot_id', params.id)
  await supabase.from('snapshots').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
