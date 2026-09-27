export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'
import { requireSession } from '@/lib/auth-guard'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const denied = await requireSession()
  if (denied) return denied
  const sql = getSql()
  const data = await sql`
    SELECT h.*,
      row_to_json(s) as security,
      row_to_json(a) as account
    FROM holdings h
    JOIN securities s ON s.id = h.security_id
    JOIN accounts a ON a.id = h.account_id
    WHERE h.snapshot_id = ${id} AND h.quantity > 0
    ORDER BY h.account_id
  `
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const sql = getSql()
  if (body.date) {
    await sql`UPDATE snapshots SET date = ${body.date} WHERE id = ${id}`
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  await sql`DELETE FROM holdings WHERE snapshot_id = ${id}`
  await sql`DELETE FROM snapshots WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
