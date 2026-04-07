export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSql } from '@/lib/db'
import { auth } from '@/lib/auth'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const sql = getSql()
  const data = await sql`
    SELECT h.*,
      row_to_json(s) as security,
      row_to_json(a) as account
    FROM holdings h
    JOIN securities s ON s.id = h.security_id
    JOIN accounts a ON a.id = h.account_id
    WHERE h.snapshot_id = ${params.id} AND h.quantity > 0
    ORDER BY h.account_id
  `
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = getSql()
  await sql`DELETE FROM holdings WHERE snapshot_id = ${params.id}`
  await sql`DELETE FROM snapshots WHERE id = ${params.id}`
  return NextResponse.json({ ok: true })
}
