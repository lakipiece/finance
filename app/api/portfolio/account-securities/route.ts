import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data } = await supabase.from('account_securities').select('*')
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_id } = await req.json()
  if (!account_id || !security_id) return NextResponse.json({ error: 'account_id, security_id 필수' }, { status: 400 })

  const { error } = await supabase
    .from('account_securities')
    .upsert({ account_id, security_id }, { onConflict: 'account_id,security_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { account_id, security_ids } = await req.json()

  if (!account_id) return NextResponse.json({ error: 'account_id 필수' }, { status: 400 })

  // DELETE all for account, then INSERT fresh
  const { error: deleteError } = await supabase.from('account_securities').delete().eq('account_id', account_id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (security_ids?.length > 0) {
    const rows = security_ids.map((sid: string) => ({ account_id, security_id: sid }))
    const { error: insertError } = await supabase.from('account_securities').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const client = createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const account_id = searchParams.get('account_id')
  const security_id = searchParams.get('security_id')
  if (!account_id || !security_id) return NextResponse.json({ error: 'account_id, security_id 필수' }, { status: 400 })

  const { error } = await supabase
    .from('account_securities')
    .delete()
    .eq('account_id', account_id)
    .eq('security_id', security_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
