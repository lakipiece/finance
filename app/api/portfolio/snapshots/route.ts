import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase
    .from('snapshots')
    .select('*')
    .order('date', { ascending: false })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { date, memo, clone_from } = body

  const { data: snapshot, error } = await supabase
    .from('snapshots')
    .insert({ date: date ?? new Date().toISOString().slice(0, 10), memo })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (clone_from) {
    const { data: sourceHoldings } = await supabase
      .from('holdings')
      .select('account_id, security_id, quantity, avg_price, total_invested, source')
      .eq('snapshot_id', clone_from)
      .gt('quantity', 0)

    if (sourceHoldings && sourceHoldings.length > 0) {
      const cloned = sourceHoldings.map(h => ({
        ...h,
        snapshot_id: snapshot.id,
        snapshot_date: snapshot.date,
        updated_at: new Date().toISOString(),
      }))
      const { error: cloneError } = await supabase.from('holdings').insert(cloned)
      if (cloneError) {
        await supabase.from('snapshots').delete().eq('id', snapshot.id)
        return NextResponse.json({ error: cloneError.message }, { status: 500 })
      }
    }
  }

  return NextResponse.json(snapshot, { status: 201 })
}
